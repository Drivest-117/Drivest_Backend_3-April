import { BadRequestException } from "@nestjs/common";
import { ReferralsService } from "./referrals.service";
import {
  ReferralEventState,
  ReferralType,
} from "../../entities/referral-event.entity";
import { PurchaseStatus } from "../../entities/purchase.entity";

type MockRepo<T extends object> = {
  findOne: jest.Mock;
  find: jest.Mock;
  count: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  createQueryBuilder: jest.Mock;
};

function createMockRepo<T extends object>(): MockRepo<T> {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    create: jest.fn((input?: T) => (input ? input : ({} as T))),
    save: jest.fn(async (input: any) => {
      if (Array.isArray(input)) {
        return input.map((item, index) => ({
          id: item.id ?? `generated-${index + 1}`,
          ...item,
        }));
      }
      return { id: input?.id ?? "generated-id", ...input };
    }),
    createQueryBuilder: jest.fn(() => ({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    })),
  };
}

describe("ReferralsService", () => {
  let eventRepo: MockRepo<any>;
  let payoutRepo: MockRepo<any>;
  let userRepo: MockRepo<any>;
  let entitlementRepo: MockRepo<any>;
  let instructorRepo: MockRepo<any>;
  let instructorLearnerLinkRepo: MockRepo<any>;
  let lessonRepo: MockRepo<any>;
  let productRepo: MockRepo<any>;
  let purchaseRepo: MockRepo<any>;
  let centreRepo: MockRepo<any>;
  let auditRepo: MockRepo<any>;
  let service: ReferralsService;

  beforeEach(() => {
    eventRepo = createMockRepo();
    payoutRepo = createMockRepo();
    userRepo = createMockRepo();
    entitlementRepo = createMockRepo();
    instructorRepo = createMockRepo();
    instructorLearnerLinkRepo = createMockRepo();
    lessonRepo = createMockRepo();
    productRepo = createMockRepo();
    purchaseRepo = createMockRepo();
    centreRepo = createMockRepo();
    auditRepo = createMockRepo();
    service = new ReferralsService(
      eventRepo as any,
      payoutRepo as any,
      userRepo as any,
      entitlementRepo as any,
      instructorRepo as any,
      instructorLearnerLinkRepo as any,
      lessonRepo as any,
      productRepo as any,
      purchaseRepo as any,
      centreRepo as any,
      auditRepo as any,
    );
  });

  it("validates I2L signup attribution against referrer role and device lock", async () => {
    userRepo.findOne.mockResolvedValue({
      id: "referrer-user-1",
      role: "INSTRUCTOR",
      deviceIdHash: "device-b",
    });

    await expect(
      service.validateSignupReferral({
        referredById: "referrer-user-1",
        referralType: ReferralType.I2L,
        registeringRole: "USER",
        deviceIdHash: "device-b",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.validateSignupReferral({
        referredById: "referrer-user-1",
        referralType: ReferralType.I2L,
        registeringRole: "INSTRUCTOR",
        deviceIdHash: "device-c",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.validateSignupReferral({
        referredById: "referrer-user-1",
        referralType: ReferralType.I2L,
        registeringRole: "USER",
        deviceIdHash: "device-c",
      }),
    ).resolves.toEqual({
      referrerId: "referrer-user-1",
      referralType: ReferralType.I2L,
    });
  });

  it("counts distinct referred users and computes commission and network earnings", async () => {
    eventRepo.find.mockResolvedValue([
      {
        userId: "learner-1",
        referralType: ReferralType.I2L,
        state: ReferralEventState.CAPTURED,
      },
      {
        userId: "learner-1",
        referralType: ReferralType.I2L,
        state: ReferralEventState.QUALIFIED,
      },
      {
        userId: "learner-2",
        referralType: ReferralType.I2L,
        state: ReferralEventState.RELEASED,
      },
      {
        userId: "friend-1",
        referralType: ReferralType.L2L,
        state: ReferralEventState.RELEASED,
      },
    ]);
    lessonRepo.find.mockResolvedValue([
      {
        status: "completed",
        deletedAt: null,
        durationMinutes: 60,
        commissionRateApplied: 4,
        instructor: {
          userId: "referrer-user-1",
          hourlyRatePence: 4000,
        },
      },
      {
        status: "completed",
        deletedAt: null,
        durationMinutes: 60,
        commissionRateApplied: 7,
        instructor: {
          userId: "referrer-user-1",
          hourlyRatePence: 5000,
        },
      },
    ]);
    payoutRepo.find.mockResolvedValue([
      { amountPence: 80, isPaid: false },
      { amountPence: 120, isPaid: true },
    ]);

    await expect(
      service.getReferrerMetrics("referrer-user-1"),
    ).resolves.toEqual({
      studentsReferred: 2,
      friendsReferred: 1,
      commissionSavedPence: 160,
      networkEarningsPendingPence: 80,
      networkEarningsPaidPence: 120,
    });
  });

  it("does not create a duplicate I2I payout when the lesson already has one", async () => {
    lessonRepo.findOne.mockResolvedValue({
      id: "lesson-1",
      status: "completed",
      referralStakePayoutId: null,
      instructor: {
        id: "instructor-1",
        isApproved: true,
        hourlyRatePence: 4000,
        user: {
          id: "referee-user-1",
          referralType: ReferralType.I2I,
          referredById: "referrer-user-1",
          createdAt: new Date(),
          deviceIdHash: "device-referee",
        },
      },
    });
    userRepo.findOne.mockResolvedValue({
      id: "referrer-user-1",
      role: "INSTRUCTOR",
      deviceIdHash: "device-referrer",
    });
    instructorRepo.findOne.mockResolvedValue({
      id: "instructor-referrer-1",
      isApproved: true,
      bankAccountNumber: "12345678",
      bankSortCode: "11-22-33",
    });
    payoutRepo.findOne.mockResolvedValue({
      id: "payout-1",
      bookingId: "lesson-1",
    });

    await service.processI2IStake("lesson-1");

    expect(payoutRepo.create).not.toHaveBeenCalled();
    expect(payoutRepo.save).not.toHaveBeenCalled();
    expect(lessonRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "lesson-1",
        referralStakePayoutId: "payout-1",
      }),
    );
  });

  it("grants L2L bonus only for the first settled practice purchase", async () => {
    userRepo.findOne
      .mockResolvedValueOnce({
        id: "referee-1",
        referralType: ReferralType.L2L,
        referredById: "referrer-1",
        deviceIdHash: "device-a",
      })
      .mockResolvedValueOnce({
        id: "referrer-1",
        role: "USER",
        deviceIdHash: "device-b",
      });
    purchaseRepo.findOne.mockResolvedValue({
      id: "purchase-1",
      userId: "referee-1",
      productId: "practice-product-1",
      status: PurchaseStatus.COMPLETED,
      product: {
        iosProductId: "drivest.practice.monthly.selected_centre.gbp12.99",
        androidProductId: "drivest.practice.monthly.selected_centre.gbp12.99",
        metadata: { label: "Practice selected centre monthly" },
      },
    });
    purchaseRepo.count.mockResolvedValue(1);
    eventRepo.find.mockResolvedValue([]);

    await service.grantL2LBonusForPurchase("referee-1", "purchase-1");

    expect(entitlementRepo.save).toHaveBeenCalled();
    expect(eventRepo.save).toHaveBeenCalled();
  });

  it("releases the L2I learner rewards on first settled lesson", async () => {
    lessonRepo.findOne.mockResolvedValue({
      id: "lesson-55",
      status: "completed",
      instructor: {
        id: "instructor-2",
        isApproved: true,
        user: {
          id: "invitee-user-2",
          referralType: ReferralType.L2I,
          referredById: "learner-referrer-2",
          deviceIdHash: "device-invitee",
        },
      },
    });
    eventRepo.findOne.mockResolvedValue(null);
    userRepo.findOne.mockResolvedValue({
      id: "learner-referrer-2",
      role: "USER",
      deviceIdHash: "device-learner",
      navigationAccessUntil: null,
      lessonCreditBalancePence: 0,
      lessonCreditGrantedTotalPence: 0,
    });
    const centreQueryBuilder = {
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: "centre-1",
        name: "Colchester",
      }),
    };
    entitlementRepo.createQueryBuilder
      .mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      })
      .mockReturnValueOnce({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(undefined),
      });
    centreRepo.createQueryBuilder.mockReturnValue(centreQueryBuilder);
    productRepo.findOne.mockResolvedValue(null);

    await service.grantL2IRewardsForFirstSettledLesson("lesson-55");

    expect(purchaseRepo.save).toHaveBeenCalled();
    expect(userRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        lessonCreditBalancePence: 2500,
      }),
    );
    expect(entitlementRepo.save).toHaveBeenCalled();
  });

  it("supports role-appropriate invite link types only", async () => {
    await expect(
      service.generateInviteLink("user-1", "INSTRUCTOR", "I2I"),
    ).resolves.toEqual({
      link: "https://drivest.uk/join?ref_type=I2I&referrer_id=user-1",
      refType: ReferralType.I2I,
      referrerId: "user-1",
    });

    await expect(
      service.generateInviteLink("user-1", "USER", "I2I"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
