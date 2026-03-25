import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User } from '../../entities/user.entity';
import { TestCentre } from '../../entities/test-centre.entity';
import { Route } from '../../entities/route.entity';
import { OverpassAdvisoryCacheService } from '../routes/overpass-advisory-cache.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, TestCentre, Route])],
  controllers: [AdminController],
  providers: [AdminService, OverpassAdvisoryCacheService],
})
export class AdminModule {}
