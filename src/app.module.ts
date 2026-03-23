import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CentresModule } from './modules/centres/centres.module';
import { RoutesModule } from './modules/routes/routes.module';
import { EntitlementsModule } from './modules/entitlements/entitlements.module';
import { CashbackModule } from './modules/cashback/cashback.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './modules/health/health.module';
import { AdminModule } from './modules/admin/admin.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { InstructorsModule } from './modules/instructors/instructors.module';
import { ParkingModule } from './modules/parking/parking.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ContentPacksModule } from './modules/content-packs/content-packs.module';
import { DisputesModule } from './modules/disputes/disputes.module';
import { LegalAcceptanceModule } from './modules/legal-acceptance/legal-acceptance.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    CentresModule,
    RoutesModule,
    EntitlementsModule,
    CashbackModule,
    WebhooksModule,
    HealthModule,
    AdminModule,
    NotificationsModule,
    InstructorsModule,
    ParkingModule,
    AnalyticsModule,
    ContentPacksModule,
    DisputesModule,
    LegalAcceptanceModule,
  ],
})
export class AppModule {}
