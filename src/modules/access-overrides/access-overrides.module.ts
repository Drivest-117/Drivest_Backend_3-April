import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Entitlement } from '../../entities/entitlement.entity';
import { User } from '../../entities/user.entity';
import { AccessOverridesService } from './access-overrides.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Entitlement])],
  providers: [AccessOverridesService],
  exports: [AccessOverridesService],
})
export class AccessOverridesModule {}
