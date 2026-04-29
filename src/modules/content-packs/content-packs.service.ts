import axios from 'axios';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContentPackManifest } from '../../entities/content-pack-manifest.entity';
import { GetContentManifestQueryDto } from './dto/get-content-manifest-query.dto';
import { UpsertContentPackDto } from './dto/upsert-content-pack.dto';

type ManifestQuery = {
  platform?: string;
  module?: string;
  kind?: string;
  language?: string;
  appVersion?: string;
};

type ManifestItem = {
  id: string;
  platform: string;
  module: string;
  kind: string;
  language: string;
  version: string;
  hash: string | null;
  sizeBytes: number | null;
  url: string;
  minAppVersion: string | null;
  publishedAt: string;
  metadata: Record<string, unknown> | null;
};

type ManifestResolution = {
  row: ContentPackManifest;
  languageOverride?: string;
};

@Injectable()
export class ContentPacksService {
  private static readonly FINES_MODULE_KEY = 'fines_penalties';
  private static readonly FINES_KIND_KEY = 'questions';
  private static readonly ENGLISH_LANGUAGE = 'en';
  private static readonly FINES_PACK_CHECK_CACHE_TTL_MS = 15 * 60 * 1000;
  private static readonly FINES_PACK_SAMPLE_QUESTION_LIMIT = 15;
  private static readonly FINES_PACK_MIN_TOKEN_HITS = 6;

  private readonly logger = new Logger(ContentPacksService.name);
  private readonly finesPackContaminationCache = new Map<
    string,
    { checkedAtMs: number; contaminated: boolean }
  >();
  private readonly finesContaminationTokens = new Set<string>([
    'primarily',
    'supply',
    'firms',
    'confirm',
    'confirms',
    'clerk',
    'vehicle',
    'warning',
    'mobile',
    'phone',
    'speeding',
    'insurance',
    'court',
    'fixed',
    'penalty',
    'points',
    'limit',
    'driving',
    'offence',
    'offences',
    'licence',
    'motorway',
    'failure',
    'this',
    'much',
    'were',
    'size',
    'their',
    'considered',
    'standard',
    'handles',
    'selling',
    'renewing',
    'house',
    'tow',
    'day',
    'safe',
    'route',
    'choice',
    'nothing',
    'only',
  ]);

  constructor(
    @InjectRepository(ContentPackManifest)
    private readonly contentPackRepo: Repository<ContentPackManifest>,
  ) {}

  async getManifest(query: GetContentManifestQueryDto) {
    const normalized = this.normalizeManifestQuery(query);
    const rows = await this.queryCandidateRows(normalized);
    const latest = this.pickLatestByKey(rows);
    const resolved = await this.resolveManifestRowsForLocalization(latest, normalized);
    return {
      generatedAt: new Date().toISOString(),
      platform: normalized.platform ?? null,
      items: resolved.map((entry) =>
        this.toManifestItem(entry.row, entry.languageOverride),
      ),
    };
  }

  async upsert(dto: UpsertContentPackDto) {
    const normalized = this.normalizeUpsertPayload(dto);
    const existing = await this.contentPackRepo.findOne({
      where: {
        platform: normalized.platform,
        moduleKey: normalized.moduleKey,
        contentKind: normalized.contentKind,
        language: normalized.language,
        version: normalized.version,
      },
    });

    const entity = existing ?? this.contentPackRepo.create();
    entity.platform = normalized.platform;
    entity.moduleKey = normalized.moduleKey;
    entity.contentKind = normalized.contentKind;
    entity.language = normalized.language;
    entity.version = normalized.version;
    entity.hash = normalized.hash;
    entity.sizeBytes = normalized.sizeBytes;
    entity.url = normalized.url;
    entity.minAppVersion = normalized.minAppVersion;
    entity.isActive = normalized.isActive;
    entity.metadata = normalized.metadata;
    entity.publishedAt = normalized.publishedAt;
    const saved = await this.contentPackRepo.save(entity);
    return this.toManifestItem(saved);
  }

  private async queryCandidateRows(query: ManifestQuery): Promise<ContentPackManifest[]> {
    const qb = this.contentPackRepo
      .createQueryBuilder('pack')
      .where('pack.isActive = :isActive', { isActive: true });

    if (query.platform) {
      qb.andWhere('pack.platform = :platform', { platform: query.platform });
    }
    if (query.module) {
      qb.andWhere('pack.moduleKey = :module', { module: query.module });
    }
    if (query.kind) {
      qb.andWhere('pack.contentKind = :kind', { kind: query.kind });
    }
    if (query.language) {
      qb.andWhere('pack.language = :language', { language: query.language });
    }

    const rows = await qb
      .orderBy('pack.publishedAt', 'DESC')
      .addOrderBy('pack.updatedAt', 'DESC')
      .getMany();

    if (!query.appVersion) {
      return rows;
    }
    return rows.filter((row) =>
      this.isAppVersionCompatible(query.appVersion!, row.minAppVersion),
    );
  }

  private pickLatestByKey(rows: ContentPackManifest[]): ContentPackManifest[] {
    const byKey = new Map<string, ContentPackManifest>();
    for (const row of rows) {
      const key = [
        row.platform,
        row.moduleKey,
        row.contentKind,
        row.language,
      ].join('::');
      const current = byKey.get(key);
      if (!current || this.isNewerCandidate(row, current)) {
        byKey.set(key, row);
      }
    }
    return Array.from(byKey.values()).sort((left, right) => {
      if (left.platform !== right.platform) {
        return left.platform.localeCompare(right.platform);
      }
      if (left.moduleKey !== right.moduleKey) {
        return left.moduleKey.localeCompare(right.moduleKey);
      }
      if (left.contentKind !== right.contentKind) {
        return left.contentKind.localeCompare(right.contentKind);
      }
      return left.language.localeCompare(right.language);
    });
  }

  private async resolveManifestRowsForLocalization(
    rows: ContentPackManifest[],
    query: ManifestQuery,
  ): Promise<ManifestResolution[]> {
    if (!query.language || query.language === ContentPacksService.ENGLISH_LANGUAGE) {
      return rows.map((row) => ({ row }));
    }

    const latestByKey = new Map<string, ContentPackManifest>();
    for (const row of rows) {
      latestByKey.set(this.rowIdentityKey(row), row);
    }

    const fallbackCache = new Map<string, ContentPackManifest | null>();

    const resolved = await Promise.all(
      rows.map(async (row): Promise<ManifestResolution> => {
        if (!this.shouldApplyFinesLocalizationScreening(row)) {
          return { row };
        }

        let contaminated = this.isFinesPackMarkedContaminated(row);
        if (!contaminated) {
          contaminated = await this.isLikelyContaminatedFinesPack(row.url, row.language);
        }
        if (!contaminated) {
          return { row };
        }

        const baseKey = this.finesBaseKey(row);
        const englishRowKey = `${baseKey}::${ContentPacksService.ENGLISH_LANGUAGE}`;
        let fallback =
          latestByKey.get(englishRowKey) ??
          (fallbackCache.has(baseKey) ? fallbackCache.get(baseKey) ?? undefined : undefined);
        if (!fallback) {
          const queried = await this.findLatestEnglishFinesRow(row, query.appVersion);
          fallbackCache.set(baseKey, queried);
          fallback = queried ?? undefined;
        }
        if (!fallback) {
          this.logger.warn(
            `Detected contaminated fines pack for language=${row.language} but no English fallback was found (platform=${row.platform}, kind=${row.contentKind})`,
          );
          return { row };
        }

        this.logger.warn(
          `Detected contaminated fines pack language=${row.language}; serving English fallback version=${fallback.version}`,
        );
        return { row: fallback, languageOverride: row.language };
      }),
    );

    return resolved;
  }

  private isNewerCandidate(
    candidate: ContentPackManifest,
    current: ContentPackManifest,
  ): boolean {
    const candidatePublished = candidate.publishedAt.getTime();
    const currentPublished = current.publishedAt.getTime();
    if (candidatePublished !== currentPublished) {
      return candidatePublished > currentPublished;
    }

    const versionCompare = this.compareSemanticVersion(
      candidate.version,
      current.version,
    );
    if (versionCompare !== 0) {
      return versionCompare > 0;
    }
    return candidate.updatedAt.getTime() > current.updatedAt.getTime();
  }

  private toManifestItem(
    row: ContentPackManifest,
    languageOverride?: string,
  ): ManifestItem {
    return {
      id: row.id,
      platform: row.platform,
      module: row.moduleKey,
      kind: row.contentKind,
      language: languageOverride ?? row.language,
      version: row.version,
      hash: row.hash,
      sizeBytes: row.sizeBytes,
      url: row.url,
      minAppVersion: row.minAppVersion,
      publishedAt: row.publishedAt.toISOString(),
      metadata: row.metadata,
    };
  }

  private shouldApplyFinesLocalizationScreening(row: ContentPackManifest): boolean {
    return (
      row.moduleKey === ContentPacksService.FINES_MODULE_KEY &&
      row.contentKind === ContentPacksService.FINES_KIND_KEY &&
      row.language !== ContentPacksService.ENGLISH_LANGUAGE
    );
  }

  private isFinesPackMarkedContaminated(row: ContentPackManifest): boolean {
    if (!row.metadata || typeof row.metadata !== 'object' || Array.isArray(row.metadata)) {
      return false;
    }

    const metadata = row.metadata as Record<string, unknown>;
    if (metadata.localizationContaminated === true) {
      return true;
    }

    const localization = metadata.localization;
    if (
      !localization ||
      typeof localization !== 'object' ||
      Array.isArray(localization)
    ) {
      return false;
    }

    const quality = (localization as Record<string, unknown>).quality;
    if (!quality || typeof quality !== 'object' || Array.isArray(quality)) {
      return false;
    }

    return (quality as Record<string, unknown>).contaminated === true;
  }

  private async isLikelyContaminatedFinesPack(
    url: string,
    language: string,
  ): Promise<boolean> {
    if (!url || language === ContentPacksService.ENGLISH_LANGUAGE) {
      return false;
    }

    const cacheKey = `${language}::${url}`;
    const cached = this.finesPackContaminationCache.get(cacheKey);
    const now = Date.now();
    if (
      cached &&
      now - cached.checkedAtMs < ContentPacksService.FINES_PACK_CHECK_CACHE_TTL_MS
    ) {
      return cached.contaminated;
    }

    let contaminated = false;
    try {
      const response = await axios.get(url, {
        timeout: 5000,
        responseType: 'json',
        validateStatus: (status) => status >= 200 && status < 300,
      });
      const texts = this.extractFinesQuestionTextSegments(response.data);
      const tokenHits = this.countEnglishContaminationTokenHits(texts);
      contaminated = tokenHits >= ContentPacksService.FINES_PACK_MIN_TOKEN_HITS;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to verify fines pack localization at ${url}: ${message}`,
      );
    }

    this.finesPackContaminationCache.set(cacheKey, {
      checkedAtMs: now,
      contaminated,
    });
    return contaminated;
  }

  private extractFinesQuestionTextSegments(payload: unknown): string[] {
    const questions = this.extractFinesQuestions(payload);
    if (questions.length === 0) {
      return [];
    }

    const texts: string[] = [];
    for (const question of questions.slice(
      0,
      ContentPacksService.FINES_PACK_SAMPLE_QUESTION_LIMIT,
    )) {
      if (!question || typeof question !== 'object' || Array.isArray(question)) {
        continue;
      }

      const item = question as Record<string, unknown>;
      const promptCandidate = item.prompt ?? item.question ?? item.questionText;
      if (typeof promptCandidate === 'string' && promptCandidate.trim().length > 0) {
        texts.push(promptCandidate);
      }

      const explanation = item.explanation;
      if (typeof explanation === 'string' && explanation.trim().length > 0) {
        texts.push(explanation);
      }

      const options = item.options;
      if (!Array.isArray(options)) {
        continue;
      }
      for (const option of options) {
        if (typeof option === 'string' && option.trim().length > 0) {
          texts.push(option);
        }
      }
    }

    return texts;
  }

  private extractFinesQuestions(payload: unknown): unknown[] {
    if (Array.isArray(payload)) {
      return payload;
    }

    if (!payload || typeof payload !== 'object') {
      return [];
    }

    const questions = (payload as Record<string, unknown>).questions;
    return Array.isArray(questions) ? questions : [];
  }

  private countEnglishContaminationTokenHits(texts: string[]): number {
    let hits = 0;
    for (const text of texts) {
      const words = text.toLowerCase().match(/[a-z]{3,}/g);
      if (!words) continue;
      for (const word of words) {
        if (this.finesContaminationTokens.has(word)) {
          hits += 1;
        }
      }
    }
    return hits;
  }

  private async findLatestEnglishFinesRow(
    row: ContentPackManifest,
    appVersion?: string,
  ): Promise<ContentPackManifest | null> {
    const candidates = await this.contentPackRepo
      .createQueryBuilder('pack')
      .where('pack.isActive = :isActive', { isActive: true })
      .andWhere('pack.platform = :platform', { platform: row.platform })
      .andWhere('pack.moduleKey = :module', {
        module: ContentPacksService.FINES_MODULE_KEY,
      })
      .andWhere('pack.contentKind = :kind', {
        kind: ContentPacksService.FINES_KIND_KEY,
      })
      .andWhere('pack.language = :language', {
        language: ContentPacksService.ENGLISH_LANGUAGE,
      })
      .orderBy('pack.publishedAt', 'DESC')
      .addOrderBy('pack.updatedAt', 'DESC')
      .getMany();

    if (!appVersion) {
      return candidates[0] ?? null;
    }

    return (
      candidates.find((candidate) =>
        this.isAppVersionCompatible(appVersion, candidate.minAppVersion),
      ) ?? null
    );
  }

  private rowIdentityKey(row: ContentPackManifest): string {
    return [
      row.platform,
      row.moduleKey,
      row.contentKind,
      row.language,
    ].join('::');
  }

  private finesBaseKey(row: ContentPackManifest): string {
    return [row.platform, row.moduleKey, row.contentKind].join('::');
  }

  private normalizeManifestQuery(query: GetContentManifestQueryDto): ManifestQuery {
    return {
      platform: this.normalizeKey(query.platform) ?? undefined,
      module: this.normalizeKey(query.module) ?? undefined,
      kind: this.normalizeKey(query.kind) ?? undefined,
      language: this.normalizeKey(query.language) ?? undefined,
      appVersion: this.normalizeString(query.appVersion) ?? undefined,
    };
  }

  private normalizeUpsertPayload(dto: UpsertContentPackDto) {
    const normalizedPublishedAt = this.normalizeString(dto.publishedAt);
    const platform = this.normalizeKey(dto.platform);
    const moduleKey = this.normalizeKey(dto.module);
    const contentKind = this.normalizeKey(dto.kind);
    const language = this.normalizeKey(dto.language);
    const version = this.normalizeString(dto.version);
    const url = this.normalizeString(dto.url);

    if (!platform || !moduleKey || !contentKind || !language || !version || !url) {
      throw new BadRequestException(
        'platform, module, kind, language, version and url are required',
      );
    }

    return {
      platform,
      moduleKey,
      contentKind,
      language,
      version,
      hash: this.normalizeString(dto.hash),
      sizeBytes: Number.isFinite(dto.sizeBytes) ? Number(dto.sizeBytes) : null,
      url,
      minAppVersion: this.normalizeString(dto.minAppVersion),
      isActive: dto.isActive ?? true,
      metadata: dto.metadata ?? null,
      publishedAt:
        normalizedPublishedAt && !Number.isNaN(Date.parse(normalizedPublishedAt))
          ? new Date(normalizedPublishedAt)
          : new Date(),
    };
  }

  private normalizeString(value: string | null | undefined): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }

  private normalizeKey(value: string | null | undefined): string | null {
    const normalized = this.normalizeString(value);
    return normalized ? normalized.toLowerCase() : null;
  }

  private isAppVersionCompatible(
    appVersion: string,
    minimumVersion: string | null | undefined,
  ): boolean {
    const min = this.normalizeString(minimumVersion);
    if (!min) return true;
    const current = this.normalizeString(appVersion);
    if (!current) return false;
    return this.compareSemanticVersion(current, min) >= 0;
  }

  private compareSemanticVersion(left: string, right: string): number {
    const leftParts = this.versionParts(left);
    const rightParts = this.versionParts(right);
    const max = Math.max(leftParts.length, rightParts.length);
    for (let index = 0; index < max; index += 1) {
      const l = leftParts[index] ?? 0;
      const r = rightParts[index] ?? 0;
      if (l > r) return 1;
      if (l < r) return -1;
    }
    return 0;
  }

  private versionParts(value: string): number[] {
    return value
      .split('.')
      .map((part) => {
        const match = part.trim().match(/^\d+/);
        if (!match) return 0;
        const parsed = Number(match[0]);
        return Number.isFinite(parsed) ? parsed : 0;
      })
      .slice(0, 8);
  }
}
