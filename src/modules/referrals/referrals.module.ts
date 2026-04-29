import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../../entities/audit-log.entity';
import { ReferralEvent } from '../../entities/referral-event.entity';
import { ReferralPayout } from '../../entities/referral-payout.entity';
import { User } from '../../entities/user.entity';
import { Entitlement } from '../../entities/entitlement.entity';
import { Product } from '../../entities/product.entity';
import { Purchase } from '../../entities/purchase.entity';
import { TestCentre } from '../../entities/test-centre.entity';
import { InstructorEntity } from '../instructors/entities/instructor.entity';
import { InstructorLearnerLinkEntity } from '../instructors/entities/instructor-learner-link.entity';
import { LessonEntity } from '../instructors/entities/lesson.entity';
import { ReferralsService } from './referrals.service';
import { ReferralsController } from './referrals.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReferralEvent,
      ReferralPayout,
      User,
      Entitlement,
      Product,
      Purchase,
      TestCentre,
      AuditLog,
      InstructorEntity,
      InstructorLearnerLinkEntity,
      LessonEntity,
    ]),
  ],
  providers: [ReferralsService],
  controllers: [ReferralsController],
  exports: [ReferralsService],
})
export class ReferralsModule {}
