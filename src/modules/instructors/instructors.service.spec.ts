import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InstructorsService } from './instructors.service';
import { InstructorEntity } from './entities/instructor.entity';
import { InstructorReviewEntity } from './entities/instructor-review.entity';
import { LessonEntity } from './entities/lesson.entity';
import { InstructorAvailabilityEntity } from './entities/instructor-availability.entity';
import { NotificationsService } from '../notifications/notifications.service';

type MockRepo<T extends object> = {
  findOne: jest.Mock;
  find: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  softDelete: jest.Mock;
  createQueryBuilder: jest.Mock;
};

function createMockRepo<T extends object>(): MockRepo<T> {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((input: T) => input),
    save: jest.fn(async (input: T) => input),
    softDelete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

describe('InstructorsService', () => {
  let service: InstructorsService;
  let instructorsRepo: MockRepo<InstructorEntity>;
  let reviewsRepo: MockRepo<InstructorReviewEntity>;
  let lessonsRepo: MockRepo<LessonEntity>;
  let availabilityRepo: MockRepo<InstructorAvailabilityEntity>;
  let notificationsService: { createForUser: jest.Mock };

  beforeEach(async () => {
    instructorsRepo = createMockRepo<InstructorEntity>();
    reviewsRepo = createMockRepo<InstructorReviewEntity>();
    lessonsRepo = createMockRepo<LessonEntity>();
    availabilityRepo = createMockRepo<InstructorAvailabilityEntity>();
    notificationsService = { createForUser: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        InstructorsService,
        { provide: getRepositoryToken(InstructorEntity), useValue: instructorsRepo },
        { provide: getRepositoryToken(InstructorReviewEntity), useValue: reviewsRepo },
        { provide: getRepositoryToken(LessonEntity), useValue: lessonsRepo },
        { provide: getRepositoryToken(InstructorAvailabilityEntity), useValue: availabilityRepo },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = moduleRef.get(InstructorsService);
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
});
