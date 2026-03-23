import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InstructorsController } from './instructors.controller';
import { LessonsController } from './lessons.controller';
import { InstructorsAdminController } from './instructors-admin.controller';
import { InstructorsFinanceAdminController } from './instructors-finance-admin.controller';
import { InstructorsService } from './instructors.service';
import { InstructorEntity } from './entities/instructor.entity';
import { InstructorReviewEntity } from './entities/instructor-review.entity';
import { LessonEntity } from './entities/lesson.entity';
import { InstructorAvailabilityEntity } from './entities/instructor-availability.entity';
import { LessonPaymentEntity } from './entities/lesson-payment.entity';
import { LessonFinanceSnapshotEntity } from './entities/lesson-finance-snapshot.entity';
import { User } from '../../entities/user.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { DisputeCaseEntity } from '../disputes/entities/dispute-case.entity';

@Module({
  imports: [
    NotificationsModule,
    TypeOrmModule.forFeature([
      InstructorEntity,
      InstructorReviewEntity,
      LessonEntity,
      LessonPaymentEntity,
      LessonFinanceSnapshotEntity,
      InstructorAvailabilityEntity,
      User,
      AuditLog,
      DisputeCaseEntity,
    ]),
  ],
  controllers: [
    InstructorsController,
    LessonsController,
    InstructorsAdminController,
    InstructorsFinanceAdminController,
  ],
  providers: [InstructorsService],
  exports: [InstructorsService],
})
export class InstructorsModule {}
