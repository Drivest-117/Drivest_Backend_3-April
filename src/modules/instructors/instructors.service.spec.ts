import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InstructorsService } from './instructors.service';
import { InstructorEntity } from './entities/instructor.entity';
import { InstructorReviewEntity } from './entities/instructor-review.entity';
import { LessonEntity } from './entities/lesson.entity';
import { InstructorAvailabilityEntity } from './entities/instructor-availability.entity';
import { LessonPaymentEntity } from './entities/lesson-payment.entity';
import { LessonFinanceSnapshotEntity } from './entities/lesson-finance-snapshot.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../../entities/user.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { DisputeCaseEntity } from '../disputes/entities/dispute-case.entity';

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
  let lessonPaymentsRepo: MockRepo<LessonPaymentEntity>;
  let lessonFinanceRepo: MockRepo<LessonFinanceSnapshotEntity>;
  let availabilityRepo: MockRepo<InstructorAvailabilityEntity>;
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
            if (entity === InstructorAvailabilityEntity) return availabilityRepo;
            if (entity === InstructorEntity) return instructorsRepo;
            if (entity === User) return usersRepo;
            if (entity === LessonFinanceSnapshotEntity) return lessonFinanceRepo;
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
        { provide: getRepositoryToken(LessonPaymentEntity), useValue: lessonPaymentsRepo },
        { provide: getRepositoryToken(LessonFinanceSnapshotEntity), useValue: lessonFinanceRepo },
        { provide: getRepositoryToken(InstructorAvailabilityEntity), useValue: availabilityRepo },
        { provide: getRepositoryToken(DisputeCaseEntity), useValue: disputesRepo },
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
});
