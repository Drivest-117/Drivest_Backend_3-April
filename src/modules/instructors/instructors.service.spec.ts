import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { InstructorsService } from "./instructors.service";
import { InstructorEntity } from "./entities/instructor.entity";
import { InstructorReviewEntity } from "./entities/instructor-review.entity";
import { LessonEntity } from "./entities/lesson.entity";
import { InstructorAvailabilityEntity } from "./entities/instructor-availability.entity";
import { LessonPaymentEntity } from "./entities/lesson-payment.entity";
import { LessonFinanceSnapshotEntity } from "./entities/lesson-finance-snapshot.entity";
import { InstructorShareCodeEntity } from "./entities/instructor-share-code.entity";
import { InstructorLearnerLinkEntity } from "./entities/instructor-learner-link.entity";
import { NotificationsService } from "../notifications/notifications.service";
import { User } from "../../entities/user.entity";
import { AuditLog } from "../../entities/audit-log.entity";
import { DisputeCaseEntity } from "../disputes/entities/dispute-case.entity";

type MockRepo<T extends object> = {
  findOne: jest.Mock;
  find: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  restore: jest.Mock;
  softDelete: jest.Mock;
  createQueryBuilder: jest.Mock;
  query?: jest.Mock;
  manager?: any;
};

function createMockRepo<T extends object>(): MockRepo<T> {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((input: T) => input),
    save: jest.fn(async (input: T) => input),
    restore: jest.fn(),
    softDelete: jest.fn(),
    createQueryBuilder: jest.fn(),
    query: jest.fn(),
  };
}

describe("InstructorsService", () => {
  let service: InstructorsService;
  let instructorsRepo: MockRepo<InstructorEntity>;
  let reviewsRepo: MockRepo<InstructorReviewEntity>;
  let lessonsRepo: MockRepo<LessonEntity>;
  let lessonPaymentsRepo: MockRepo<LessonPaymentEntity>;
  let lessonFinanceRepo: MockRepo<LessonFinanceSnapshotEntity>;
  let availabilityRepo: MockRepo<InstructorAvailabilityEntity>;
  let instructorShareCodesRepo: MockRepo<InstructorShareCodeEntity>;
  let instructorLearnerLinksRepo: MockRepo<InstructorLearnerLinkEntity>;
  let disputesRepo: MockRepo<DisputeCaseEntity>;
  let usersRepo: MockRepo<User>;
  let auditRepo: MockRepo<AuditLog>;
  let notificationsService: { createForUser: jest.Mock };

  beforeEach(async () => {
    instructorsRepo = createMockRepo<InstructorEntity>();
    reviewsRepo = createMockRepo<InstructorReviewEntity>();
    lessonsRepo = createMockRepo<LessonEntity>();
    lessonPaymentsRepo = createMockRepo<LessonPaymentEntity>();
    lessonFinanceRepo = createMockRepo<LessonFinanceSnapshotEntity>();
    availabilityRepo = createMockRepo<InstructorAvailabilityEntity>();
    instructorShareCodesRepo = createMockRepo<InstructorShareCodeEntity>();
    instructorLearnerLinksRepo = createMockRepo<InstructorLearnerLinkEntity>();
    disputesRepo = createMockRepo<DisputeCaseEntity>();
    usersRepo = createMockRepo<User>();
    auditRepo = createMockRepo<AuditLog>();
    notificationsService = { createForUser: jest.fn() };

    lessonsRepo.manager = {
      transaction: async (cb: any) =>
        cb({
          getRepository: (entity: any) => {
            if (entity === LessonEntity) return lessonsRepo;
            if (entity === AuditLog) return auditRepo;
            if (entity === InstructorAvailabilityEntity)
              return availabilityRepo;
            if (entity === InstructorEntity) return instructorsRepo;
            if (entity === User) return usersRepo;
            if (entity === LessonFinanceSnapshotEntity)
              return lessonFinanceRepo;
            if (entity === InstructorShareCodeEntity)
              return instructorShareCodesRepo;
            if (entity === InstructorLearnerLinkEntity)
              return instructorLearnerLinksRepo;
            if (entity === DisputeCaseEntity) return disputesRepo;
            return createMockRepo();
          },
        }),
    } as any;

    const moduleRef = await Test.createTestingModule({
      providers: [
        InstructorsService,
        { provide: getRepositoryToken(User), useValue: usersRepo },
        {
          provide: getRepositoryToken(InstructorEntity),
          useValue: instructorsRepo,
        },
        {
          provide: getRepositoryToken(InstructorReviewEntity),
          useValue: reviewsRepo,
        },
        { provide: getRepositoryToken(LessonEntity), useValue: lessonsRepo },
        {
          provide: getRepositoryToken(LessonPaymentEntity),
          useValue: lessonPaymentsRepo,
        },
        {
          provide: getRepositoryToken(LessonFinanceSnapshotEntity),
          useValue: lessonFinanceRepo,
        },
        {
          provide: getRepositoryToken(InstructorAvailabilityEntity),
          useValue: availabilityRepo,
        },
        {
          provide: getRepositoryToken(InstructorShareCodeEntity),
          useValue: instructorShareCodesRepo,
        },
        {
          provide: getRepositoryToken(InstructorLearnerLinkEntity),
          useValue: instructorLearnerLinksRepo,
        },
        {
          provide: getRepositoryToken(DisputeCaseEntity),
          useValue: disputesRepo,
        },
        { provide: getRepositoryToken(AuditLog), useValue: auditRepo },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = moduleRef.get(InstructorsService);
    lessonFinanceRepo.findOne.mockResolvedValue(null);
    disputesRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
    });
  });

  it("rejects review creation without completed lesson", async () => {
    instructorsRepo.findOne.mockResolvedValue({ id: "ins-1" });
    reviewsRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
    });
    lessonsRepo.findOne.mockResolvedValue({
      id: "lesson-1",
      instructorId: "ins-1",
      learnerUserId: "learner-1",
      status: "planned",
      deletedAt: null,
    });

    await expect(
      service.createReview({ userId: "learner-1", role: "USER" }, "ins-1", {
        lessonId: "lesson-1",
        rating: 5,
        reviewText: "Great lesson",
      }),
    ).rejects.toThrow("You can only review completed lessons");
  });

  it("approve flow sets isApproved and approvedAt", async () => {
    instructorsRepo.findOne.mockResolvedValue({
      id: "ins-1",
      userId: "user-ins-1",
      deletedAt: null,
      isApproved: false,
      approvedAt: null,
      suspendedAt: null,
    });

    const result = await service.approveInstructor("ins-1");

    expect(instructorsRepo.save).toHaveBeenCalled();
    expect(result.isApproved).toBe(true);
    expect(result.approvedAt).toBeInstanceOf(Date);
  });

  it("list endpoint query includes approved instructors only", async () => {
    const where = jest.fn().mockReturnThis();
    const andWhere = jest.fn().mockReturnThis();
    const leftJoin = jest.fn().mockReturnThis();
    const addSelect = jest.fn().mockReturnThis();
    const orderBy = jest.fn().mockReturnThis();
    const addOrderBy = jest.fn().mockReturnThis();
    const getRawMany = jest.fn().mockResolvedValue([]);

    instructorsRepo.createQueryBuilder.mockReturnValue({
      leftJoin,
      where,
      andWhere,
      addSelect,
      orderBy,
      addOrderBy,
      getRawMany,
    });

    await service.listPublic({ radiusMeters: 10000 });

    expect(andWhere).toHaveBeenCalledWith("i.is_approved = true");
  });

  it("enforces review rate limit of 3 per 24 hours", async () => {
    instructorsRepo.findOne.mockResolvedValue({ id: "ins-1", deletedAt: null });
    reviewsRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(3),
    });

    await expect(
      service.createReview({ userId: "learner-1", role: "USER" }, "ins-1", {
        lessonId: "lesson-1",
        rating: 4,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("lists pending reviews for completed lessons without existing reviews", async () => {
    const completedAt = new Date("2026-03-20T10:00:00.000Z");
    lessonsRepo.find.mockResolvedValue([
      {
        id: "lesson-1",
        instructorId: "ins-1",
        learnerUserId: "learner-1",
        status: "completed",
        scheduledAt: completedAt,
        createdAt: completedAt,
        updatedAt: completedAt,
        deletedAt: null,
      },
    ]);
    reviewsRepo.find.mockResolvedValue([]);
    instructorsRepo.find.mockResolvedValue([
      {
        id: "ins-1",
        fullName: "Jane Instructor",
      },
    ]);

    const result = await service.listPendingReviews({
      userId: "learner-1",
      role: "USER",
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      lessonId: "lesson-1",
      instructorId: "ins-1",
      instructorName: "Jane Instructor",
      hasReminderBeenSent: false,
    });
  });

  it("reports a visible review and flags it for moderation", async () => {
    instructorsRepo.findOne.mockResolvedValue({
      id: "ins-1",
      userId: "instructor-user-1",
      deletedAt: null,
    });
    reviewsRepo.findOne.mockResolvedValue({
      id: "review-1",
      instructorId: "ins-1",
      learnerUserId: "learner-1",
      lessonId: "lesson-1",
      rating: 2,
      reviewText: "Unfair review",
      status: "visible",
      reportedCount: 0,
      deletedAt: null,
    });

    const result = await service.reportReview(
      { userId: "instructor-user-1", role: "INSTRUCTOR" },
      "review-1",
      { reasonCode: "abusive_language", note: "Contains abuse" },
    );

    expect(result.status).toBe("flagged");
    expect(result.reportedCount).toBe(1);
    expect(auditRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "INSTRUCTOR_REVIEW_REPORTED",
        userId: "instructor-user-1",
      }),
    );
  });

  it("restores a removed review back to visible", async () => {
    const deletedAt = new Date("2026-03-21T12:00:00.000Z");
    reviewsRepo.findOne.mockResolvedValue({
      id: "review-1",
      instructorId: "ins-1",
      learnerUserId: "learner-1",
      lessonId: "lesson-1",
      rating: 4,
      reviewText: "Good lesson",
      status: "removed",
      reportedCount: 1,
      deletedAt,
    });

    const result = await service.restoreReview(
      "review-1",
      "admin-1",
      "Restored after review",
    );

    expect(reviewsRepo.restore).toHaveBeenCalledWith("review-1");
    expect(result.status).toBe("visible");
    expect(result.deletedAt).toBeNull();
    expect(auditRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "INSTRUCTOR_REVIEW_RESTORED",
        userId: "admin-1",
      }),
    );
  });

  it("blocks learner cancellation under 24h without emergency flag", async () => {
    const startsSoon = new Date(Date.now() + 2 * 60 * 60 * 1000);
    lessonsRepo.findOne.mockResolvedValue({
      id: "lesson-1",
      instructorId: "ins-1",
      learnerUserId: "learner-1",
      scheduledAt: startsSoon,
      status: "accepted",
      deletedAt: null,
    });

    await expect(
      service.cancelLessonAsLearner(
        { userId: "learner-1", role: "USER" },
        "lesson-1",
        { emergency: false },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("allows learner cancellation over 48h and marks lesson cancelled", async () => {
    const startsLater = new Date(Date.now() + 72 * 60 * 60 * 1000);
    const lesson = {
      id: "lesson-1",
      instructorId: "ins-1",
      learnerUserId: "learner-1",
      scheduledAt: startsLater,
      status: "accepted",
      deletedAt: null,
      availabilitySlotId: null,
    };
    lessonsRepo.findOne.mockResolvedValue(lesson);
    lessonsRepo.save.mockImplementation(async (input) => input);
    instructorsRepo.findOne.mockResolvedValue({
      id: "ins-1",
      userId: "instructor-user-1",
      deletedAt: null,
    });
    availabilityRepo.findOne.mockResolvedValue(null);

    const saved = await service.cancelLessonAsLearner(
      { userId: "learner-1", role: "USER" },
      "lesson-1",
      { emergency: false },
    );

    expect(saved.status).toBe("cancelled");
    expect(notificationsService.createForUser).toHaveBeenCalled();
    expect(auditRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "learner-1",
        action: "LESSON_CANCELLED_BY_LEARNER",
      }),
    );
  });

  it("blocks learner reschedule under 24h without emergency flag", async () => {
    const startsSoon = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const lockedLesson = {
      id: "lesson-1",
      instructorId: "ins-1",
      learnerUserId: "learner-1",
      scheduledAt: startsSoon,
      durationMinutes: 60,
      status: "accepted",
      availabilitySlotId: "slot-old",
      disputeLocked: false,
      deletedAt: null,
    };

    lessonsRepo.createQueryBuilder.mockReturnValue({
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(lockedLesson),
    });

    await expect(
      service.rescheduleLessonAsLearner(
        { userId: "learner-1", role: "USER" },
        "lesson-1",
        { availabilitySlotId: "slot-new", emergency: false },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(availabilityRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it("allows learner emergency reschedule under 24h and records emergency metadata", async () => {
    const startsSoon = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const targetStart = new Date(Date.now() + 5 * 60 * 60 * 1000);
    const targetEnd = new Date(Date.now() + 6 * 60 * 60 * 1000);
    const lockedLesson = {
      id: "lesson-1",
      instructorId: "ins-1",
      learnerUserId: "learner-1",
      scheduledAt: startsSoon,
      durationMinutes: 60,
      status: "accepted",
      availabilitySlotId: "slot-old",
      disputeLocked: false,
      deletedAt: null,
    };
    const targetSlot = {
      id: "slot-new",
      instructorId: "ins-1",
      startsAt: targetStart,
      endsAt: targetEnd,
      status: "open",
      bookedLessonId: null,
      deletedAt: null,
    };
    const previousSlot = {
      id: "slot-old",
      instructorId: "ins-1",
      startsAt: startsSoon,
      endsAt: new Date(startsSoon.getTime() + 60 * 60 * 1000),
      status: "booked",
      bookedLessonId: "lesson-1",
      deletedAt: null,
    };

    lessonsRepo.createQueryBuilder
      .mockReturnValueOnce({
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(lockedLesson),
      })
      .mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      });
    availabilityRepo.createQueryBuilder
      .mockReturnValueOnce({
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(targetSlot),
      })
      .mockReturnValueOnce({
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(previousSlot),
      });
    lessonsRepo.findOne.mockResolvedValue(lockedLesson);
    instructorsRepo.findOne.mockResolvedValue({
      id: "ins-1",
      userId: "instructor-user-1",
      deletedAt: null,
      hourlyRatePence: 4200,
    });

    const saved = await service.rescheduleLessonAsLearner(
      { userId: "learner-1", role: "USER" },
      "lesson-1",
      { availabilitySlotId: "slot-new", emergency: true },
    );

    expect(saved.availabilitySlotId).toBe("slot-new");
    expect(saved.scheduledAt?.toISOString()).toBe(targetStart.toISOString());
    expect(availabilityRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "slot-new",
        status: "booked",
        bookedLessonId: "lesson-1",
      }),
    );
    expect(availabilityRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "slot-old",
        status: "open",
        bookedLessonId: null,
      }),
    );
    expect(notificationsService.createForUser).toHaveBeenCalledWith(
      "instructor-user-1",
      "booking_status",
      "Learner rescheduled booking",
      expect.any(String),
      expect.objectContaining({
        lessonId: "lesson-1",
        availabilitySlotId: "slot-new",
        emergency: true,
      }),
      "learner-1",
    );

    const rescheduleAuditCall = auditRepo.save.mock.calls.find(
      ([entry]) => entry?.action === "LESSON_RESCHEDULED_BY_LEARNER",
    );
    expect(rescheduleAuditCall).toBeDefined();
    expect(rescheduleAuditCall?.[0]).toEqual(
      expect.objectContaining({
        userId: "learner-1",
        action: "LESSON_RESCHEDULED_BY_LEARNER",
        metadata: expect.objectContaining({
          lessonId: "lesson-1",
          emergency: true,
          previousAvailabilitySlotId: "slot-old",
        }),
      }),
    );
  });

  it("records an immutable audit event when instructor updates lesson status", async () => {
    const lesson = {
      id: "lesson-1",
      instructorId: "ins-1",
      learnerUserId: "learner-1",
      scheduledAt: null,
      durationMinutes: null,
      status: "requested",
      availabilitySlotId: null,
      deletedAt: null,
    };
    lessonsRepo.findOne.mockResolvedValue(lesson);
    lessonsRepo.save.mockImplementation(async (input) => input);
    instructorsRepo.findOne.mockResolvedValue({
      id: "ins-1",
      userId: "instructor-user-1",
      deletedAt: null,
    });

    await service.updateLessonStatus(
      { userId: "instructor-user-1", role: "instructor" },
      "lesson-1",
      { status: "declined" },
    );

    expect(auditRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "instructor-user-1",
        action: "LESSON_STATUS_UPDATED",
        metadata: expect.objectContaining({
          lessonId: "lesson-1",
          previousStatus: "requested",
          nextStatus: "declined",
        }),
      }),
    );
  });

  it("creates a finance snapshot during learner lesson creation", async () => {
    const createdLesson = {
      id: "lesson-created-1",
      instructorId: "ins-1",
      learnerUserId: "learner-1",
      scheduledAt: null,
      durationMinutes: null,
      status: "requested",
      learnerNote: "Please meet at station",
      availabilitySlotId: null,
      pickupAddress: null,
      pickupPostcode: null,
      pickupLat: null,
      pickupLng: null,
      pickupPlaceId: null,
      pickupNote: null,
      pickupContactNumber: "+447700900123",
      createdAt: new Date("2026-03-23T10:00:00.000Z"),
      updatedAt: new Date("2026-03-23T10:00:00.000Z"),
      deletedAt: null,
    };
    instructorsRepo.findOne.mockResolvedValue({
      id: "ins-1",
      userId: "instructor-user-1",
      deletedAt: null,
      isApproved: true,
      suspendedAt: null,
      hourlyRatePence: 4200,
    });
    usersRepo.findOne.mockResolvedValue({
      id: "learner-1",
      phone: "+447700900123",
    });
    lessonsRepo.save.mockImplementation(async (input) => ({
      ...input,
      ...createdLesson,
    }));
    lessonsRepo.findOne.mockResolvedValue(createdLesson);
    lessonFinanceRepo.save.mockImplementation(async (input) => ({
      ...input,
      id: "finance-1",
      updatedAt: new Date("2026-03-23T10:00:00.000Z"),
    }));

    await service.createLesson(
      { userId: "learner-1", role: "USER" },
      {
        instructorId: "ins-1",
        learnerNote: "Please meet at station",
      },
    );

    expect(lessonFinanceRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        lessonId: "lesson-created-1",
        bookingSource: "marketplace",
        financeIntegrityStatus: "synced",
      }),
    );
  });

  it("bootstraps instructor profile on getMyProfile when instructor record is missing", async () => {
    instructorsRepo.findOne.mockResolvedValueOnce(null);
    usersRepo.findOne.mockResolvedValue({
      id: "user-ins-1",
      name: "Casey Instructor",
      email: "casey@drivest.uk",
      phone: "+447700900123",
      deletedAt: null,
    });
    instructorsRepo.save.mockImplementation(async (input) => ({
      id: "ins-bootstrapped",
      deletedAt: null,
      ...input,
    }));

    const result = await service.getMyProfile({
      userId: "user-ins-1",
      role: "INSTRUCTOR",
    });

    expect(instructorsRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-ins-1",
        fullName: "Casey Instructor",
        email: "casey@drivest.uk",
        transmissionType: "both",
        isApproved: false,
      }),
    );
    expect(result.id).toBe("ins-bootstrapped");
    expect(result.fullName).toBe("Casey Instructor");
    expect(result.email).toBe("casey@drivest.uk");
  });

  it("bootstraps missing instructor profile before updateProfile", async () => {
    instructorsRepo.findOne.mockResolvedValueOnce(null);
    usersRepo.findOne.mockResolvedValue({
      id: "user-ins-2",
      name: "Taylor Coach",
      email: "taylor@drivest.uk",
      phone: null,
      deletedAt: null,
    });
    instructorsRepo.save
      .mockImplementationOnce(async (input) => ({
        id: "ins-2",
        deletedAt: null,
        ...input,
      }))
      .mockImplementationOnce(async (input) => ({
        id: "ins-2",
        deletedAt: null,
        ...input,
      }));

    const result = await service.updateProfile(
      { userId: "user-ins-2", role: "INSTRUCTOR" },
      {
        fullName: "Taylor Coach ADI",
        email: "taylor.coach@drivest.uk",
        transmissionType: "manual",
        adiNumber: "ADI-778899",
      },
    );

    expect(instructorsRepo.save).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        userId: "user-ins-2",
        fullName: "Taylor Coach ADI",
        email: "taylor.coach@drivest.uk",
        transmissionType: "manual",
        adiNumber: "ADI-778899",
      }),
    );
    expect(result.fullName).toBe("Taylor Coach ADI");
    expect(result.adiNumber).toBe("ADI-778899");
  });
});
