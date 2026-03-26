import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entitlement, EntitlementScope } from '../../entities/entitlement.entity';
import { User } from '../../entities/user.entity';
import { TestCentre } from '../../entities/test-centre.entity';
import { AccessOverridesService } from '../access-overrides/access-overrides.service';
import { Product, ProductPeriod, ProductType } from '../../entities/product.entity';
import { Purchase, PurchaseProvider, PurchaseStatus } from '../../entities/purchase.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { ActivateApplePurchaseDto } from './dto/activate-apple-purchase.dto';

type AppPurchaseKind =
  | 'practice_monthly'
  | 'navigation_yearly'
  | 'annual_bundle';

@Injectable()
export class EntitlementsService {
  private readonly entitlementsEnforced = this.envBool(
    'APP_ENTITLEMENTS_ENFORCED',
    true,
  );
  private readonly monthlyPlanPricePence = this.envInt(
    'APP_PLAN_PRACTICE_MONTHLY_PENCE',
    1299,
  );
  private readonly monthlyPlanCurrency = process.env.APP_PLAN_PRACTICE_MONTHLY_CURRENCY || 'GBP';
  private readonly monthlyPlanInterval = process.env.APP_PLAN_PRACTICE_MONTHLY_INTERVAL || 'month';
  private readonly monthlyPlanProductId =
    process.env.APP_PLAN_PRACTICE_MONTHLY_PRODUCT_ID ||
    'drivest.practice.monthly.selected_centre.gbp12.99';
  private readonly navigationYearlyPricePence = this.envInt(
    'APP_PLAN_NAVIGATION_YEARLY_PENCE',
    this.envInt('APP_PLAN_NAVIGATION_MONTHLY_PENCE', 1999),
  );
  private readonly navigationYearlyCurrency =
    process.env.APP_PLAN_NAVIGATION_YEARLY_CURRENCY ||
    process.env.APP_PLAN_NAVIGATION_MONTHLY_CURRENCY ||
    'GBP';
  private readonly navigationYearlyInterval =
    process.env.APP_PLAN_NAVIGATION_YEARLY_INTERVAL || 'year';
  private readonly navigationYearlyProductId =
    process.env.APP_PLAN_NAVIGATION_YEARLY_PRODUCT_ID ||
    process.env.APP_PLAN_NAVIGATION_MONTHLY_PRODUCT_ID ||
    'drivest.navigation.only.gbp19_99.yearly';
  private readonly annualBundlePricePence = this.envInt(
    'APP_PLAN_ANNUAL_BUNDLE_PENCE',
    this.envInt('APP_PLAN_NAVIGATION_BUNDLE_PENCE', 2999),
  );
  private readonly annualBundleCurrency =
    process.env.APP_PLAN_ANNUAL_BUNDLE_CURRENCY ||
    process.env.APP_PLAN_NAVIGATION_BUNDLE_CURRENCY ||
    'GBP';
  private readonly annualBundleProductId =
    process.env.APP_PLAN_ANNUAL_BUNDLE_PRODUCT_ID ||
    process.env.APP_PLAN_NAVIGATION_BUNDLE_PRODUCT_ID ||
    'drivest.annual.bundle.gbp29_99.yearly';
  private readonly annualBundleNavigationMonths = this.envInt(
    'APP_PLAN_ANNUAL_BUNDLE_NAV_MONTHS',
    this.envInt('APP_PLAN_NAVIGATION_BUNDLE_NAV_MONTHS', 12),
  );
  private readonly annualBundleCentreMonths = this.envInt(
    'APP_PLAN_ANNUAL_BUNDLE_CENTRE_MONTHS',
    this.envInt('APP_PLAN_NAVIGATION_BUNDLE_CENTRE_MONTHS', 1),
  );
  private readonly allowDirectSubscribeEndpoints = this.envBool(
    'APP_DIRECT_SUBSCRIBE_ENABLED',
    true,
  );

  constructor(
    @InjectRepository(Entitlement)
    private entRepo: Repository<Entitlement>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(TestCentre)
    private centreRepo: Repository<TestCentre>,
    @InjectRepository(Product)
    private productRepo: Repository<Product>,
    @InjectRepository(Purchase)
    private purchaseRepo: Repository<Purchase>,
    @InjectRepository(AuditLog)
    private auditRepo: Repository<AuditLog>,
    private readonly accessOverrides: AccessOverridesService,
  ) {}

  async appAccessState(userId: string) {
    await this.accessOverrides.applyToUserId(userId);
    await this.ensureWhitelist(userId);
    const user = await this.getUserOrThrow(userId);
    const activeEntitlements = await this.listActiveEntitlements(userId);
    const now = new Date();
    const hasGlobalAccess = activeEntitlements.some(
      (entitlement) => entitlement.scope === EntitlementScope.GLOBAL,
    );
    const centreEntitlements = activeEntitlements.filter(
      (entitlement) => entitlement.scope === EntitlementScope.CENTRE && entitlement.centreId,
    );
    const activeCentreIds = Array.from(
      new Set(
        centreEntitlements
          .map((entitlement) => entitlement.centreId)
          .filter((centreId): centreId is string => Boolean(centreId)),
      ),
    );
    const accessibleCentreIds = hasGlobalAccess
      ? (await this.centreRepo.find({ select: { id: true } })).map((centre) => centre.id)
      : activeCentreIds;
    const role = user.role || 'USER';
    const hasNavigationAccess =
      role === 'ADMIN' ||
      Boolean(user.navigationAccessUntil && user.navigationAccessUntil > now);
    const hasActiveSubscription =
      role === 'ADMIN' ||
      activeEntitlements.some((entitlement) =>
        [EntitlementScope.GLOBAL, EntitlementScope.CENTRE].includes(entitlement.scope),
      );

    return {
      userId: user.id,
      role,
      hasPracticeAccess: !this.entitlementsEnforced || role === 'ADMIN' || hasActiveSubscription,
      hasActiveSubscription,
      hasGlobalAccess,
      hasNavigationAccess,
      navigationAccessUntil: user.navigationAccessUntil ?? null,
      accessibleCentreIds,
      entitlementsEnforced: this.entitlementsEnforced,
      practiceMonthlyPlan: {
        amountPence: this.monthlyPlanPricePence,
        currencyCode: this.monthlyPlanCurrency,
        interval: this.monthlyPlanInterval,
        productId: this.monthlyPlanProductId,
      },
      navigationYearlyPlan: {
        amountPence: this.navigationYearlyPricePence,
        currencyCode: this.navigationYearlyCurrency,
        interval: this.navigationYearlyInterval,
        productId: this.navigationYearlyProductId,
      },
      annualBundlePlan: {
        amountPence: this.annualBundlePricePence,
        currencyCode: this.annualBundleCurrency,
        navigationDurationMonths: this.annualBundleNavigationMonths,
        centreDurationMonths: this.annualBundleCentreMonths,
        productId: this.annualBundleProductId,
      },
    };
  }

  async subscribeMonthly(userId: string, centreIdOrSlug: string) {
    this.ensureDirectSubscribeEnabled();
    const centre = await this.requireCentre(centreIdOrSlug);
    const product = await this.ensurePracticeMonthlyProduct();
    const purchase = await this.createPurchase(userId, product, PurchaseProvider.INTERNAL);
    const startsAt = new Date();
    const endsAt = this.addMonthsFromAnchor(startsAt, 1);
    await this.entRepo.save(
      this.entRepo.create({
        userId,
        scope: EntitlementScope.CENTRE,
        centreId: centre.id,
        startsAt,
        endsAt,
        isActive: true,
        sourcePurchaseId: purchase.id,
      }),
    );
    await this.auditRepo.save({
      userId,
      action: 'APP_PRACTICE_SUBSCRIBED',
      metadata: { centreId: centre.id, purchaseId: purchase.id, productId: product.iosProductId },
    });
    return this.appAccessState(userId);
  }

  async subscribeNavigationMonthly(userId: string) {
    this.ensureDirectSubscribeEnabled();
    const product = await this.ensureNavigationYearlyProduct();
    const purchase = await this.createPurchase(userId, product, PurchaseProvider.INTERNAL);
    await this.extendNavigationAccess(userId, 12);
    await this.auditRepo.save({
      userId,
      action: 'APP_NAVIGATION_YEARLY_SUBSCRIBED',
      metadata: { purchaseId: purchase.id, productId: product.iosProductId },
    });
    return this.appAccessState(userId);
  }

  async subscribeNavigationBundle(userId: string, centreIdOrSlug: string) {
    this.ensureDirectSubscribeEnabled();
    const centre = await this.requireCentre(centreIdOrSlug);
    const product = await this.ensureAnnualBundleProduct();
    const purchase = await this.createPurchase(userId, product, PurchaseProvider.INTERNAL);
    await this.extendNavigationAccess(userId, this.annualBundleNavigationMonths);
    await this.entRepo.save(
      this.entRepo.create({
        userId,
        scope: EntitlementScope.CENTRE,
        centreId: centre.id,
        startsAt: new Date(),
        endsAt: this.addMonthsFromAnchor(new Date(), this.annualBundleCentreMonths),
        isActive: true,
        sourcePurchaseId: purchase.id,
      }),
    );
    await this.auditRepo.save({
      userId,
      action: 'APP_ANNUAL_BUNDLE_SUBSCRIBED',
      metadata: { centreId: centre.id, purchaseId: purchase.id, productId: product.iosProductId },
    });
    return this.appAccessState(userId);
  }

  async cancelMonthlySubscription(userId: string) {
    const products = await Promise.all([
      this.ensurePracticeMonthlyProduct(),
      this.ensureNavigationYearlyProduct(),
      this.ensureAnnualBundleProduct(),
    ]);
    const productIds = products.map((product) => product.id);
    const purchases = await this.purchaseRepo.find({
      where: { userId, status: PurchaseStatus.COMPLETED },
    });
    const purchaseIds = purchases
      .filter(
        (purchase) =>
          productIds.includes(purchase.productId) &&
          [PurchaseProvider.APPLE, PurchaseProvider.INTERNAL].includes(purchase.provider),
      )
      .map((purchase) => purchase.id);
    if (purchaseIds.length) {
      await this.purchaseRepo
        .createQueryBuilder()
        .update(Purchase)
        .set({ status: PurchaseStatus.CANCELED })
        .whereInIds(purchaseIds)
        .execute();
      await this.entRepo
        .createQueryBuilder()
        .update(Entitlement)
        .set({ isActive: false, endsAt: new Date() })
        .where('userId = :userId', { userId })
        .andWhere('sourcePurchaseId IN (:...purchaseIds)', { purchaseIds })
        .execute();
    }
    await this.userRepo.update(userId, { navigationAccessUntil: null });
    await this.auditRepo.save({
      userId,
      action: 'APP_SUBSCRIPTION_CANCELLED',
      metadata: { cancelledPurchaseIds: purchaseIds },
    });
    return this.appAccessState(userId);
  }

  async activateApplePurchase(userId: string, dto: ActivateApplePurchaseDto) {
    const kind = this.resolveAppPurchaseKind(dto.productId);
    const user = await this.getUserOrThrow(userId);
    const existing = await this.purchaseRepo.findOne({
      where: { transactionId: dto.transactionId },
    });
    if (existing) {
      if (existing.userId !== userId) {
        throw new ForbiddenException('Purchase belongs to another user');
      }
      return this.appAccessState(userId);
    }

    if (kind === 'practice_monthly' && !dto.centreId) {
      throw new BadRequestException('centreId is required for selected-centre practice activation');
    }
    if (kind === 'annual_bundle' && !dto.centreId) {
      throw new BadRequestException('centreId is required for annual bundle activation');
    }

    let product: Product;
    if (kind === 'practice_monthly') {
      product = await this.ensurePracticeMonthlyProduct();
    } else if (kind === 'navigation_yearly') {
      product = await this.ensureNavigationYearlyProduct();
    } else {
      product = await this.ensureAnnualBundleProduct();
    }

    const purchasedAt = dto.purchasedAt ? new Date(dto.purchasedAt) : new Date();
    const purchase = this.purchaseRepo.create({
      userId: user.id,
      productId: product.id,
      provider: PurchaseProvider.APPLE,
      status: PurchaseStatus.COMPLETED,
      transactionId: dto.transactionId,
      purchasedAt,
      rawEvent: {
        originalTransactionId: dto.originalTransactionId ?? null,
        environment: dto.environment ?? null,
        expiresAt: dto.expiresAt ?? null,
        isRestore: dto.isRestore ?? false,
      },
    });
    const savedPurchase = await this.purchaseRepo.save(purchase);

    if (kind === 'practice_monthly') {
      const centre = await this.requireCentre(dto.centreId!);
      await this.entRepo.save(
        this.entRepo.create({
          userId,
          scope: EntitlementScope.CENTRE,
          centreId: centre.id,
          startsAt: purchasedAt,
          endsAt: dto.expiresAt
            ? new Date(dto.expiresAt)
            : this.addMonthsFromAnchor(purchasedAt, 1),
          isActive: true,
          sourcePurchaseId: savedPurchase.id,
        }),
      );
    } else if (kind === 'navigation_yearly') {
      await this.extendNavigationAccess(
        userId,
        12,
        dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      );
    } else {
      const centre = await this.requireCentre(dto.centreId!);
      await this.extendNavigationAccess(
        userId,
        this.annualBundleNavigationMonths,
        dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      );
      await this.entRepo.save(
        this.entRepo.create({
          userId,
          scope: EntitlementScope.CENTRE,
          centreId: centre.id,
          startsAt: purchasedAt,
          endsAt: this.addMonthsFromAnchor(purchasedAt, this.annualBundleCentreMonths),
          isActive: true,
          sourcePurchaseId: savedPurchase.id,
        }),
      );
    }

    await this.auditRepo.save({
      userId,
      action: 'APPLE_PURCHASE_ACTIVATED',
      metadata: {
        transactionId: dto.transactionId,
        productId: dto.productId,
        purchaseId: savedPurchase.id,
      },
    });
    return this.appAccessState(userId);
  }

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
    const centre = await this.requireCentre(centreIdOrSlug);

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

  private async listActiveEntitlements(userId: string): Promise<Entitlement[]> {
    return this.entRepo
      .createQueryBuilder('ent')
      .where('ent.userId = :userId', { userId })
      .andWhere('ent.isActive = true')
      .andWhere('(ent.endsAt IS NULL OR ent.endsAt > :now)', { now: new Date() })
      .orderBy('ent.endsAt', 'ASC')
      .getMany();
  }

  private async getUserOrThrow(userId: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  private async requireCentre(centreIdOrSlug: string): Promise<TestCentre> {
    const centre = await this.resolveCentre(centreIdOrSlug);
    if (!centre) {
      throw new NotFoundException('Test centre not found');
    }
    return centre;
  }

  private resolveAppPurchaseKind(productIdRaw: string): AppPurchaseKind {
    const productId = String(productIdRaw ?? '').trim();
    if (productId === this.monthlyPlanProductId) return 'practice_monthly';
    if (productId === this.navigationYearlyProductId) return 'navigation_yearly';
    if (productId === this.annualBundleProductId) return 'annual_bundle';
    throw new BadRequestException('Unsupported app productId');
  }

  private ensureDirectSubscribeEnabled() {
    if (!this.allowDirectSubscribeEndpoints) {
      throw new ForbiddenException('Direct subscribe endpoints are disabled');
    }
  }

  private addMonthsFromAnchor(anchor: Date, months: number) {
    const next = new Date(anchor);
    next.setMonth(next.getMonth() + months);
    return next;
  }

  private async extendNavigationAccess(
    userId: string,
    months: number,
    absoluteEndsAt?: Date,
  ) {
    const user = await this.getUserOrThrow(userId);
    const now = new Date();
    const nextAccessUntil =
      absoluteEndsAt ??
      this.addMonthsFromAnchor(
        user.navigationAccessUntil && user.navigationAccessUntil > now
          ? user.navigationAccessUntil
          : now,
        months,
      );
    await this.userRepo.update(userId, { navigationAccessUntil: nextAccessUntil });
  }

  private async createPurchase(
    userId: string,
    product: Product,
    provider: PurchaseProvider,
  ): Promise<Purchase> {
    const purchase = this.purchaseRepo.create({
      userId,
      productId: product.id,
      provider,
      status: PurchaseStatus.COMPLETED,
      transactionId: `${provider.toLowerCase()}:${product.iosProductId}:${userId}:${Date.now()}`,
      purchasedAt: new Date(),
      rawEvent: { source: 'app-direct' },
    });
    return this.purchaseRepo.save(purchase);
  }

  private async ensurePracticeMonthlyProduct(): Promise<Product> {
    return this.ensureProduct({
      iosProductId: this.monthlyPlanProductId,
      androidProductId: this.monthlyPlanProductId,
      type: ProductType.SUBSCRIPTION,
      pricePence: this.monthlyPlanPricePence,
      period: ProductPeriod.MONTH,
      metadata: {
        label: 'Practice selected centre monthly',
        currencyCode: this.monthlyPlanCurrency,
      },
    });
  }

  private async ensureNavigationYearlyProduct(): Promise<Product> {
    return this.ensureProduct({
      iosProductId: this.navigationYearlyProductId,
      androidProductId: this.navigationYearlyProductId,
      type: ProductType.SUBSCRIPTION,
      pricePence: this.navigationYearlyPricePence,
      period: ProductPeriod.YEAR,
      metadata: {
        label: 'Navigation yearly',
        currencyCode: this.navigationYearlyCurrency,
      },
    });
  }

  private async ensureAnnualBundleProduct(): Promise<Product> {
    return this.ensureProduct({
      iosProductId: this.annualBundleProductId,
      androidProductId: this.annualBundleProductId,
      type: ProductType.SUBSCRIPTION,
      pricePence: this.annualBundlePricePence,
      period: ProductPeriod.YEAR,
      metadata: {
        label: 'Annual bundle',
        currencyCode: this.annualBundleCurrency,
        navigationDurationMonths: this.annualBundleNavigationMonths,
        centreDurationMonths: this.annualBundleCentreMonths,
      },
    });
  }

  private async ensureProduct(input: {
    iosProductId: string;
    androidProductId: string;
    type: ProductType;
    pricePence: number;
    period: ProductPeriod;
    metadata: Record<string, unknown>;
  }): Promise<Product> {
    const existing = await this.productRepo.findOne({
      where: [{ iosProductId: input.iosProductId }, { androidProductId: input.androidProductId }],
    });
    if (existing) {
      existing.type = input.type;
      existing.pricePence = input.pricePence;
      existing.period = input.period;
      existing.active = true;
      existing.metadata = input.metadata;
      return this.productRepo.save(existing);
    }
    return this.productRepo.save(
      this.productRepo.create({
        ...input,
        active: true,
      }),
    );
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

  private envInt(key: string, fallback: number): number {
    const raw = Number(process.env[key]);
    return Number.isFinite(raw) ? Math.round(raw) : fallback;
  }
}
