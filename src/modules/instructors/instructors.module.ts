import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InstructorsController } from './instructors.controller';
import { LessonsController } from './lessons.controller';
import { InstructorsAdminController } from './instructors-admin.controller';
import { InstructorsService } from './instructors.service';
import { InstructorEntity } from './entities/instructor.entity';
import { InstructorReviewEntity } from './entities/instructor-review.entity';
import { LessonEntity } from './entities/lesson.entity';
import { User } from '../../entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([InstructorEntity, InstructorReviewEntity, LessonEntity, User])],
  controllers: [InstructorsController, LessonsController, InstructorsAdminController],
  providers: [InstructorsService],
  exports: [InstructorsService],
})
export class InstructorsModule {}
