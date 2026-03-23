import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../../entities/audit-log.entity';
import { MarketplaceLegalAcceptanceEntity } from './entities/marketplace-legal-acceptance.entity';
import { LegalAcceptanceController } from './legal-acceptance.controller';
import { LegalAcceptanceService } from './legal-acceptance.service';

@Module({
  imports: [TypeOrmModule.forFeature([MarketplaceLegalAcceptanceEntity, AuditLog])],
  controllers: [LegalAcceptanceController],
  providers: [LegalAcceptanceService],
  exports: [LegalAcceptanceService],
})
export class LegalAcceptanceModule {}
