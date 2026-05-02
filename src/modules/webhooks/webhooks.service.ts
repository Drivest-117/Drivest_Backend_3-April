import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { RevenueCatEventDto } from './dto/revenuecat-event.dto';
import {
  Purchase,
  PurchaseProvider,
  PurchaseStatus,
} from '../../entities/purchase.entity';
import { Product, ProductType } from '../../entities/product.entity';
import { Entitlement, EntitlementScope } from '../../entities/entitlement.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { User } from '../../entities/user.entity';
import { createHmac, timingSafeEqual } from 'crypto';
import { ReferralsService } from '../referrals/referrals.service';
import { LessonPaymentEntity } from '../instructors/entities/lesson-payment.entity';

type StripeWebhookEvent = {
  id?: string;
  type?: string;
  data?: {
    object?: Record<string, unknown>;
  };
};

@Injectable()
export class WebhooksService {
  constructor(
    @InjectRepository(Purchase) private purchaseRepo: Repository<Purchase>,
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(Entitlement) private entRepo: Repository<Entitlement>,
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private readonly referralsService: ReferralsService,
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  private get lessonPaymentRepo(): Repository<LessonPaymentEntity> {
    return this.dataSource.getRepository(LessonPaymentEntity);
  }

  verifySignature(body: Buffer | string, signature: string, secret: string) {
    const payload = Buffer.isBuffer(body) ? body : Buffer.from(body);
    const provided = signature.trim();
    const expectedHex = createHmac('sha256', secret).update(payload).digest('hex');
    const expectedBase64 = createHmac('sha256', secret).update(payload).digest('base64');

    const valid =
      this.safeCompare(provided, expectedHex) || this.safeCompare(provided, expectedBase64);

    if (!valid) {
      throw new UnauthorizedException('Invalid signature');
    }
  }

  async handleRevenueCat(event: RevenueCatEventDto) {
    const user = await this.resolveRevenueCatUser(event.userId);

    const product = await this.productRepo.findOne({
      where: [{ iosProductId: event.productId }, { androidProductId: event.productId }],
    });
    if (!product) return { ignored: true };

    const existing = await this.purchaseRepo.findOne({
      where: { transactionId: event.transactionId },
    });
    if (existing) {
      return existing;
    }

    const purchase = this.purchaseRepo.create({
      userId: user.id,
      productId: product.id,
      provider: PurchaseProvider.REVCAT,
      transactionId: event.transactionId,
      status: PurchaseStatus.COMPLETED,
      purchasedAt: new Date(event.purchasedAt),
      rawEvent: event.raw,
    });
    await this.purchaseRepo.save(purchase);

    const isSubscription = product.type === ProductType.SUBSCRIPTION;
    const centreId = product.metadata?.centreId ?? null;
    const centreScoped =
      product.metadata?.scope === EntitlementScope.CENTRE ||
      (!isSubscription && centreId);
    const endsAt = event.expiresAt ? new Date(event.expiresAt) : null;
    const entitlement = this.entRepo.create({
      userId: user.id,
      scope: centreScoped ? EntitlementScope.CENTRE : EntitlementScope.GLOBAL,
      centreId: centreScoped ? centreId : null,
      startsAt: new Date(event.purchasedAt),
      endsAt,
      isActive: !endsAt || endsAt > new Date(),
      sourcePurchaseId: purchase.id,
    });
    await this.entRepo.save(entitlement);

    await this.auditRepo.save({
      userId: user.id,
      action: 'REVENUECAT_EVENT',
      metadata: {
        transactionId: event.transactionId,
        productId: product.id,
        userId: user.id,
      },
    });

    // Trigger L2L referral reward if applicable (EPIC-22)
    const isPracticePack =
      product.iosProductId === process.env.APP_PLAN_PRACTICE_MONTHLY_PRODUCT_ID ||
      product.androidProductId === process.env.APP_PLAN_PRACTICE_MONTHLY_PRODUCT_ID ||
      product.metadata?.label?.toLowerCase().includes('practice');

    if (isPracticePack) {
      await this.referralsService.grantL2LBonusForPurchase(user.id, purchase.id);
    }

    return { success: true };
  }

  parseStripeEvent(
    payload: Buffer | string,
    signatureHeader: string,
    secret: string,
  ): StripeWebhookEvent {
    const rawPayload = Buffer.isBuffer(payload)
      ? payload.toString('utf8')
      : String(payload);
    const parsedHeader = this.parseStripeSignatureHeader(signatureHeader);
    const timestamp = parsedHeader.t;
    const providedSignatures = parsedHeader.v1;
    if (!timestamp || providedSignatures.length === 0) {
      throw new UnauthorizedException('Invalid Stripe signature');
    }

    const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
    if (!Number.isFinite(ageSeconds) || ageSeconds > 300) {
      throw new UnauthorizedException('Stripe signature timestamp outside tolerance');
    }

    const expected = createHmac('sha256', secret)
      .update(`${timestamp}.${rawPayload}`)
      .digest('hex');
    const isValid = providedSignatures.some((signature) =>
      this.safeCompare(signature, expected),
    );
    if (!isValid) {
      throw new UnauthorizedException('Invalid Stripe signature');
    }

    try {
      return JSON.parse(rawPayload) as StripeWebhookEvent;
    } catch {
      throw new BadRequestException('Invalid Stripe webhook payload');
    }
  }

  async handleStripe(event: StripeWebhookEvent) {
    const session = event.data?.object;
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        return this.handleStripeCheckoutSession(session, event.type);
      case 'checkout.session.async_payment_failed':
      case 'checkout.session.expired':
        return this.handleStripeCheckoutSession(session, event.type);
      default:
        return { ignored: true };
    }
  }

  private async resolveRevenueCatUser(userIdRaw: string): Promise<User> {
    const externalUserId = String(userIdRaw ?? '').trim();
    if (!externalUserId) {
      throw new UnauthorizedException('RevenueCat user id is required');
    }

    if (this.looksLikeUuid(externalUserId)) {
      const byInternalId = await this.userRepo.findOne({ where: { id: externalUserId } });
      if (byInternalId) {
        return byInternalId;
      }
    }

    if (this.looksLikeEmail(externalUserId)) {
      const byEmail = await this.userRepo
        .createQueryBuilder('user')
        .where('LOWER(user.email) = :email', { email: externalUserId.toLowerCase() })
        .getOne();
      if (byEmail) {
        return byEmail;
      }
    }

    throw new UnauthorizedException(
      'RevenueCat user id does not match an existing account',
    );
  }

  private looksLikeUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value.trim(),
    );
  }

  private looksLikeEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  private async handleStripeCheckoutSession(
    session: Record<string, unknown> | undefined,
    eventType: string | undefined,
  ) {
    const checkoutSessionId = this.readString(session?.id);
    if (!checkoutSessionId) {
      return { ignored: true };
    }

    const metadata = this.readObject(session?.metadata);
    const lessonId =
      this.readString(metadata?.lesson_id) ??
      this.readString(session?.client_reference_id);
    const learnerUserId = this.readString(metadata?.learner_user_id);
    const paymentStatus = this.readString(session?.payment_status)?.toLowerCase();
    const resolvedStatus = this.stripeLessonPaymentStatus(eventType, paymentStatus);

    let payment = await this.lessonPaymentRepo.findOne({
      where: { checkoutSessionId },
    });
    if (!payment && lessonId) {
      payment = await this.lessonPaymentRepo.findOne({ where: { lessonId } });
    }
    if (!payment && !lessonId) {
      return { ignored: true };
    }

    const upsert = payment ?? this.lessonPaymentRepo.create({ lessonId: lessonId! });
    upsert.provider = 'stripe';
    upsert.status = resolvedStatus;
    upsert.lessonId = upsert.lessonId ?? lessonId!;
    upsert.checkoutSessionId = checkoutSessionId;
    upsert.checkoutUrl = this.normaliseOptionalText(this.readString(session?.url));
    upsert.paymentIntentId = this.normaliseOptionalText(
      this.readStripePaymentIntent(session?.payment_intent),
    );
    upsert.transactionId = upsert.paymentIntentId;
    upsert.currencyCode = this.readString(session?.currency)?.toUpperCase() ?? 'GBP';
    upsert.amountPence =
      this.readNumber(session?.amount_total) ??
      this.readNumber(session?.amount_subtotal) ??
      upsert.amountPence ??
      null;
    upsert.rawProviderPayload = session ?? null;
    upsert.failureReason =
      resolvedStatus === 'captured'
        ? null
        : eventType === 'checkout.session.expired'
          ? 'Stripe checkout session expired'
          : eventType === 'checkout.session.async_payment_failed'
            ? 'Stripe async payment failed'
            : 'Stripe payment not yet paid';
    upsert.capturedAt =
      resolvedStatus === 'captured'
        ? upsert.capturedAt ?? new Date()
        : null;

    const saved = await this.lessonPaymentRepo.save(upsert);
    await this.auditRepo.save({
      userId: learnerUserId ?? null,
      action: 'LESSON_PAYMENT_STRIPE_WEBHOOK',
      metadata: {
        eventType,
        checkoutSessionId,
        lessonId: saved.lessonId,
        status: saved.status,
      },
    });

    return { success: true, lessonId: saved.lessonId, status: saved.status };
  }

  private stripeLessonPaymentStatus(
    eventType: string | undefined,
    paymentStatus: string | undefined,
  ): LessonPaymentEntity['status'] {
    if (
      eventType === 'checkout.session.completed' ||
      eventType === 'checkout.session.async_payment_succeeded'
    ) {
      return paymentStatus === 'paid' ? 'captured' : 'pending';
    }
    if (eventType === 'checkout.session.expired') {
      return 'cancelled';
    }
    if (eventType === 'checkout.session.async_payment_failed') {
      return 'failed';
    }
    return 'pending';
  }

  private parseStripeSignatureHeader(header: string) {
    return header.split(',').reduce(
      (acc, part) => {
        const [key, ...rest] = part.split('=');
        const value = rest.join('=').trim();
        if (key === 't') {
          acc.t = value;
        } else if (key === 'v1' && value) {
          acc.v1.push(value);
        }
        return acc;
      },
      { t: '', v1: [] as string[] },
    );
  }

  private readObject(value: unknown): Record<string, unknown> | undefined {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return undefined;
  }

  private readString(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }

  private readNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private readStripePaymentIntent(value: unknown): string | undefined {
    if (typeof value === 'string') {
      return this.readString(value);
    }
    return this.readString(this.readObject(value)?.id);
  }

  private normaliseOptionalText(value: string | undefined): string | null {
    return value?.trim() ? value.trim() : null;
  }

  private safeCompare(a: string, b: string): boolean {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    if (left.length !== right.length) {
      return false;
    }
    return timingSafeEqual(left, right);
  }
}
