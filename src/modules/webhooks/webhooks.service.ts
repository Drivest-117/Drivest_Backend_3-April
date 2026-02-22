import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
import { createHmac } from 'crypto';

@Injectable()
export class WebhooksService {
  constructor(
    @InjectRepository(Purchase) private purchaseRepo: Repository<Purchase>,
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(Entitlement) private entRepo: Repository<Entitlement>,
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  verifySignature(body: string, signature: string, secret: string) {
    const hash = createHmac('sha256', secret).update(body).digest('hex');
    if (hash !== signature) {
      throw new UnauthorizedException('Invalid signature');
    }
  }

  async handleRevenueCat(event: RevenueCatEventDto) {
    const user = await this.resolveOrCreateAppUser(event.userId);

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
        appUserId: user.appUserId,
      },
    });
    return { success: true };
  }

  private async resolveOrCreateAppUser(userIdRaw: string): Promise<User> {
    const appUserId = String(userIdRaw ?? '').trim();
    if (!appUserId) {
      throw new UnauthorizedException('RevenueCat app user id is required');
    }

    const byAppUserId = await this.userRepo.findOne({ where: { appUserId } });
    if (byAppUserId) return byAppUserId;

    const byInternalId = await this.userRepo.findOne({ where: { id: appUserId } });
    if (byInternalId) {
      if (!byInternalId.appUserId) {
        byInternalId.appUserId = appUserId;
        return this.userRepo.save(byInternalId);
      }
      return byInternalId;
    }

    const created = this.userRepo.create({
      appUserId,
      email: null,
      phone: null,
      name: 'Drivest User',
      passwordHash: 'ANON_APP_USER',
      role: 'USER',
      activeDeviceId: null,
      activeDeviceAt: null,
    });
    return this.userRepo.save(created);
  }
}
