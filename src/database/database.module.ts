import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from '../entities/user.entity';
import { TestCentre } from '../entities/test-centre.entity';
import { Route } from '../entities/route.entity';
import { Product } from '../entities/product.entity';
import { Purchase } from '../entities/purchase.entity';
import { Entitlement } from '../entities/entitlement.entity';
import { PracticeSession } from '../entities/practice-session.entity';
import { RouteStat } from '../entities/route-stat.entity';
import { CashbackClaim } from '../entities/cashback-claim.entity';
import { Track } from '../entities/track.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { InstructorEntity } from '../modules/instructors/entities/instructor.entity';
import { InstructorReviewEntity } from '../modules/instructors/entities/instructor-review.entity';
import { LessonEntity } from '../modules/instructors/entities/lesson.entity';
import { InstructorAvailabilityEntity } from '../modules/instructors/entities/instructor-availability.entity';
import { LessonPaymentEntity } from '../modules/instructors/entities/lesson-payment.entity';
import { LessonFinanceSnapshotEntity } from '../modules/instructors/entities/lesson-finance-snapshot.entity';
import { UserNotification } from '../entities/user-notification.entity';
import { UserModuleProgress } from '../entities/user-module-progress.entity';
import { UserModulePassStatus } from '../entities/user-module-pass-status.entity';
import { UserAnalyticsRollup } from '../entities/user-analytics-rollup.entity';
import { ContentPackManifest } from '../entities/content-pack-manifest.entity';
import { DisputeCaseEntity } from '../modules/disputes/entities/dispute-case.entity';
import { MarketplaceLegalAcceptanceEntity } from '../modules/legal-acceptance/entities/marketplace-legal-acceptance.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        entities: [
          User,
          TestCentre,
          Route,
          Product,
          Purchase,
          Entitlement,
          PracticeSession,
          RouteStat,
          CashbackClaim,
          Track,
          AuditLog,
          InstructorEntity,
          InstructorReviewEntity,
          LessonEntity,
          LessonPaymentEntity,
          LessonFinanceSnapshotEntity,
          InstructorAvailabilityEntity,
          UserNotification,
          UserModuleProgress,
          UserModulePassStatus,
          UserAnalyticsRollup,
          ContentPackManifest,
          DisputeCaseEntity,
          MarketplaceLegalAcceptanceEntity,
        ],
        synchronize: false,
        logging: false,
      }),
    }),
  ],
})
export class DatabaseModule {}
