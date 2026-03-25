import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../../entities/audit-log.entity';
import { User } from '../../entities/user.entity';
import { AppLegalController } from './app-legal.controller';
import { AppLegalService } from './app-legal.service';
import { ConsentHistoryEntity } from './entities/consent-history.entity';
import { LegalDocumentVersionEntity } from './entities/legal-document-version.entity';
import { MarketplaceLegalAcceptanceEntity } from './entities/marketplace-legal-acceptance.entity';
import { UserConsentEntity } from './entities/user-consent.entity';
import { UserLegalAcceptanceEntity } from './entities/user-legal-acceptance.entity';
import { LegalAcceptanceController } from './legal-acceptance.controller';
import { LegalAcceptanceIosController } from './legal-acceptance-ios.controller';
import { LegalAcceptanceService } from './legal-acceptance.service';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
      }),
    }),
    TypeOrmModule.forFeature([
      MarketplaceLegalAcceptanceEntity,
      LegalDocumentVersionEntity,
      UserLegalAcceptanceEntity,
      UserConsentEntity,
      ConsentHistoryEntity,
      User,
      AuditLog,
    ]),
  ],
  controllers: [LegalAcceptanceController, LegalAcceptanceIosController, AppLegalController],
  providers: [LegalAcceptanceService, AppLegalService],
  exports: [LegalAcceptanceService, AppLegalService],
})
export class LegalAcceptanceModule {}
