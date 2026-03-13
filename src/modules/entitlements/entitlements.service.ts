import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entitlement, EntitlementScope } from '../../entities/entitlement.entity';
import { User } from '../../entities/user.entity';
import { TestCentre } from '../../entities/test-centre.entity';
import { AccessOverridesService } from '../access-overrides/access-overrides.service';

@Injectable()
export class EntitlementsService {
  private readonly entitlementsEnforced = this.envBool(
    'APP_ENTITLEMENTS_ENFORCED',
    false,
  );

  constructor(
    @InjectRepository(Entitlement)
    private entRepo: Repository<Entitlement>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(TestCentre)
    private centreRepo: Repository<TestCentre>,
    private readonly accessOverrides: AccessOverridesService,
  ) {}

  async userEntitlements(userId: string) {
    await this.accessOverrides.applyToUserId(userId);
    await this.ensureWhitelist(userId);
    return this.entRepo
      .createQueryBuilder('ent')
      .where('ent.userId = :userId', { userId })
      .andWhere('ent.isActive = true')
      .andWhere('(ent.endsAt IS NULL OR ent.endsAt > :now)', { now: new Date() })
      .orderBy('ent.endsAt', 'ASC')
      .getMany();
  }

  async hasAccess(userId: string, centreId: string): Promise<boolean> {
    await this.accessOverrides.applyToUserId(userId);
    if (!this.entitlementsEnforced) {
      return true;
    }
    await this.ensureWhitelist(userId);
    const qb = this.entRepo
      .createQueryBuilder('ent')
      .where('ent.userId = :userId', { userId })
      .andWhere('ent.isActive = true')
      .andWhere('(ent.endsAt IS NULL OR ent.endsAt > :now)', { now: new Date() })
      .andWhere(
        '(ent.scope = :global OR (ent.scope = :centre AND ent.centreId = :centreId))',
        { global: EntitlementScope.GLOBAL, centre: EntitlementScope.CENTRE, centreId },
      )
      .limit(1);
    const entitlement = await qb.getOne();
    return Boolean(entitlement);
  }

  async selectCentreForPractice(userId: string, centreIdOrSlug: string) {
    await this.accessOverrides.applyToUserId(userId);
    await this.ensureWhitelist(userId);
    const centre = await this.resolveCentre(centreIdOrSlug);
    if (!centre) {
      throw new NotFoundException('Test centre not found');
    }

    if (!this.entitlementsEnforced) {
      return {
        userId,
        selectedCentre: {
          id: centre.id,
          slug: centre.slug,
          name: centre.name,
        },
        entitlementId: null,
        endsAt: null,
      };
    }

    const activeGlobal = await this.entRepo
      .createQueryBuilder('ent')
      .where('ent.userId = :userId', { userId })
      .andWhere('ent.scope = :scope', { scope: EntitlementScope.GLOBAL })
      .andWhere('ent.isActive = true')
      .andWhere('(ent.endsAt IS NULL OR ent.endsAt > :now)', { now: new Date() })
      .orderBy('ent.endsAt', 'DESC', 'NULLS FIRST')
      .getOne();

    if (!activeGlobal) {
      const activeCentre = await this.entRepo
        .createQueryBuilder('ent')
        .where('ent.userId = :userId', { userId })
        .andWhere('ent.scope = :scope', { scope: EntitlementScope.CENTRE })
        .andWhere('ent.centreId = :centreId', { centreId: centre.id })
        .andWhere('ent.isActive = true')
        .andWhere('(ent.endsAt IS NULL OR ent.endsAt > :now)', { now: new Date() })
        .orderBy('ent.endsAt', 'DESC', 'NULLS FIRST')
        .getOne();

      if (activeCentre) {
        return {
          userId,
          selectedCentre: {
            id: centre.id,
            slug: centre.slug,
            name: centre.name,
          },
          entitlementId: activeCentre.id,
          endsAt: activeCentre.endsAt,
        };
      }

      throw new ForbiddenException(
        'Active subscription is required to select a practice centre',
      );
    }

    await this.entRepo
      .createQueryBuilder()
      .update(Entitlement)
      .set({ isActive: false })
      .where('userId = :userId', { userId })
      .andWhere('scope = :scope', { scope: EntitlementScope.CENTRE })
      .andWhere('sourcePurchaseId IS NULL')
      .execute();

    const selected = this.entRepo.create({
      userId,
      scope: EntitlementScope.CENTRE,
      centreId: centre.id,
      startsAt: new Date(),
      endsAt: activeGlobal.endsAt ?? null,
      isActive: true,
      sourcePurchaseId: null,
    });
    await this.entRepo.save(selected);

    return {
      userId,
      selectedCentre: {
        id: centre.id,
        slug: centre.slug,
        name: centre.name,
      },
      entitlementId: selected.id,
      endsAt: selected.endsAt,
    };
  }

  private looksLikeUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value.trim(),
    );
  }

  private async resolveCentre(idOrSlug: string): Promise<TestCentre | null> {
    const key = String(idOrSlug || '').trim();
    if (!key) return null;

    if (this.looksLikeUuid(key)) {
      const byId = await this.centreRepo.findOne({ where: { id: key } });
      if (byId) return byId;
    }

    const normalized = key.toLowerCase();
    return this.centreRepo
      .createQueryBuilder('centre')
      .where('LOWER(centre.slug) = :slug', { slug: normalized })
      .orWhere('LOWER(centre.name) LIKE :namePrefix', {
        namePrefix: `${normalized.replace(/-/g, ' ')}%`,
      })
      .orderBy('centre.createdAt', 'ASC')
      .getOne();
  }

  private async ensureWhitelist(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || !user.email) return;
    const whitelistEnv = process.env.WHITELIST_EMAILS || '';
    const whitelist = whitelistEnv
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (!whitelist.length || !whitelist.includes(user.email.toLowerCase())) return;

    const existing = await this.entRepo.findOne({
      where: { userId: user.id, scope: EntitlementScope.GLOBAL, isActive: true },
    });
    if (existing) return;

    await this.entRepo.save(
      this.entRepo.create({
        userId: user.id,
        scope: EntitlementScope.GLOBAL,
        centreId: null,
        startsAt: new Date(),
        endsAt: null,
        isActive: true,
        sourcePurchaseId: null,
      }),
    );
  }

  private envBool(key: string, fallback: boolean): boolean {
    const raw = process.env[key];
    if (raw == null || raw === '') return fallback;
    const normalized = raw.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return fallback;
  }
}
