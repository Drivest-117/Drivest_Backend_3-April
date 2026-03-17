import { BadRequestException, Injectable } from '@nestjs/common';
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

@Injectable()
export class ContentPacksService {
  constructor(
    @InjectRepository(ContentPackManifest)
    private readonly contentPackRepo: Repository<ContentPackManifest>,
  ) {}

  async getManifest(query: GetContentManifestQueryDto) {
    const normalized = this.normalizeManifestQuery(query);
    const rows = await this.queryCandidateRows(normalized);
    const latest = this.pickLatestByKey(rows);
    return {
      generatedAt: new Date().toISOString(),
      platform: normalized.platform ?? null,
      items: latest.map((row) => this.toManifestItem(row)),
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

  private toManifestItem(row: ContentPackManifest): ManifestItem {
    return {
      id: row.id,
      platform: row.platform,
      module: row.moduleKey,
      kind: row.contentKind,
      language: row.language,
      version: row.version,
      hash: row.hash,
      sizeBytes: row.sizeBytes,
      url: row.url,
      minAppVersion: row.minAppVersion,
      publishedAt: row.publishedAt.toISOString(),
      metadata: row.metadata,
    };
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
