import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Entitlement } from '../../entities/entitlement.entity';
import { User } from '../../entities/user.entity';
import { TestCentre } from '../../entities/test-centre.entity';
import { EntitlementsService } from './entitlements.service';
import { EntitlementsController } from './entitlements.controller';
import { AccessOverridesModule } from '../access-overrides/access-overrides.module';
import { Product } from '../../entities/product.entity';
import { Purchase } from '../../entities/purchase.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { SimpleThrottleGuard } from '../../common/simple-throttle.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Entitlement, User, TestCentre, Product, Purchase, AuditLog]),
    AccessOverridesModule,
  ],
  providers: [EntitlementsService, SimpleThrottleGuard],
  controllers: [EntitlementsController],
  exports: [EntitlementsService],
})
export class EntitlementsModule {}
