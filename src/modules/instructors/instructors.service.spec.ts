import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InstructorsService } from './instructors.service';
import { InstructorEntity } from './entities/instructor.entity';
import { InstructorReviewEntity } from './entities/instructor-review.entity';
import { LessonEntity } from './entities/lesson.entity';
import { InstructorShareCodeEntity } from './entities/instructor-share-code.entity';
import { InstructorLearnerLinkEntity } from './entities/instructor-learner-link.entity';
import { InstructorAvailabilityEntity } from './entities/instructor-availability.entity';
import { LessonPaymentEntity } from './entities/lesson-payment.entity';
import { LessonFinanceSnapshotEntity } from './entities/lesson-finance-snapshot.entity';
import { BookingTermsSnapshotEntity } from './entities/booking-terms-snapshot.entity';
import { InstructorDeclarationEntity } from './entities/instructor-declaration.entity';
import { InstructorReviewRecordEntity } from './entities/instructor-review-record.entity';
import { AccountRestrictionEntity } from './entities/account-restriction.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../../entities/user.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { DisputeCaseEntity } from '../disputes/entities/dispute-case.entity';
import { LegalDocumentVersionEntity } from '../legal-acceptance/entities/legal-document-version.entity';

type MockRepo<T extends object> = {
  findOne: jest.Mock;
  find: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
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
    softDelete: jest.fn(),
    createQueryBuilder: jest.fn(),
    query: jest.fn(),
  };
}

describe('InstructorsService', () => {
  let service: InstructorsService;
  let instructorsRepo: MockRepo<InstructorEntity>;
  let reviewsRepo: MockRepo<InstructorReviewEntity>;
  let lessonsRepo: MockRepo<LessonEntity>;
  let instructorShareCodeRepo: MockRepo<InstructorShareCodeEntity>;
  let instructorLearnerLinkRepo: MockRepo<InstructorLearnerLinkEntity>;
  let lessonPaymentsRepo: MockRepo<LessonPaymentEntity>;
  let lessonFinanceRepo: MockRepo<LessonFinanceSnapshotEntity>;
  let bookingTermsRepo: MockRepo<BookingTermsSnapshotEntity>;
  let instructorDeclarationRepo: MockRepo<InstructorDeclarationEntity>;
  let instructorReviewRecordRepo: MockRepo<InstructorReviewRecordEntity>;
  let accountRestrictionsRepo: MockRepo<AccountRestrictionEntity>;
  let legalDocumentVersionRepo: MockRepo<LegalDocumentVersionEntity>;
  let availabilityRepo: MockRepo<InstructorAvailabilityEntity>;
  let disputesRepo: MockRepo<DisputeCaseEntity>;
  let usersRepo: MockRepo<User>;
  let auditRepo: MockRepo<AuditLog>;
  let notificationsService: { createForUser: jest.Mock };

  beforeEach(async () => {
    instructorsRepo = createMockRepo<InstructorEntity>();
    reviewsRepo = createMockRepo<InstructorReviewEntity>();
    lessonsRepo = createMockRepo<LessonEntity>();
    instructorShareCodeRepo = createMockRepo<InstructorShareCodeEntity>();
    instructorLearnerLinkRepo = createMockRepo<InstructorLearnerLinkEntity>();
    lessonPaymentsRepo = createMockRepo<LessonPaymentEntity>();
    lessonFinanceRepo = createMockRepo<LessonFinanceSnapshotEntity>();
    bookingTermsRepo = createMockRepo<BookingTermsSnapshotEntity>();
    instructorDeclarationRepo = createMockRepo<InstructorDeclarationEntity>();
    instructorReviewRecordRepo = createMockRepo<InstructorReviewRecordEntity>();
    accountRestrictionsRepo = createMockRepo<AccountRestrictionEntity>();
    legalDocumentVersionRepo = createMockRepo<LegalDocumentVersionEntity>();
    availabilityRepo = createMockRepo<InstructorAvailabilityEntity>();
    disputesRepo = createMockRepo<DisputeCaseEntity>();
    usersRepo = createMockRepo<User>();
    auditRepo = createMockRepo<AuditLog>();
    notificationsService = { createForUser: jest.fn() };

    lessonsRepo.manager = {
      transaction: async (cb: any) =>
        cb({
          getRepository: (entity: any) => {
            if (entity === LessonEntity) return lessonsRepo;
            if (entity === InstructorShareCodeEntity) return instructorShareCodeRepo;
            if (entity === InstructorLearnerLinkEntity) return instructorLearnerLinkRepo;
            if (entity === AuditLog) return auditRepo;
            if (entity === InstructorAvailabilityEntity) return availabilityRepo;
            if (entity === InstructorEntity) return instructorsRepo;
            if (entity === User) return usersRepo;
            if (entity === LessonFinanceSnapshotEntity) return lessonFinanceRepo;
            if (entity === BookingTermsSnapshotEntity) return bookingTermsRepo;
            if (entity === InstructorDeclarationEntity) return instructorDeclarationRepo;
            if (entity === InstructorReviewRecordEntity) return instructorReviewRecordRepo;
            if (entity === AccountRestrictionEntity) return accountRestrictionsRepo;
            if (entity === LegalDocumentVersionEntity) return legalDocumentVersionRepo;
            if (entity === DisputeCaseEntity) return disputesRepo;
            return createMockRepo();
          },
        }),
    } as any;

    const moduleRef = await Test.createTestingModule({
      providers: [
        InstructorsService,
        { provide: getRepositoryToken(User), useValue: usersRepo },
        { provide: getRepositoryToken(InstructorEntity), useValue: instructorsRepo },
        { provide: getRepositoryToken(InstructorReviewEntity), useValue: reviewsRepo },
        { provide: getRepositoryToken(LessonEntity), useValue: lessonsRepo },
        { provide: getRepositoryToken(InstructorShareCodeEntity), useValue: instructorShareCodeRepo },
        { provide: getRepositoryToken(InstructorLearnerLinkEntity), useValue: instructorLearnerLinkRepo },
        { provide: getRepositoryToken(LessonPaymentEntity), useValue: lessonPaymentsRepo },
        { provide: getRepositoryToken(LessonFinanceSnapshotEntity), useValue: lessonFinanceRepo },
        { provide: getRepositoryToken(BookingTermsSnapshotEntity), useValue: bookingTermsRepo },
        {
          provide: getRepositoryToken(InstructorDeclarationEntity),
          useValue: instructorDeclarationRepo,
        },
        {
          provide: getRepositoryToken(InstructorReviewRecordEntity),
          useValue: instructorReviewRecordRepo,
        },
        {
          provide: getRepositoryToken(AccountRestrictionEntity),
          useValue: accountRestrictionsRepo,
        },
        {
          provide: getRepositoryToken(LegalDocumentVersionEntity),
          useValue: legalDocumentVersionRepo,
        },
        { provide: getRepositoryToken(InstructorAvailabilityEntity), useValue: availabilityRepo },
        { provide: getRepositoryToken(DisputeCaseEntity), useValue: disputesRepo },
        { provide: getRepositoryToken(AuditLog), useValue: auditRepo },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = moduleRef.get(InstructorsService);
    accountRestrictionsRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    });
    lessonFinanceRepo.findOne.mockResolvedValue(null);
    disputesRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
    });
  });

  it('rejects review creation without completed lesson', async () => {
    instructorsRepo.findOne.mockResolvedValue({ id: 'ins-1' });
    reviewsRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
    });
    lessonsRepo.findOne.mockResolvedValue({
      id: 'lesson-1',
      instructorId: 'ins-1',
      learnerUserId: 'learner-1',
      status: 'planned',
      deletedAt: null,
    });

    await expect(
      service.createReview(
        { userId: 'learner-1', role: 'USER' },
        'ins-1',
        { lessonId: 'lesson-1', rating: 5, reviewText: 'Great lesson' },
      ),
    ).rejects.toThrow('You can only review completed lessons');
  });

  it('approve flow sets isApproved and approvedAt', async () => {
    instructorsRepo.findOne.mockResolvedValue({
      id: 'ins-1',
      userId: 'user-ins-1',
      deletedAt: null,
      isApproved: false,
      approvedAt: null,
      suspendedAt: null,
    });

    const result = await service.approveInstructor('ins-1');

    expect(instructorsRepo.save).toHaveBeenCalled();
    expect(result.isApproved).toBe(true);
    expect(result.approvedAt).toBeInstanceOf(Date);
  });

  it('list endpoint query includes approved instructors only', async () => {
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

    expect(andWhere).toHaveBeenCalledWith('i.is_approved = true');
  });

  it('enforces review rate limit of 3 per 24 hours', async () => {
    instructorsRepo.findOne.mockResolvedValue({ id: 'ins-1', deletedAt: null });
    reviewsRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(3),
    });

    await expect(
      service.createReview(
        { userId: 'learner-1', role: 'USER' },
        'ins-1',
        { lessonId: 'lesson-1', rating: 4 },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks learner cancellation under 24h without emergency flag', async () => {
    const startsSoon = new Date(Date.now() + 2 * 60 * 60 * 1000);
    lessonsRepo.findOne.mockResolvedValue({
      id: 'lesson-1',
      instructorId: 'ins-1',
      learnerUserId: 'learner-1',
      scheduledAt: startsSoon,
      status: 'accepted',
      deletedAt: null,
    });

    await expect(
      service.cancelLessonAsLearner(
        { userId: 'learner-1', role: 'USER' },
        'lesson-1',
        { emergency: false },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows learner cancellation over 48h and marks lesson cancelled', async () => {
    const startsLater = new Date(Date.now() + 72 * 60 * 60 * 1000);
    const lesson = {
      id: 'lesson-1',
      instructorId: 'ins-1',
      learnerUserId: 'learner-1',
      scheduledAt: startsLater,
      status: 'accepted',
      deletedAt: null,
      availabilitySlotId: null,
    };
    lessonsRepo.findOne.mockResolvedValue(lesson);
    lessonsRepo.save.mockImplementation(async (input) => input);
    instructorsRepo.findOne.mockResolvedValue({
      id: 'ins-1',
      userId: 'instructor-user-1',
      deletedAt: null,
    });
    availabilityRepo.findOne.mockResolvedValue(null);

    const saved = await service.cancelLessonAsLearner(
      { userId: 'learner-1', role: 'USER' },
      'lesson-1',
      { emergency: false },
    );

    expect(saved.status).toBe('cancelled');
    expect(notificationsService.createForUser).toHaveBeenCalled();
    expect(auditRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'learner-1',
        action: 'LESSON_CANCELLED_BY_LEARNER',
      }),
    );
  });

  it('blocks learner reschedule under 24h without emergency flag', async () => {
    const startsSoon = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const lockedLesson = {
      id: 'lesson-1',
      instructorId: 'ins-1',
      learnerUserId: 'learner-1',
      scheduledAt: startsSoon,
      durationMinutes: 60,
      status: 'accepted',
      availabilitySlotId: 'slot-old',
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
        { userId: 'learner-1', role: 'USER' },
        'lesson-1',
        { availabilitySlotId: 'slot-new', emergency: false },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(availabilityRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('allows learner emergency reschedule under 24h and records emergency metadata', async () => {
    const startsSoon = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const targetStart = new Date(Date.now() + 5 * 60 * 60 * 1000);
    const targetEnd = new Date(Date.now() + 6 * 60 * 60 * 1000);
    const lockedLesson = {
      id: 'lesson-1',
      instructorId: 'ins-1',
      learnerUserId: 'learner-1',
      scheduledAt: startsSoon,
      durationMinutes: 60,
      status: 'accepted',
      availabilitySlotId: 'slot-old',
      disputeLocked: false,
      deletedAt: null,
    };
    const targetSlot = {
      id: 'slot-new',
      instructorId: 'ins-1',
      startsAt: targetStart,
      endsAt: targetEnd,
      status: 'open',
      bookedLessonId: null,
      deletedAt: null,
    };
    const previousSlot = {
      id: 'slot-old',
      instructorId: 'ins-1',
      startsAt: startsSoon,
      endsAt: new Date(startsSoon.getTime() + 60 * 60 * 1000),
      status: 'booked',
      bookedLessonId: 'lesson-1',
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
      id: 'ins-1',
      userId: 'instructor-user-1',
      deletedAt: null,
      hourlyRatePence: 4200,
    });

    const saved = await service.rescheduleLessonAsLearner(
      { userId: 'learner-1', role: 'USER' },
      'lesson-1',
      { availabilitySlotId: 'slot-new', emergency: true },
    );

    expect(saved.availabilitySlotId).toBe('slot-new');
    expect(saved.scheduledAt?.toISOString()).toBe(targetStart.toISOString());
    expect(availabilityRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'slot-new',
        status: 'booked',
        bookedLessonId: 'lesson-1',
      }),
    );
    expect(availabilityRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'slot-old',
        status: 'open',
        bookedLessonId: null,
      }),
    );
    expect(notificationsService.createForUser).toHaveBeenCalledWith(
      'instructor-user-1',
      'booking_status',
      'Learner rescheduled booking',
      expect.any(String),
      expect.objectContaining({
        lessonId: 'lesson-1',
        availabilitySlotId: 'slot-new',
        emergency: true,
      }),
      'learner-1',
    );

    const rescheduleAuditCall = auditRepo.save.mock.calls.find(
      ([entry]) => entry?.action === 'LESSON_RESCHEDULED_BY_LEARNER',
    );
    expect(rescheduleAuditCall).toBeDefined();
    expect(rescheduleAuditCall?.[0]).toEqual(
      expect.objectContaining({
        userId: 'learner-1',
        action: 'LESSON_RESCHEDULED_BY_LEARNER',
        metadata: expect.objectContaining({
          lessonId: 'lesson-1',
          emergency: true,
          previousAvailabilitySlotId: 'slot-old',
        }),
      }),
    );
  });

  it('records an immutable audit event when instructor updates lesson status', async () => {
    const lesson = {
      id: 'lesson-1',
      instructorId: 'ins-1',
      learnerUserId: 'learner-1',
      scheduledAt: null,
      durationMinutes: null,
      status: 'requested',
      availabilitySlotId: null,
      deletedAt: null,
    };
    lessonsRepo.findOne.mockResolvedValue(lesson);
    lessonsRepo.save.mockImplementation(async (input) => input);
    instructorsRepo.findOne.mockResolvedValue({
      id: 'ins-1',
      userId: 'instructor-user-1',
      deletedAt: null,
    });

    await service.updateLessonStatus(
      { userId: 'instructor-user-1', role: 'instructor' },
      'lesson-1',
      { status: 'declined' },
    );

    expect(auditRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'instructor-user-1',
        action: 'LESSON_STATUS_UPDATED',
        metadata: expect.objectContaining({
          lessonId: 'lesson-1',
          previousStatus: 'requested',
          nextStatus: 'declined',
        }),
      }),
    );
  });

  it('creates a booking terms snapshot during learner lesson creation', async () => {
    instructorsRepo.findOne.mockResolvedValue({
      id: 'ins-1',
      userId: 'instructor-user-1',
      deletedAt: null,
      isApproved: true,
      suspendedAt: null,
      hourlyRatePence: 4200,
    });
    usersRepo.findOne.mockResolvedValue({
      id: 'learner-1',
      phone: '+447700900123',
    });
    lessonsRepo.save.mockImplementation(async (input) => ({
      ...input,
      id: 'lesson-created-1',
      createdAt: new Date('2026-03-23T10:00:00.000Z'),
      updatedAt: new Date('2026-03-23T10:00:00.000Z'),
      deletedAt: null,
    }));
    lessonFinanceRepo.save.mockImplementation(async (input) => ({
      ...input,
      id: 'finance-1',
      updatedAt: new Date('2026-03-23T10:00:00.000Z'),
    }));
    bookingTermsRepo.findOne.mockResolvedValue(null);
    bookingTermsRepo.save.mockImplementation(async (input) => ({
      ...input,
      id: 'snapshot-1',
      createdAt: new Date('2026-03-23T10:00:01.000Z'),
    }));

    await service.createLesson(
      { userId: 'learner-1', role: 'USER' },
      {
        instructorId: 'ins-1',
        learnerNote: 'Please meet at station',
      },
    );

    expect(bookingTermsRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 'lesson-created-1',
        learnerUserId: 'learner-1',
        instructorProfileId: 'ins-1',
        instructorUserId: 'instructor-user-1',
      }),
    );
  });

  it('stores instructor declaration evidence with audit event', async () => {
    legalDocumentVersionRepo.findOne.mockResolvedValue({
      id: 'legal-doc-1',
      documentType: 'instructor_hub_terms',
      version: '2026-03-23.instructor_declaration.v1',
    });

    const result = await service.submitInstructorDeclaration(
      { userId: 'instructor-user-1', role: 'instructor' },
      {
        declarationVersion: '2026-03-23.instructor_declaration.v1',
        acceptedClauses: { lawfulInstruction: true, insuranceConfirmed: true },
        appVersion: '1.0.0',
        platform: 'ios',
      },
    );

    expect(instructorDeclarationRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        instructorUserId: 'instructor-user-1',
        declarationVersion: '2026-03-23.instructor_declaration.v1',
        legalDocumentVersionId: 'legal-doc-1',
      }),
    );
    expect(auditRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'instructor-user-1',
        action: 'INSTRUCTOR_DECLARATION_ACCEPTED',
      }),
    );
    expect(result.declarationVersion).toBe('2026-03-23.instructor_declaration.v1');
  });

  it('blocks learner booking quote when account restriction is active', async () => {
    accountRestrictionsRepo.createQueryBuilder.mockReturnValueOnce({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 'restriction-1',
          userId: 'learner-1',
          restrictionType: 'booking_block',
          reasonCode: 'fraud_review',
          startsAt: new Date(Date.now() - 1000),
          endsAt: null,
          active: true,
          createdAt: new Date(),
        },
      ]),
    });

    await expect(
      service.createBookingQuote(
        { userId: 'learner-1', role: 'USER' },
        { instructorId: 'ins-1' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('records instructor review decision and updates profile state', async () => {
    instructorsRepo.findOne.mockResolvedValue({
      id: 'ins-1',
      userId: 'instructor-user-1',
      fullName: 'Raj',
      email: 'raj@gmail.com',
      phone: null,
      adiNumber: 'ADI123',
      profilePhotoUrl: null,
      yearsExperience: null,
      transmissionType: 'both',
      hourlyRatePence: 5000,
      bio: null,
      languages: [],
      coveragePostcodes: [],
      bankAccountHolderName: null,
      bankSortCode: null,
      bankAccountNumber: null,
      bankName: null,
      isApproved: false,
      approvedAt: null,
      suspendedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    const result = await service.applyInstructorReviewDecision(
      { userId: 'admin-1', role: 'ADMIN' },
      'ins-1',
      {
        decision: 'approved',
        notesInternal: 'All checks complete',
      },
    );

    expect(instructorReviewRecordRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        instructorUserId: 'instructor-user-1',
        reviewStatus: 'approved',
        reviewedByAdminUserId: 'admin-1',
      }),
    );
    expect(result.profile.isApproved).toBe(true);
  });
});
