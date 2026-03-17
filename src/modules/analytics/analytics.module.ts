import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { UserModuleProgress } from '../../entities/user-module-progress.entity';
import { UserModulePassStatus } from '../../entities/user-module-pass-status.entity';
import { UserAnalyticsRollup } from '../../entities/user-analytics-rollup.entity';
import { InstructorEntity } from '../instructors/entities/instructor.entity';
import { LessonEntity } from '../instructors/entities/lesson.entity';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { AdminAnalyticsController } from './admin-analytics.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserModuleProgress,
      UserModulePassStatus,
      UserAnalyticsRollup,
      InstructorEntity,
      LessonEntity,
    ]),
  ],
  controllers: [AnalyticsController, AdminAnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
