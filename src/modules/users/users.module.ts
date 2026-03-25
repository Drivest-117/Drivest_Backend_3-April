import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from '../../entities/user.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { AccessOverridesModule } from '../access-overrides/access-overrides.module';
import { LegalAcceptanceModule } from '../legal-acceptance/legal-acceptance.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, AuditLog]),
    AccessOverridesModule,
    LegalAcceptanceModule,
  ],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
