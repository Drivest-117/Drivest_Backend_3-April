import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../entities/audit-log.entity';
import {
  AuthenticatedRequestUser,
  normaliseRole,
} from '../instructors/instructors.types';
import {
  MarketplaceLegalSurface,
  MARKETPLACE_LEGAL_SURFACE_ROLE_REQUIREMENTS,
  resolveMarketplaceLegalVersion,
} from './legal-acceptance.constants';
import {
  MarketplaceLegalAcceptanceEntity,
  MarketplaceLegalAcceptanceRole,
} from './entities/marketplace-legal-acceptance.entity';

@Injectable()
export class LegalAcceptanceService {
  constructor(
    @InjectRepository(MarketplaceLegalAcceptanceEntity)
    private readonly legalAcceptanceRepo: Repository<MarketplaceLegalAcceptanceEntity>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async getCurrentAcceptance(
    user: AuthenticatedRequestUser,
    surface: MarketplaceLegalSurface,
  ) {
    const userRole = this.requireSurfaceRole(user, surface);
    const currentVersion = resolveMarketplaceLegalVersion(surface);
    const record = await this.legalAcceptanceRepo.findOne({
      where: {
        userId: user.userId,
        surface,
        version: currentVersion,
      },
      order: {
        acceptedAt: 'DESC',
      },
    });

    return {
      surface,
      currentVersion,
      requiredRole: MARKETPLACE_LEGAL_SURFACE_ROLE_REQUIREMENTS[surface],
      accepted: Boolean(record),
      acceptance: record ? this.mapAcceptance(record) : null,
      userRole,
    };
  }

  async acceptCurrentVersion(
    user: AuthenticatedRequestUser,
    surface: MarketplaceLegalSurface,
    metadata?: Record<string, unknown>,
  ) {
    const userRole = this.requireSurfaceRole(user, surface);
    const currentVersion = resolveMarketplaceLegalVersion(surface);

    const existing = await this.legalAcceptanceRepo.findOne({
      where: {
        userId: user.userId,
        surface,
        version: currentVersion,
      },
      order: {
        acceptedAt: 'DESC',
      },
    });

    if (existing) {
      return {
        surface,
        currentVersion,
        accepted: true,
        alreadyAccepted: true,
        acceptance: this.mapAcceptance(existing),
      };
    }

    const acceptedAt = new Date();
    const acceptance = this.legalAcceptanceRepo.create({
      userId: user.userId,
      userRole,
      surface,
      version: currentVersion,
      acceptedAt,
      metadata: this.normaliseMetadata(metadata),
    });
    const saved = await this.legalAcceptanceRepo.save(acceptance);

    await this.auditRepo.save({
      userId: user.userId,
      action: 'MARKETPLACE_LEGAL_ACCEPTED',
      metadata: {
        eventVersion: 1,
        userRole,
        surface,
        version: currentVersion,
        acceptedAt: acceptedAt.toISOString(),
      },
    });

    return {
      surface,
      currentVersion,
      accepted: true,
      alreadyAccepted: false,
      acceptance: this.mapAcceptance(saved),
    };
  }

  private requireSurfaceRole(
    user: AuthenticatedRequestUser,
    surface: MarketplaceLegalSurface,
  ): MarketplaceLegalAcceptanceRole {
    const role = normaliseRole(user.role);
    const requiredRole = MARKETPLACE_LEGAL_SURFACE_ROLE_REQUIREMENTS[surface];
    if (role !== requiredRole) {
      throw new ForbiddenException(
        `${surface} legal acceptance is only available to ${requiredRole} accounts`,
      );
    }
    return role as MarketplaceLegalAcceptanceRole;
  }

  private normaliseMetadata(
    metadata?: Record<string, unknown>,
  ): Record<string, unknown> | null {
    if (!metadata || typeof metadata !== 'object') {
      return null;
    }
    return metadata;
  }

  private mapAcceptance(record: MarketplaceLegalAcceptanceEntity) {
    return {
      id: record.id,
      surface: record.surface,
      version: record.version,
      userRole: record.userRole,
      acceptedAt: record.acceptedAt,
      createdAt: record.createdAt,
      metadata: record.metadata,
    };
  }
}
