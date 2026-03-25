import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import { AuditLog } from '../../entities/audit-log.entity';
import { User } from '../../entities/user.entity';
import { UpdateConsentsDto } from '../users/dto/update-consents.dto';
import {
  APP_CONSENT_SOURCE_ONBOARDING,
  APP_LEGAL_DEFAULT_DOCUMENTS,
  APP_LEGAL_HEADER_APP_VERSION,
  APP_LEGAL_HEADER_INSTALL_ID,
  APP_LEGAL_HEADER_PLATFORM,
  APP_LEGAL_SOURCE_ONBOARDING,
  AppConsentType,
  AppLegalDocumentType,
} from './legal-acceptance.app.constants';
import { RecordAppLegalAcceptanceDto } from './dto/record-app-legal-acceptance.dto';
import { UpdateAppConsentsDto } from './dto/update-app-consents.dto';
import { ConsentHistoryEntity } from './entities/consent-history.entity';
import { LegalDocumentVersionEntity } from './entities/legal-document-version.entity';
import { UserConsentEntity } from './entities/user-consent.entity';
import { UserLegalAcceptanceEntity } from './entities/user-legal-acceptance.entity';

type AppRequestContext = {
  installIdentifier: string;
  platform: string;
  appVersion: string | null;
  userId: string | null;
};

@Injectable()
export class AppLegalService {
  constructor(
    @InjectRepository(LegalDocumentVersionEntity)
    private readonly legalDocumentsRepo: Repository<LegalDocumentVersionEntity>,
    @InjectRepository(UserLegalAcceptanceEntity)
    private readonly userLegalAcceptancesRepo: Repository<UserLegalAcceptanceEntity>,
    @InjectRepository(UserConsentEntity)
    private readonly userConsentsRepo: Repository<UserConsentEntity>,
    @InjectRepository(ConsentHistoryEntity)
    private readonly consentHistoryRepo: Repository<ConsentHistoryEntity>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    private readonly jwtService: JwtService,
  ) {}

  async getBootstrapState(req: Request) {
    const context = await this.buildRequestContext(req);
    await this.ensureDefaultDocumentsSeeded();
    return this.buildBootstrapState(context);
  }

  async recordLegalAcceptance(req: Request, dto: RecordAppLegalAcceptanceDto) {
    const context = await this.buildRequestContext(req);
    await this.ensureDefaultDocumentsSeeded();
    this.validateBundledAcceptance(dto);

    const documents = await this.getActiveDocumentsMap();
    this.assertRequestedVersionsMatchCurrent(documents, dto);

    const acceptedAt = new Date();
    const acceptance = this.userLegalAcceptancesRepo.create({
      userId: context.userId,
      installIdentifier: context.installIdentifier,
      termsVersion: dto.termsVersion,
      privacyVersion: dto.privacyVersion,
      safetyVersion: dto.safetyVersion,
      acceptedAt,
      sourceScreen: dto.sourceScreen?.trim() || APP_LEGAL_SOURCE_ONBOARDING,
      platform: context.platform,
      appVersion: context.appVersion,
      metadata: {
        ageConfirmed: true,
        safetyAccepted: true,
      },
    });
    await this.userLegalAcceptancesRepo.save(acceptance);

    if (context.userId) {
      await this.usersRepo.update(context.userId, {
        baseAcceptedAt: acceptedAt,
        ageConfirmedAt: acceptedAt,
        safetyAcceptedAt: acceptedAt,
      });
    }

    await this.auditRepo.save({
      userId: context.userId,
      action: 'APP_LEGAL_ACCEPTANCE_RECORDED',
      metadata: {
        installIdentifier: context.installIdentifier,
        platform: context.platform,
        appVersion: context.appVersion,
        termsVersion: acceptance.termsVersion,
        privacyVersion: acceptance.privacyVersion,
        safetyVersion: acceptance.safetyVersion,
        sourceScreen: acceptance.sourceScreen,
      },
    });

    return this.buildBootstrapState(context);
  }

  async updateAppConsents(req: Request, dto: UpdateAppConsentsDto) {
    const context = await this.buildRequestContext(req);
    await this.ensureDefaultDocumentsSeeded();
    await this.applyConsentSnapshot(
      context,
      {
        analyticsChoice: dto.analyticsChoice,
        notificationsChoice: dto.notificationsChoice,
        locationChoice: dto.locationChoice,
      },
      dto.sourceSurface?.trim() || APP_CONSENT_SOURCE_ONBOARDING,
    );
    return this.buildBootstrapState(context);
  }

  async syncAuthenticatedConsentSnapshot(
    req: Request,
    userId: string,
    dto: UpdateConsentsDto,
  ) {
    const context = await this.buildRequestContext(req, userId);
    await this.ensureDefaultDocumentsSeeded();

    if (dto.baseAcceptedAt || dto.ageConfirmedAt || dto.safetyAcceptedAt) {
      const documents = await this.getActiveDocumentsMap();
      const acceptedAt = new Date();
      const acceptance = this.userLegalAcceptancesRepo.create({
        userId,
        installIdentifier: context.installIdentifier,
        termsVersion: documents.terms.version,
        privacyVersion: documents.privacy.version,
        safetyVersion: documents.safety_notice.version,
        acceptedAt,
        sourceScreen: dto.sourceSurface?.trim() || 'me/consents',
        platform: context.platform,
        appVersion: context.appVersion,
        metadata: {
          migratedFromLegacyConsentPayload: true,
          clientBaseAcceptedAt: dto.baseAcceptedAt ?? null,
          clientAgeConfirmedAt: dto.ageConfirmedAt ?? null,
          clientSafetyAcceptedAt: dto.safetyAcceptedAt ?? null,
        },
      });
      await this.userLegalAcceptancesRepo.save(acceptance);
      await this.usersRepo.update(userId, {
        baseAcceptedAt: acceptedAt,
        ageConfirmedAt: acceptedAt,
        safetyAcceptedAt: acceptedAt,
      });
    }

    await this.applyConsentSnapshot(
      context,
      {
        analyticsChoice: dto.analyticsChoice,
        notificationsChoice: dto.notificationsChoice,
        locationChoice: dto.locationChoice,
      },
      dto.sourceSurface?.trim() || 'me/consents',
    );
  }

  private async applyConsentSnapshot(
    context: AppRequestContext,
    choices: {
      analyticsChoice?: 'allow' | 'skip';
      notificationsChoice?: 'enable' | 'skip';
      locationChoice?: 'allow' | 'deny' | 'skip';
    },
    sourceSurface: string,
  ) {
    const consentEntries = [
      {
        consentType: 'analytics' as const,
        choice: choices.analyticsChoice,
      },
      {
        consentType: 'notifications' as const,
        choice: choices.notificationsChoice,
      },
      {
        consentType: 'location' as const,
        choice: choices.locationChoice,
      },
    ].filter((entry) => entry.choice != null);

    if (consentEntries.length === 0) {
      throw new BadRequestException('At least one consent choice must be provided');
    }

    const updatedAt = new Date();
    const userUpdate: Partial<User> = {};

    for (const entry of consentEntries) {
      const currentState = await this.userConsentsRepo.findOne({
        where: {
          installIdentifier: context.installIdentifier,
          consentType: entry.consentType,
        },
      });

      const payload = {
        userId: context.userId,
        installIdentifier: context.installIdentifier,
        consentType: entry.consentType,
        choice: entry.choice!,
        updatedAt,
        sourceSurface,
        platform: context.platform,
        appVersion: context.appVersion,
        metadata: null,
      };

      if (currentState) {
        currentState.userId = context.userId ?? currentState.userId;
        currentState.choice = payload.choice;
        currentState.updatedAt = updatedAt;
        currentState.sourceSurface = sourceSurface;
        currentState.platform = context.platform;
        currentState.appVersion = context.appVersion;
        currentState.metadata = null;
        await this.userConsentsRepo.save(currentState);
      } else {
        await this.userConsentsRepo.save(this.userConsentsRepo.create(payload));
      }

      await this.consentHistoryRepo.save(
        this.consentHistoryRepo.create({
          ...payload,
          changedAt: updatedAt,
        }),
      );

      switch (entry.consentType) {
        case 'analytics':
          userUpdate.analyticsChoice = payload.choice as User['analyticsChoice'];
          userUpdate.analyticsAt = updatedAt;
          break;
        case 'notifications':
          userUpdate.notificationsChoice = payload.choice as User['notificationsChoice'];
          userUpdate.notificationsAt = updatedAt;
          break;
        case 'location':
          userUpdate.locationChoice = payload.choice as User['locationChoice'];
          userUpdate.locationAt = updatedAt;
          break;
      }
    }

    if (context.userId && Object.keys(userUpdate).length > 0) {
      await this.usersRepo.update(context.userId, userUpdate);
    }

    await this.auditRepo.save({
      userId: context.userId,
      action: 'APP_CONSENT_SNAPSHOT_RECORDED',
      metadata: {
        installIdentifier: context.installIdentifier,
        platform: context.platform,
        appVersion: context.appVersion,
        sourceSurface,
        choices: consentEntries.map((entry) => ({
          consentType: entry.consentType,
          choice: entry.choice,
        })),
      },
    });
  }

  private async buildBootstrapState(context: AppRequestContext) {
    const documents = await this.getActiveDocumentsMap();
    const latestAcceptance =
      (await this.userLegalAcceptancesRepo.findOne({
        where: { installIdentifier: context.installIdentifier },
        order: { acceptedAt: 'DESC', createdAt: 'DESC' },
      })) ??
      (context.userId
        ? await this.userLegalAcceptancesRepo.findOne({
            where: { userId: context.userId },
            order: { acceptedAt: 'DESC', createdAt: 'DESC' },
          })
        : null);

    const currentConsentRows = await this.userConsentsRepo.find({
      where: { installIdentifier: context.installIdentifier },
    });

    const currentConsents = currentConsentRows.reduce<Record<string, Record<string, unknown>>>(
      (acc, row) => {
        acc[row.consentType] = {
          choice: row.choice,
          updatedAt: row.updatedAt.toISOString(),
          sourceSurface: row.sourceSurface,
        };
        return acc;
      },
      {},
    );

    return {
      installIdentifier: context.installIdentifier,
      platform: context.platform,
      appVersion: context.appVersion,
      legalDocuments: {
        terms: this.serializeDocument(documents.terms),
        privacy: this.serializeDocument(documents.privacy),
        safetyNotice: this.serializeDocument(documents.safety_notice),
      },
      acceptance: latestAcceptance
        ? {
            acceptedAt: latestAcceptance.acceptedAt.toISOString(),
            termsVersion: latestAcceptance.termsVersion,
            privacyVersion: latestAcceptance.privacyVersion,
            safetyVersion: latestAcceptance.safetyVersion,
            sourceScreen: latestAcceptance.sourceScreen,
            isCurrent:
              latestAcceptance.termsVersion === documents.terms.version &&
              latestAcceptance.privacyVersion === documents.privacy.version &&
              latestAcceptance.safetyVersion === documents.safety_notice.version,
          }
        : null,
      consents: {
        analytics: currentConsents.analytics ?? null,
        notifications: currentConsents.notifications ?? null,
        location: currentConsents.location ?? null,
      },
    };
  }

  private serializeDocument(document: LegalDocumentVersionEntity) {
    return {
      type: document.documentType,
      version: document.version,
      contentHash: document.contentHash,
      publicationTimestamp: document.publicationTimestamp.toISOString(),
      isActive: document.isActive,
      metadata: document.metadata ?? {},
    };
  }

  private validateBundledAcceptance(dto: RecordAppLegalAcceptanceDto) {
    if (dto.ageConfirmed === false) {
      throw new BadRequestException('Age confirmation is required');
    }
    if (dto.safetyAccepted === false) {
      throw new BadRequestException('Safety acknowledgement is required');
    }
  }

  private assertRequestedVersionsMatchCurrent(
    documents: Record<AppLegalDocumentType, LegalDocumentVersionEntity>,
    dto: RecordAppLegalAcceptanceDto,
  ) {
    if (dto.termsVersion !== documents.terms.version) {
      throw new BadRequestException('Terms version is not current');
    }
    if (dto.privacyVersion !== documents.privacy.version) {
      throw new BadRequestException('Privacy version is not current');
    }
    if (dto.safetyVersion !== documents.safety_notice.version) {
      throw new BadRequestException('Safety version is not current');
    }
  }

  private async ensureDefaultDocumentsSeeded() {
    for (const document of APP_LEGAL_DEFAULT_DOCUMENTS) {
      const existing = await this.legalDocumentsRepo.findOne({
        where: {
          documentType: document.documentType,
          version: document.version,
        },
      });
      if (existing) {
        if (!existing.isActive || existing.contentHash !== document.contentHash) {
          existing.isActive = true;
          existing.contentHash = document.contentHash;
          existing.publicationTimestamp = new Date(document.publicationTimestamp);
          existing.metadata = document.metadata;
          await this.legalDocumentsRepo.save(existing);
        }
        continue;
      }

      await this.legalDocumentsRepo.save(
        this.legalDocumentsRepo.create({
          documentType: document.documentType,
          version: document.version,
          contentHash: document.contentHash,
          publicationTimestamp: new Date(document.publicationTimestamp),
          isActive: true,
          metadata: document.metadata,
        }),
      );
    }
  }

  private async getActiveDocumentsMap(): Promise<Record<AppLegalDocumentType, LegalDocumentVersionEntity>> {
    const rows = await this.legalDocumentsRepo.find({
      where: { isActive: true },
      order: {
        publicationTimestamp: 'DESC',
        createdAt: 'DESC',
      },
    });

    const map = rows.reduce<Partial<Record<AppLegalDocumentType, LegalDocumentVersionEntity>>>(
      (acc, row) => {
        if (!acc[row.documentType]) {
          acc[row.documentType] = row;
        }
        return acc;
      },
      {},
    );

    if (!map.terms || !map.privacy || !map.safety_notice) {
      throw new BadRequestException('Legal document registry is incomplete');
    }
    return map as Record<AppLegalDocumentType, LegalDocumentVersionEntity>;
  }

  private async buildRequestContext(
    req: Request,
    userIdOverride?: string | null,
  ): Promise<AppRequestContext> {
    const installIdentifier = this.readHeader(req, APP_LEGAL_HEADER_INSTALL_ID);
    if (!installIdentifier) {
      throw new BadRequestException(`Missing ${APP_LEGAL_HEADER_INSTALL_ID} header`);
    }

    const platform = this.readHeader(req, APP_LEGAL_HEADER_PLATFORM) || 'unknown';
    const appVersion = this.readHeader(req, APP_LEGAL_HEADER_APP_VERSION) || null;
    const userId = userIdOverride ?? (await this.resolveUserIdFromAuthorizationHeader(req));

    return {
      installIdentifier,
      platform,
      appVersion,
      userId,
    };
  }

  private async resolveUserIdFromAuthorizationHeader(req: Request): Promise<string | null> {
    const authorization = req.headers.authorization?.trim();
    if (!authorization?.toLowerCase().startsWith('bearer ')) {
      return null;
    }

    const token = authorization.slice(7).trim();
    if (!token) {
      return null;
    }

    try {
      const payload = await this.jwtService.verifyAsync(token);
      return typeof payload?.sub === 'string' && payload.sub.trim()
        ? payload.sub.trim()
        : null;
    } catch {
      return null;
    }
  }

  private readHeader(req: Request, headerName: string): string | null {
    const raw = req.headers[headerName];
    if (Array.isArray(raw)) {
      return raw[0]?.trim() || null;
    }
    if (typeof raw === 'string') {
      const value = raw.trim();
      return value.length > 0 ? value : null;
    }
    return null;
  }
}

