import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../../entities/audit-log.entity';
import { User } from '../../entities/user.entity';
import { InstructorEntity } from '../instructors/entities/instructor.entity';
import { LessonEntity } from '../instructors/entities/lesson.entity';
import { DisputesController } from './disputes.controller';
import { DisputesService } from './disputes.service';
import { DisputeCaseEntity } from './entities/dispute-case.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DisputeCaseEntity,
      LessonEntity,
      InstructorEntity,
      User,
      AuditLog,
    ]),
  ],
  controllers: [DisputesController],
  providers: [DisputesService],
  exports: [DisputesService],
})
export class DisputesModule {}
