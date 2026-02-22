import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Entitlement } from '../../entities/entitlement.entity';
import { User } from '../../entities/user.entity';
import { TestCentre } from '../../entities/test-centre.entity';
import { EntitlementsService } from './entitlements.service';
import { EntitlementsController } from './entitlements.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Entitlement, User, TestCentre])],
  providers: [EntitlementsService],
  controllers: [EntitlementsController],
  exports: [EntitlementsService],
})
export class EntitlementsModule {}
