import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Cron, CronExpression } from "@nestjs/schedule";
import { EntityManager, LessThan, Repository } from "typeorm";
import { AuditLog } from "../../entities/audit-log.entity";
import {
  Entitlement,
  EntitlementScope,
} from "../../entities/entitlement.entity";
import { Product, ProductPeriod, ProductType } from "../../entities/product.entity";
import {
  Purchase,
  PurchaseProvider,
  PurchaseStatus,
} from "../../entities/purchase.entity";
import {
  ReferralEvent,
  ReferralEventState,
  ReferralType,
} from "../../entities/referral-event.entity";
import { ReferralPayout } from "../../entities/referral-payout.entity";
import { TestCentre } from "../../entities/test-centre.entity";
import { User } from "../../entities/user.entity";
import { InstructorEntity } from "../instructors/entities/instructor.entity";
import {
  InstructorLearnerLinkEntity,
  InstructorLearnerLinkStatus,
} from "../instructors/entities/instructor-learner-link.entity";
import { LessonEntity } from "../instructors/entities/lesson.entity";
import { calculateGrossAmountPence } from "../instructors/lesson-finance-calculator";

type ReferralReviewInput = {
  targetState: ReferralEventState;
  note?: string | null;
  failureReason?: string | null;
  fraudScore?: number | null;
};

type ReferralEventFilters = {
  referralType?: ReferralType;
  state?: ReferralEventState;
  userId?: string;
  referrerId?: string;
  limit?: number;
};

type ReferralPayoutFilters = {
  referrerId?: string;
  refereeId?: string;
  isPaid?: boolean;
  limit?: number;
};

@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name);

  constructor(
    @InjectRepository(ReferralEvent)
    private readonly eventRepo: Repository<ReferralEvent>,
    @InjectRepository(ReferralPayout)
    private readonly payoutRepo: Repository<ReferralPayout>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Entitlement)
    private readonly entRepo: Repository<Entitlement>,
    @InjectRepository(InstructorEntity)
    private readonly instructorRepo: Repository<InstructorEntity>,
    @InjectRepository(InstructorLearnerLinkEntity)
    private readonly instructorLearnerLinkRepo: Repository<InstructorLearnerLinkEntity>,
    @InjectRepository(LessonEntity)
    private readonly lessonRepo: Repository<LessonEntity>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Purchase)
    private readonly purchaseRepo: Repository<Purchase>,
    @InjectRepository(TestCentre)
    private readonly centreRepo: Repository<TestCentre>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async logEvent(
    data: {
      userId: string;
      referrerId: string;
      referralType: ReferralType;
      state?: ReferralEventState;
      metadata?: Record<string, any>;
      fraudScore?: number;
      failureReason?: string | null;
    },
    manager?: EntityManager,
  ): Promise<ReferralEvent> {
    const repo = manager
      ? manager.getRepository(ReferralEvent)
      : this.eventRepo;
    const event = repo.create() as ReferralEvent;
    event.userId = data.userId;
    event.referrerId = data.referrerId;
    event.referralType = data.referralType;
    event.state = data.state ?? ReferralEventState.CAPTURED;
    (event as any).metadata = data.metadata ?? null;
    event.fraudScore = data.fraudScore ?? 0;
    (event as any).failureReason = data.failureReason ?? null;
    return repo.save(event);
  }

  async validateSignupReferral(
    input: {
      referredById?: string | null;
      referralType?: string | ReferralType | null;
      registeringRole: User["role"];
      deviceIdHash?: string | null;
    },
    manager?: EntityManager,
  ): Promise<{ referrerId: string; referralType: ReferralType } | null> {
    const referrerId = String(input.referredById ?? "").trim();
    const rawReferralType = String(input.referralType ?? "")
      .trim()
      .toUpperCase();
    if (!referrerId && !rawReferralType) {
      return null;
    }
    if (!referrerId || !rawReferralType) {
      throw new BadRequestException(
        "Referral attribution must include both referredById and referralType.",
      );
    }
    if (
      !Object.values(ReferralType).includes(rawReferralType as ReferralType)
    ) {
      throw new BadRequestException("Unsupported referral type.");
    }

    const referralType = rawReferralType as ReferralType;
    const expectedRoles = this.expectedRolesForReferralType(referralType);
    if (input.registeringRole !== expectedRoles.refereeRole) {
      throw new BadRequestException(
        `Referral type ${referralType} is not valid for ${input.registeringRole} signups.`,
      );
    }

    const userRepo = manager ? manager.getRepository(User) : this.userRepo;
    const referrer = await userRepo.findOne({ where: { id: referrerId } });
    if (!referrer) {
      throw new BadRequestException("Referral referrer not found.");
    }
    if (referrer.role !== expectedRoles.referrerRole) {
      throw new BadRequestException(
        `Referral type ${referralType} requires a ${expectedRoles.referrerRole} referrer.`,
      );
    }

    const deviceIdHash = String(input.deviceIdHash ?? "").trim();
    if (
      deviceIdHash &&
      referrer.deviceIdHash &&
      deviceIdHash === referrer.deviceIdHash
    ) {
      throw new BadRequestException(
        "Referrer and referee must use distinct devices.",
      );
    }

    return {
      referrerId: referrer.id,
      referralType,
    };
  }

  async handleReferredSignup(user: User, manager?: EntityManager) {
    if (user.referralType !== ReferralType.I2L || !user.referredById) {
      return;
    }

    const instructorRepo = manager
      ? manager.getRepository(InstructorEntity)
      : this.instructorRepo;
    const linkRepo = manager
      ? manager.getRepository(InstructorLearnerLinkEntity)
      : this.instructorLearnerLinkRepo;

    const instructor = await instructorRepo.findOne({
      where: { userId: user.referredById },
    });

    if (!instructor) {
      this.logger.warn(
        `Instructor not found for user_id ${user.referredById} during ItoL signup for learner ${user.id}`,
      );
      return;
    }

    const existingLink = await linkRepo.findOne({
      where: { instructorId: instructor.id, learnerUserId: user.id },
    });

    if (!existingLink) {
      const link = linkRepo.create({
        instructorId: instructor.id,
        learnerUserId: user.id,
        status: InstructorLearnerLinkStatus.APPROVED,
        requestedAt: new Date(),
        approvedAt: new Date(),
        requestCode: "REFERRAL_I2L",
      });
      await linkRepo.save(link);

      this.logger.log(
        `Automated ItoL link created between Instructor ${instructor.id} and Learner ${user.id}`,
      );

      await this.logEvent(
        {
          userId: user.id,
          referrerId: user.referredById,
          referralType: ReferralType.I2L,
          state: ReferralEventState.QUALIFIED,
          metadata: {
            action: "automated_handshake",
            instructorId: instructor.id,
          },
        },
        manager,
      );
    }
  }

  async getReferrerMetrics(referrerId: string) {
    const events = await this.eventRepo.find({
      where: { referrerId },
    });
    const discountedLessons = await this.lessonRepo.find({
      where: { status: "completed" },
      relations: ["instructor"],
    });
    const payouts = await this.payoutRepo.find({
      where: { referrerId },
    });

    const studentsReferred = new Set(
      events
        .filter(
          (event) =>
            event.referralType === ReferralType.I2L &&
            [
              ReferralEventState.QUALIFIED,
              ReferralEventState.RELEASED,
            ].includes(event.state),
        )
        .map((event) => event.userId),
    ).size;
    const friendsReferred = new Set(
      events
        .filter(
          (event) =>
            event.referralType === ReferralType.L2L &&
            event.state === ReferralEventState.RELEASED,
        )
        .map((event) => event.userId),
    ).size;
    const commissionSavedPence = discountedLessons.reduce((sum, lesson) => {
      if (lesson.deletedAt || lesson.instructor?.userId !== referrerId) {
        return sum;
      }
      if (Number(lesson.commissionRateApplied) !== 4) {
        return sum;
      }
      const grossAmountPence = calculateGrossAmountPence(
        lesson.instructor?.hourlyRatePence ?? null,
        lesson.durationMinutes,
      );
      if (grossAmountPence === null) {
        return sum;
      }
      return sum + Math.round(grossAmountPence * 0.04);
    }, 0);
    const networkEarningsPendingPence = payouts
      .filter((payout) => !payout.isPaid)
      .reduce((sum, payout) => sum + Number(payout.amountPence ?? 0), 0);
    const networkEarningsPaidPence = payouts
      .filter((payout) => payout.isPaid)
      .reduce((sum, payout) => sum + Number(payout.amountPence ?? 0), 0);

    return {
      studentsReferred,
      friendsReferred,
      commissionSavedPence,
      networkEarningsPendingPence,
      networkEarningsPaidPence,
    };
  }

  async grantL2LBonusForPurchase(
    refereeId: string,
    purchaseId: string,
    manager?: EntityManager,
  ) {
    const userRepo = manager ? manager.getRepository(User) : this.userRepo;
    const purchaseRepo = manager
      ? manager.getRepository(Purchase)
      : this.purchaseRepo;
    const eventRepo = manager
      ? manager.getRepository(ReferralEvent)
      : this.eventRepo;
    const entRepo = manager ? manager.getRepository(Entitlement) : this.entRepo;

    const referee = await userRepo.findOne({ where: { id: refereeId } });
    if (
      !referee ||
      referee.referralType !== ReferralType.L2L ||
      !referee.referredById
    ) {
      return;
    }

    const purchase = await purchaseRepo.findOne({
      where: { id: purchaseId, userId: refereeId, status: PurchaseStatus.COMPLETED },
      relations: ["product"],
    });
    if (!purchase || !this.isPracticePurchase(purchase.product)) {
      return;
    }

    const releasedEvents = await eventRepo.find({
      where: {
        userId: referee.id,
        referralType: ReferralType.L2L,
        state: ReferralEventState.RELEASED,
      },
    });
    const existingReward = releasedEvents.find(
      (event) => this.readString(event.metadata?.sourcePurchaseId) === purchase.id,
    );
    if (existingReward) {
      return;
    }
    if (releasedEvents.length > 0) {
      return;
    }

    const completedPracticePurchaseCount = await purchaseRepo.count({
      where: {
        userId: referee.id,
        productId: purchase.productId,
        status: PurchaseStatus.COMPLETED,
      },
    });
    if (completedPracticePurchaseCount !== 1) {
      await this.logEvent(
        {
          userId: referee.id,
          referrerId: referee.referredById,
          referralType: ReferralType.L2L,
          state: ReferralEventState.BLOCKED,
          metadata: {
            action: "grant_bonus_route_30d_denied",
            reason: "not_first_settled_practice_purchase",
            sourcePurchaseId: purchase.id,
            completedPracticePurchaseCount,
          },
          failureReason: "not_first_settled_practice_purchase",
        },
        manager,
      );
      return;
    }

    const referrer = await userRepo.findOne({
      where: { id: referee.referredById },
    });
    if (!referrer) return;

    if (
      referee.deviceIdHash &&
      referee.deviceIdHash === referrer.deviceIdHash
    ) {
      this.logger.warn(
        `L2L reward blocked: Referrer ${referrer.id} and Referee ${referee.id} share the same Device ID hash.`,
      );
      await this.logEvent(
        {
          userId: referee.id,
          referrerId: referrer.id,
          referralType: ReferralType.L2L,
          state: ReferralEventState.BLOCKED,
          metadata: {
            action: "grant_bonus_route_30d_denied",
            reason: "device_id_collision",
            sourcePurchaseId: purchase.id,
          },
          failureReason: "device_id_collision",
        },
        manager,
      );
      return;
    }

    const releasedForReferrer = await eventRepo.find({
      where: {
        referrerId: referrer.id,
        referralType: ReferralType.L2L,
        state: ReferralEventState.RELEASED,
      },
    });
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dailyCap = this.envInt("REFERRAL_L2L_DAILY_CAP_PER_REFERRER", 25);
    const lifetimeCap = this.envInt(
      "REFERRAL_L2L_LIFETIME_CAP_PER_REFERRER",
      250,
    );
    if (
      dailyCap > 0 &&
      releasedForReferrer.filter((event) => event.createdAt >= dayStart).length >=
        dailyCap
    ) {
      await this.logEvent(
        {
          userId: referee.id,
          referrerId: referrer.id,
          referralType: ReferralType.L2L,
          state: ReferralEventState.BLOCKED,
          metadata: {
            action: "grant_bonus_route_30d_denied",
            reason: "daily_cap_reached",
            sourcePurchaseId: purchase.id,
            dailyCap,
          },
          failureReason: "daily_cap_reached",
        },
        manager,
      );
      return;
    }
    if (lifetimeCap > 0 && releasedForReferrer.length >= lifetimeCap) {
      await this.logEvent(
        {
          userId: referee.id,
          referrerId: referrer.id,
          referralType: ReferralType.L2L,
          state: ReferralEventState.BLOCKED,
          metadata: {
            action: "grant_bonus_route_30d_denied",
            reason: "lifetime_cap_reached",
            sourcePurchaseId: purchase.id,
            lifetimeCap,
          },
          failureReason: "lifetime_cap_reached",
        },
        manager,
      );
      return;
    }

    const endsAt = new Date(now);
    endsAt.setDate(endsAt.getDate() + 30);

    const event = await this.logEvent(
      {
        userId: referee.id,
        referrerId: referrer.id,
        referralType: ReferralType.L2L,
        state: ReferralEventState.RELEASED,
        metadata: {
          action: "grant_bonus_route_30d",
          sourcePurchaseId: purchase.id,
          durationDays: 30,
        },
      },
      manager,
    );

    const savedEntitlements = await entRepo.save([
      entRepo.create({
        userId: referee.id,
        scope: EntitlementScope.BONUS_ROUTE,
        centreId: null,
        startsAt: now,
        endsAt,
        isActive: true,
        sourcePurchaseId: null,
        sourceReferralEventId: event.id,
      }),
      entRepo.create({
        userId: referrer.id,
        scope: EntitlementScope.BONUS_ROUTE,
        centreId: null,
        startsAt: now,
        endsAt,
        isActive: true,
        sourcePurchaseId: null,
        sourceReferralEventId: event.id,
      }),
    ]);

    event.metadata = {
      ...(event.metadata ?? {}),
      entitlementIds: savedEntitlements.map((entitlement) => entitlement.id),
    };
    await eventRepo.save(event);

    this.logger.log(
      `L2L Bonus Route granted to Referrer ${referrer.id} and Referee ${referee.id}`,
    );
  }

  async reverseL2LBonusForCanceledPurchase(
    refereeId: string,
    purchaseId: string,
    reason = "purchase_canceled",
    manager?: EntityManager,
  ) {
    const eventRepo = manager
      ? manager.getRepository(ReferralEvent)
      : this.eventRepo;
    const entRepo = manager ? manager.getRepository(Entitlement) : this.entRepo;

    const releasedEvents = await eventRepo.find({
      where: {
        userId: refereeId,
        referralType: ReferralType.L2L,
        state: ReferralEventState.RELEASED,
      },
    });
    const rewardEvent = releasedEvents.find(
      (event) => this.readString(event.metadata?.sourcePurchaseId) === purchaseId,
    );
    if (!rewardEvent) {
      return;
    }

    await entRepo
      .createQueryBuilder()
      .update(Entitlement)
      .set({ isActive: false, endsAt: new Date() })
      .where("source_referral_event_id = :eventId", { eventId: rewardEvent.id })
      .execute();

    rewardEvent.state = ReferralEventState.REVERSED;
    rewardEvent.failureReason = reason;
    rewardEvent.metadata = {
      ...(rewardEvent.metadata ?? {}),
      reversedAt: new Date().toISOString(),
      reversalReason: reason,
    };
    await eventRepo.save(rewardEvent);
  }

  async processI2IStake(lessonId: string, manager?: EntityManager) {
    const lessonRepo = manager
      ? manager.getRepository(LessonEntity)
      : this.lessonRepo;
    const instructorRepo = manager
      ? manager.getRepository(InstructorEntity)
      : this.instructorRepo;
    const userRepo = manager ? manager.getRepository(User) : this.userRepo;
    const payoutRepo = manager
      ? manager.getRepository(ReferralPayout)
      : this.payoutRepo;

    const lesson = await lessonRepo.findOne({
      where: { id: lessonId },
      relations: ["instructor", "instructor.user"],
    });

    if (!lesson || lesson.status !== "completed" || !lesson.instructor?.user) {
      return;
    }
    if (lesson.referralStakePayoutId) {
      return;
    }

    const referee = lesson.instructor.user;
    if (referee.referralType !== ReferralType.I2I || !referee.referredById) {
      return;
    }

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
    if (referee.createdAt < twelveMonthsAgo) {
      return;
    }

    const referrer = await userRepo.findOne({
      where: { id: referee.referredById },
    });
    if (!referrer) return;
    if (
      referrer.deviceIdHash &&
      referee.deviceIdHash &&
      referrer.deviceIdHash === referee.deviceIdHash
    ) {
      await this.logEvent(
        {
          userId: referee.id,
          referrerId: referrer.id,
          referralType: ReferralType.I2I,
          state: ReferralEventState.BLOCKED,
          metadata: {
            action: "i2i_success_stake_blocked",
            reason: "device_id_collision",
            lessonId: lesson.id,
          },
          failureReason: "device_id_collision",
        },
        manager,
      );
      return;
    }

    const referrerInstructor = await instructorRepo.findOne({
      where: { userId: referrer.id },
    });
    if (
      !referrerInstructor ||
      !referrerInstructor.isApproved ||
      !lesson.instructor.isApproved
    ) {
      await this.logEvent(
        {
          userId: referee.id,
          referrerId: referrer.id,
          referralType: ReferralType.I2I,
          state: ReferralEventState.HELD,
          metadata: {
            action: "i2i_success_stake_held",
            reason: "verification_incomplete",
            lessonId: lesson.id,
          },
          failureReason: "verification_incomplete",
        },
        manager,
      );
      return;
    }
    if (
      this.hasSharedPayoutFingerprint(referrerInstructor, lesson.instructor)
    ) {
      await this.logEvent(
        {
          userId: referee.id,
          referrerId: referrer.id,
          referralType: ReferralType.I2I,
          state: ReferralEventState.BLOCKED,
          metadata: {
            action: "i2i_success_stake_blocked",
            reason: "shared_payout_account",
            lessonId: lesson.id,
          },
          failureReason: "shared_payout_account",
        },
        manager,
      );
      return;
    }

    const existingPayout = await payoutRepo.findOne({
      where: { bookingId: lesson.id },
    });
    if (existingPayout) {
      lesson.referralStakePayoutId = existingPayout.id;
      await lessonRepo.save(lesson);
      return;
    }

    const grossPence = calculateGrossAmountPence(
      lesson.instructor.hourlyRatePence ?? null,
      lesson.durationMinutes,
    );
    if (grossPence === null) return;
    const stakeAmountPence = Math.round(grossPence * 0.01);

    if (stakeAmountPence <= 0) return;

    const expiryDate = new Date(referee.createdAt);
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);

    const payout = payoutRepo.create({
      referrerId: referrer.id,
      refereeId: referee.id,
      amountPence: stakeAmountPence,
      bookingId: lesson.id,
      expiryDate,
      isPaid: false,
      paidAt: null,
    });

    await payoutRepo.save(payout);

    lesson.referralStakePayoutId = payout.id;
    await lessonRepo.save(lesson);

    await this.logEvent(
      {
        userId: referee.id,
        referrerId: referrer.id,
        referralType: ReferralType.I2I,
        state: ReferralEventState.RELEASED,
        metadata: {
          action: "i2i_success_stake_ledgered",
          lessonId: lesson.id,
          payoutId: payout.id,
          amountPence: stakeAmountPence,
        },
      },
      manager,
    );

    this.logger.log(
      `I2I Success Stake of ${stakeAmountPence}p ledgered for Referrer ${referrer.id} from Lesson ${lesson.id}`,
    );
  }

  async grantL2IRewardsForFirstSettledLesson(
    lessonId: string,
    manager?: EntityManager,
  ) {
    const lessonRepo = manager
      ? manager.getRepository(LessonEntity)
      : this.lessonRepo;
    const userRepo = manager ? manager.getRepository(User) : this.userRepo;
    const eventRepo = manager
      ? manager.getRepository(ReferralEvent)
      : this.eventRepo;
    const entRepo = manager ? manager.getRepository(Entitlement) : this.entRepo;
    const purchaseRepo = manager
      ? manager.getRepository(Purchase)
      : this.purchaseRepo;

    const lesson = await lessonRepo.findOne({
      where: { id: lessonId },
      relations: ["instructor", "instructor.user"],
    });
    if (!lesson || lesson.status !== "completed" || !lesson.instructor?.user) {
      return;
    }

    const invitedInstructorUser = lesson.instructor.user;
    if (
      invitedInstructorUser.referralType !== ReferralType.L2I ||
      !invitedInstructorUser.referredById
    ) {
      return;
    }

    const existingReward = await eventRepo.findOne({
      where: {
        userId: invitedInstructorUser.id,
        referralType: ReferralType.L2I,
        state: ReferralEventState.RELEASED,
      },
    });
    if (existingReward) {
      return;
    }

    const referrer = await userRepo.findOne({
      where: { id: invitedInstructorUser.referredById },
    });
    if (!referrer || referrer.role !== "USER") {
      await this.logEvent(
        {
          userId: invitedInstructorUser.id,
          referrerId: invitedInstructorUser.referredById,
          referralType: ReferralType.L2I,
          state: ReferralEventState.BLOCKED,
          metadata: {
            action: "grant_l2i_reward_denied",
            reason: "invalid_referrer_account",
            lessonId: lesson.id,
          },
          failureReason: "invalid_referrer_account",
        },
        manager,
      );
      return;
    }

    if (
      referrer.deviceIdHash &&
      invitedInstructorUser.deviceIdHash &&
      referrer.deviceIdHash === invitedInstructorUser.deviceIdHash
    ) {
      await this.logEvent(
        {
          userId: invitedInstructorUser.id,
          referrerId: referrer.id,
          referralType: ReferralType.L2I,
          state: ReferralEventState.BLOCKED,
          metadata: {
            action: "grant_l2i_reward_denied",
            reason: "device_id_collision",
            lessonId: lesson.id,
          },
          failureReason: "device_id_collision",
        },
        manager,
      );
      return;
    }

    if (!lesson.instructor.isApproved) {
      await this.logEvent(
        {
          userId: invitedInstructorUser.id,
          referrerId: referrer.id,
          referralType: ReferralType.L2I,
          state: ReferralEventState.HELD,
          metadata: {
            action: "grant_l2i_reward_held",
            reason: "verification_incomplete",
            lessonId: lesson.id,
          },
          failureReason: "verification_incomplete",
        },
        manager,
      );
      return;
    }

    const bundleCentre = await this.resolveReferralBundleCentre(referrer.id, manager);
    if (!bundleCentre) {
      await this.logEvent(
        {
          userId: invitedInstructorUser.id,
          referrerId: referrer.id,
          referralType: ReferralType.L2I,
          state: ReferralEventState.HELD,
          metadata: {
            action: "grant_l2i_reward_held",
            reason: "bundle_centre_unresolved",
            lessonId: lesson.id,
          },
          failureReason: "bundle_centre_unresolved",
        },
        manager,
      );
      return;
    }

    const annualBundleProduct = await this.ensureAnnualBundleProduct(manager);
    const rewardEvent = await this.logEvent(
      {
        userId: invitedInstructorUser.id,
        referrerId: referrer.id,
        referralType: ReferralType.L2I,
        state: ReferralEventState.RELEASED,
        metadata: {
          action: "grant_l2i_referrer_rewards",
          lessonId: lesson.id,
          lessonCreditPence: 2500,
          bundleCentreId: bundleCentre.id,
        },
      },
      manager,
    );

    const previousNavigationAccessUntil = referrer.navigationAccessUntil
      ? new Date(referrer.navigationAccessUntil)
      : null;
    const purchase = purchaseRepo.create({
      userId: referrer.id,
      productId: annualBundleProduct.id,
      provider: PurchaseProvider.INTERNAL,
      status: PurchaseStatus.COMPLETED,
      transactionId: `referral:l2i:${rewardEvent.id}`,
      purchasedAt: new Date(),
      rawEvent: {
        source: "referral_l2i",
        referralEventId: rewardEvent.id,
        lessonId: lesson.id,
      },
    });
    const savedPurchase = await purchaseRepo.save(purchase);

    const navigationAccessUntil = this.extendNavigationAccessForUser(
      referrer,
      this.annualBundleNavigationMonths(),
    );
    await userRepo.save({
      ...referrer,
      navigationAccessUntil,
      lessonCreditBalancePence: (referrer.lessonCreditBalancePence ?? 0) + 2500,
      lessonCreditGrantedTotalPence:
        (referrer.lessonCreditGrantedTotalPence ?? 0) + 2500,
    });

    const startsAt = new Date();
    const centreEntitlement = await entRepo.save(
      entRepo.create({
        userId: referrer.id,
        scope: EntitlementScope.CENTRE,
        centreId: bundleCentre.id,
        startsAt,
        endsAt: this.addMonths(startsAt, this.annualBundleCentreMonths()),
        isActive: true,
        sourcePurchaseId: savedPurchase.id,
        sourceReferralEventId: rewardEvent.id,
      }),
    );

    rewardEvent.metadata = {
      ...(rewardEvent.metadata ?? {}),
      annualBundlePurchaseId: savedPurchase.id,
      annualBundleCentreEntitlementId: centreEntitlement.id,
      previousNavigationAccessUntil: previousNavigationAccessUntil
        ? previousNavigationAccessUntil.toISOString()
        : null,
      navigationAccessUntil: navigationAccessUntil.toISOString(),
    };
    await eventRepo.save(rewardEvent);
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async expireDiscountedRates() {
    this.logger.log("Running Referral Expiry Audit...");

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

    const expiredReferees = await this.userRepo.find({
      where: [
        {
          referralType: ReferralType.I2I,
          createdAt: LessThan(twelveMonthsAgo),
        },
        {
          referralType: ReferralType.L2I,
          createdAt: LessThan(twelveMonthsAgo),
        },
      ],
    });

    for (const referee of expiredReferees) {
      const referralType = referee.referralType as ReferralType;
      const existingExpiryEvent = await this.eventRepo.findOne({
        where: {
          userId: referee.id,
          referralType,
          state: ReferralEventState.REVERSED,
        },
      });
      if (existingExpiryEvent) {
        continue;
      }
      await this.logEvent({
        userId: referee.id,
        referrerId:
          referee.referredById || "00000000-0000-0000-0000-000000000000",
        referralType,
        state: ReferralEventState.REVERSED,
        metadata: {
          action: "discount_window_expired",
          reason: "12_month_limit",
        },
      });
    }

    this.logger.log(
      `Referral Expiry Audit complete. Processed ${expiredReferees.length} expirations.`,
    );
  }

  async generateInviteLink(
    userId: string,
    role: string,
    requestedType?: string,
  ) {
    const baseUrl = process.env.REFERRAL_BASE_URL || "https://drivest.uk/join";
    const allowedTypes = this.allowedInviteTypesForRole(role);
    const requested = String(requestedType ?? "")
      .trim()
      .toUpperCase();
    let refType = allowedTypes[0];
    if (requested) {
      if (!allowedTypes.includes(requested as ReferralType)) {
        throw new BadRequestException(
          "Requested referral type is not allowed for this account.",
        );
      }
      refType = requested as ReferralType;
    }
    const link = `${baseUrl}?ref_type=${refType}&referrer_id=${userId}`;

    return {
      link,
      refType,
      referrerId: userId,
    };
  }

  async listAdminReferralEvents(filters: ReferralEventFilters) {
    const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
    const qb = this.eventRepo
      .createQueryBuilder("event")
      .leftJoinAndSelect("event.user", "user")
      .leftJoinAndSelect("event.referrer", "referrer")
      .orderBy("event.createdAt", "DESC")
      .limit(limit);

    if (filters.referralType) {
      qb.andWhere("event.referralType = :referralType", {
        referralType: filters.referralType,
      });
    }
    if (filters.state) {
      qb.andWhere("event.state = :state", { state: filters.state });
    }
    if (filters.userId) {
      qb.andWhere("event.userId = :userId", { userId: filters.userId });
    }
    if (filters.referrerId) {
      qb.andWhere("event.referrerId = :referrerId", {
        referrerId: filters.referrerId,
      });
    }

    return qb.getMany();
  }

  async reviewReferralEvent(
    eventId: string,
    input: ReferralReviewInput,
    actorUserId: string,
  ) {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException("Referral event not found");
    }

    if (
      input.targetState === ReferralEventState.REVERSED &&
      event.state !== ReferralEventState.REVERSED
    ) {
      if (event.referralType === ReferralType.L2L) {
        await this.reverseL2LRewardEvent(event, input.failureReason ?? "admin_reversal");
      } else if (event.referralType === ReferralType.L2I) {
        await this.reverseL2IRewardEvent(event, input.failureReason ?? "admin_reversal");
      }
    } else {
      event.state = input.targetState;
      event.failureReason = input.failureReason ?? event.failureReason ?? null;
      if (Number.isFinite(input.fraudScore)) {
        event.fraudScore = Number(input.fraudScore);
      }
      event.metadata = {
        ...(event.metadata ?? {}),
        adminReviewNote: input.note ?? null,
        reviewedAt: new Date().toISOString(),
        reviewedByUserId: actorUserId,
      };
      await this.eventRepo.save(event);
    }

    await this.auditRepo.save({
      userId: actorUserId,
      action: "REFERRAL_EVENT_REVIEWED",
      metadata: {
        eventId: event.id,
        referralType: event.referralType,
        targetState: input.targetState,
        failureReason: input.failureReason ?? null,
        note: input.note ?? null,
      },
    });

    return this.eventRepo.findOne({ where: { id: eventId } });
  }

  async listAdminReferralPayouts(filters: ReferralPayoutFilters) {
    const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
    const qb = this.payoutRepo
      .createQueryBuilder("payout")
      .leftJoinAndSelect("payout.referrer", "referrer")
      .leftJoinAndSelect("payout.referee", "referee")
      .orderBy("payout.createdAt", "DESC")
      .limit(limit);

    if (filters.referrerId) {
      qb.andWhere("payout.referrerId = :referrerId", {
        referrerId: filters.referrerId,
      });
    }
    if (filters.refereeId) {
      qb.andWhere("payout.refereeId = :refereeId", {
        refereeId: filters.refereeId,
      });
    }
    if (typeof filters.isPaid === "boolean") {
      qb.andWhere("payout.isPaid = :isPaid", { isPaid: filters.isPaid });
    }

    return qb.getMany();
  }

  async setReferralPayoutPaidStatus(
    payoutId: string,
    isPaid: boolean,
    actorUserId: string,
  ) {
    const payout = await this.payoutRepo.findOne({ where: { id: payoutId } });
    if (!payout) {
      throw new NotFoundException("Referral payout not found");
    }

    payout.isPaid = isPaid;
    payout.paidAt = isPaid ? new Date() : null;
    const saved = await this.payoutRepo.save(payout);

    await this.auditRepo.save({
      userId: actorUserId,
      action: "REFERRAL_PAYOUT_PAYMENT_STATUS_UPDATED",
      metadata: {
        payoutId: saved.id,
        isPaid: saved.isPaid,
        paidAt: saved.paidAt ? saved.paidAt.toISOString() : null,
      },
    });

    return saved;
  }

  private expectedRolesForReferralType(referralType: ReferralType): {
    referrerRole: User["role"];
    refereeRole: User["role"];
  } {
    switch (referralType) {
      case ReferralType.I2L:
        return { referrerRole: "INSTRUCTOR", refereeRole: "USER" };
      case ReferralType.I2I:
        return { referrerRole: "INSTRUCTOR", refereeRole: "INSTRUCTOR" };
      case ReferralType.L2L:
        return { referrerRole: "USER", refereeRole: "USER" };
      case ReferralType.L2I:
        return { referrerRole: "USER", refereeRole: "INSTRUCTOR" };
    }
  }

  private allowedInviteTypesForRole(role: string): ReferralType[] {
    return role === "INSTRUCTOR"
      ? [ReferralType.I2L, ReferralType.I2I]
      : [ReferralType.L2L, ReferralType.L2I];
  }

  private hasSharedPayoutFingerprint(
    referrerInstructor: InstructorEntity,
    refereeInstructor: InstructorEntity,
  ): boolean {
    const referrerAccountNumber = referrerInstructor.bankAccountNumber?.trim();
    const referrerSortCode = referrerInstructor.bankSortCode?.trim();
    const refereeAccountNumber = refereeInstructor.bankAccountNumber?.trim();
    const refereeSortCode = refereeInstructor.bankSortCode?.trim();
    return Boolean(
      referrerAccountNumber &&
        referrerSortCode &&
        refereeAccountNumber &&
        refereeSortCode &&
        referrerAccountNumber === refereeAccountNumber &&
        referrerSortCode === refereeSortCode,
    );
  }

  private async reverseL2LRewardEvent(
    event: ReferralEvent,
    reason: string,
    manager?: EntityManager,
  ) {
    const eventRepo = manager
      ? manager.getRepository(ReferralEvent)
      : this.eventRepo;
    const entRepo = manager ? manager.getRepository(Entitlement) : this.entRepo;

    await entRepo
      .createQueryBuilder()
      .update(Entitlement)
      .set({ isActive: false, endsAt: new Date() })
      .where("source_referral_event_id = :eventId", { eventId: event.id })
      .execute();

    event.state = ReferralEventState.REVERSED;
    event.failureReason = reason;
    event.metadata = {
      ...(event.metadata ?? {}),
      reversedAt: new Date().toISOString(),
      reversalReason: reason,
    };
    await eventRepo.save(event);
  }

  private async reverseL2IRewardEvent(
    event: ReferralEvent,
    reason: string,
    manager?: EntityManager,
  ) {
    const eventRepo = manager
      ? manager.getRepository(ReferralEvent)
      : this.eventRepo;
    const userRepo = manager ? manager.getRepository(User) : this.userRepo;
    const entRepo = manager ? manager.getRepository(Entitlement) : this.entRepo;
    const purchaseRepo = manager
      ? manager.getRepository(Purchase)
      : this.purchaseRepo;

    const referrer = await userRepo.findOne({ where: { id: event.referrerId } });
    if (referrer) {
      const lessonCreditPence = this.readNumber(event.metadata?.lessonCreditPence) ?? 2500;
      const previousNavigationAccessUntil = this.readDate(
        event.metadata?.previousNavigationAccessUntil,
      );
      referrer.lessonCreditBalancePence = Math.max(
        0,
        (referrer.lessonCreditBalancePence ?? 0) - lessonCreditPence,
      );
      referrer.navigationAccessUntil = previousNavigationAccessUntil;
      await userRepo.save(referrer);
    }

    const annualBundlePurchaseId = this.readString(
      event.metadata?.annualBundlePurchaseId,
    );
    if (annualBundlePurchaseId) {
      await purchaseRepo
        .createQueryBuilder()
        .update(Purchase)
        .set({ status: PurchaseStatus.CANCELED })
        .where("id = :purchaseId", { purchaseId: annualBundlePurchaseId })
        .execute();
    }

    await entRepo
      .createQueryBuilder()
      .update(Entitlement)
      .set({ isActive: false, endsAt: new Date() })
      .where("source_referral_event_id = :eventId", { eventId: event.id })
      .execute();

    event.state = ReferralEventState.REVERSED;
    event.failureReason = reason;
    event.metadata = {
      ...(event.metadata ?? {}),
      reversedAt: new Date().toISOString(),
      reversalReason: reason,
    };
    await eventRepo.save(event);
  }

  private async resolveReferralBundleCentre(
    userId: string,
    manager?: EntityManager,
  ): Promise<TestCentre | null> {
    const entRepo = manager ? manager.getRepository(Entitlement) : this.entRepo;
    const centreRepo = manager ? manager.getRepository(TestCentre) : this.centreRepo;

    const latestCentreEntitlement = await entRepo
      .createQueryBuilder("ent")
      .where("ent.userId = :userId", { userId })
      .andWhere("ent.scope = :scope", { scope: EntitlementScope.CENTRE })
      .andWhere("ent.centreId IS NOT NULL")
      .orderBy("ent.isActive", "DESC")
      .addOrderBy("ent.endsAt", "DESC", "NULLS FIRST")
      .addOrderBy("ent.createdAt", "DESC")
      .getOne();

    const latestCentreId = latestCentreEntitlement?.centreId ?? null;
    if (latestCentreId) {
      const centre = await centreRepo.findOne({ where: { id: latestCentreId } });
      if (centre) {
        return centre;
      }
    }

    return centreRepo
      .createQueryBuilder("centre")
      .orderBy("centre.createdAt", "ASC")
      .getOne();
  }

  private isPracticePurchase(product: Product | null | undefined): boolean {
    if (!product) return false;
    const configuredPracticeProductId =
      process.env.APP_PLAN_PRACTICE_MONTHLY_PRODUCT_ID ||
      "drivest.practice.monthly.selected_centre.gbp12.99";
    return (
      product.iosProductId === configuredPracticeProductId ||
      product.androidProductId === configuredPracticeProductId ||
      String(product.metadata?.label ?? "")
        .toLowerCase()
        .includes("practice")
    );
  }

  private async ensureAnnualBundleProduct(
    manager?: EntityManager,
  ): Promise<Product> {
    const repo = manager ? manager.getRepository(Product) : this.productRepo;
    const iosProductId =
      process.env.APP_PLAN_ANNUAL_BUNDLE_PRODUCT_ID ||
      process.env.APP_PLAN_NAVIGATION_BUNDLE_PRODUCT_ID ||
      "drivest.annual.bundle.gbp29_99.yearly";
    const androidProductId = iosProductId;
    const existing = await repo.findOne({
      where: [{ iosProductId }, { androidProductId }],
    });
    const metadata = {
      label: "Annual bundle",
      currencyCode:
        process.env.APP_PLAN_ANNUAL_BUNDLE_CURRENCY ||
        process.env.APP_PLAN_NAVIGATION_BUNDLE_CURRENCY ||
        "GBP",
      navigationDurationMonths: this.annualBundleNavigationMonths(),
      centreDurationMonths: this.annualBundleCentreMonths(),
    };
    if (existing) {
      existing.type = ProductType.SUBSCRIPTION;
      existing.period = ProductPeriod.YEAR;
      existing.pricePence = this.annualBundlePricePence();
      existing.active = true;
      existing.metadata = metadata;
      return repo.save(existing);
    }
    return repo.save(
      repo.create({
        iosProductId,
        androidProductId,
        type: ProductType.SUBSCRIPTION,
        pricePence: this.annualBundlePricePence(),
        period: ProductPeriod.YEAR,
        active: true,
        metadata,
      }),
    );
  }

  private extendNavigationAccessForUser(user: User, months: number): Date {
    const now = new Date();
    const anchor =
      user.navigationAccessUntil && user.navigationAccessUntil > now
        ? user.navigationAccessUntil
        : now;
    return this.addMonths(anchor, months);
  }

  private annualBundlePricePence(): number {
    return this.envInt(
      "APP_PLAN_ANNUAL_BUNDLE_PENCE",
      this.envInt("APP_PLAN_NAVIGATION_BUNDLE_PENCE", 2999),
    );
  }

  private annualBundleNavigationMonths(): number {
    return this.envInt(
      "APP_PLAN_ANNUAL_BUNDLE_NAV_MONTHS",
      this.envInt("APP_PLAN_NAVIGATION_BUNDLE_NAV_MONTHS", 12),
    );
  }

  private annualBundleCentreMonths(): number {
    return this.envInt(
      "APP_PLAN_ANNUAL_BUNDLE_CENTRE_MONTHS",
      this.envInt("APP_PLAN_NAVIGATION_BUNDLE_CENTRE_MONTHS", 1),
    );
  }

  private addMonths(anchor: Date, months: number): Date {
    const next = new Date(anchor);
    next.setMonth(next.getMonth() + months);
    return next;
  }

  private envInt(key: string, fallback: number): number {
    const raw = Number(process.env[key]);
    if (!Number.isFinite(raw)) {
      return fallback;
    }
    return Math.floor(raw);
  }

  private readString(value: unknown): string | null {
    const normalized = String(value ?? "").trim();
    return normalized ? normalized : null;
  }

  private readNumber(value: unknown): number | null {
    const normalized = Number(value);
    return Number.isFinite(normalized) ? normalized : null;
  }

  private readDate(value: unknown): Date | null {
    if (!value) return null;
    const parsed = new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
}
