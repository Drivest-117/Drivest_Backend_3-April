import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLog } from '../../entities/audit-log.entity';
import { User } from '../../entities/user.entity';
import { InstructorEntity } from '../instructors/entities/instructor.entity';
import { LessonFinanceSnapshotEntity } from '../instructors/entities/lesson-finance-snapshot.entity';
import { LessonEntity } from '../instructors/entities/lesson.entity';
import { DisputesService } from './disputes.service';
import { DisputeCaseEntity } from './entities/dispute-case.entity';

type MockRepo<T extends object> = {
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  createQueryBuilder: jest.Mock;
};

function createMockRepo<T extends object>(): MockRepo<T> {
  return {
    findOne: jest.fn(),
    create: jest.fn((input: T) => input),
    save: jest.fn(async (input: T) => input),
    createQueryBuilder: jest.fn(),
  };
}

describe('DisputesService', () => {
  let service: DisputesService;
  let disputesRepo: MockRepo<DisputeCaseEntity>;
  let lessonsRepo: MockRepo<LessonEntity>;
  let instructorsRepo: MockRepo<InstructorEntity>;
  let lessonFinanceRepo: MockRepo<LessonFinanceSnapshotEntity>;
  let usersRepo: MockRepo<User>;
  let auditRepo: MockRepo<AuditLog>;

  beforeEach(async () => {
    disputesRepo = createMockRepo<DisputeCaseEntity>();
    lessonsRepo = createMockRepo<LessonEntity>();
    instructorsRepo = createMockRepo<InstructorEntity>();
    lessonFinanceRepo = createMockRepo<LessonFinanceSnapshotEntity>();
    usersRepo = createMockRepo<User>();
    auditRepo = createMockRepo<AuditLog>();

    const moduleRef = await Test.createTestingModule({
      providers: [
        DisputesService,
        { provide: getRepositoryToken(DisputeCaseEntity), useValue: disputesRepo },
        { provide: getRepositoryToken(LessonEntity), useValue: lessonsRepo },
        { provide: getRepositoryToken(InstructorEntity), useValue: instructorsRepo },
        { provide: getRepositoryToken(LessonFinanceSnapshotEntity), useValue: lessonFinanceRepo },
        { provide: getRepositoryToken(User), useValue: usersRepo },
        { provide: getRepositoryToken(AuditLog), useValue: auditRepo },
      ],
    }).compile();

    service = moduleRef.get(DisputesService);
    lessonFinanceRepo.findOne.mockResolvedValue(null);
    lessonFinanceRepo.save.mockImplementation(async (input) => input);
  });

  it('opens a case for a learner linked to a lesson and sets SLA fields', async () => {
    lessonsRepo.findOne.mockResolvedValue({
      id: 'lesson-1',
      instructorId: 'ins-1',
      learnerUserId: 'learner-1',
      deletedAt: null,
    });
    instructorsRepo.findOne.mockResolvedValue({
      id: 'ins-1',
      userId: 'instructor-user-1',
      deletedAt: null,
    });
    usersRepo.findOne.mockResolvedValue({ id: 'instructor-user-1', deletedAt: null });

    const created = await service.openCase(
      { userId: 'learner-1', role: 'USER' },
      {
        lessonId: 'lesson-1',
        title: 'Instructor did not attend',
        description: 'Instructor was absent at pickup location and did not respond.',
        category: 'booking',
        priority: 'normal',
      },
    );

    expect(created.status).toBe('opened');
    expect(created.lessonId).toBe('lesson-1');
    expect(created.againstUserId).toBe('instructor-user-1');
    expect(created.firstResponseBy).toBeInstanceOf(Date);
    expect(created.resolutionTargetBy).toBeInstanceOf(Date);
    expect(auditRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DISPUTE_CASE_OPENED', userId: 'learner-1' }),
    );
  });

  it('rejects lesson-linked case when learner is not the booking learner', async () => {
    lessonsRepo.findOne.mockResolvedValue({
      id: 'lesson-1',
      instructorId: 'ins-1',
      learnerUserId: 'different-learner',
      deletedAt: null,
    });
    instructorsRepo.findOne.mockResolvedValue({
      id: 'ins-1',
      userId: 'instructor-user-1',
      deletedAt: null,
    });

    await expect(
      service.openCase(
        { userId: 'learner-1', role: 'USER' },
        {
          lessonId: 'lesson-1',
          title: 'Issue',
          description: 'This learner should not be able to open this case',
          category: 'booking',
          priority: 'normal',
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires against party details when no lesson is provided', async () => {
    await expect(
      service.openCase(
        { userId: 'learner-1', role: 'USER' },
        {
          title: 'Generic complaint',
          description: 'Complaint without linked lesson and without against details',
          category: 'other',
          priority: 'low',
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows admin status update and timestamps response/resolution', async () => {
    disputesRepo.findOne.mockResolvedValue({
      id: 'dc-1',
      openedByUserId: 'learner-1',
      openedByRole: 'learner',
      againstUserId: 'instructor-user-1',
      againstRole: 'instructor',
      status: 'triage',
      respondedAt: null,
      resolvedAt: null,
      closedAt: null,
      resolutionTargetBy: new Date(),
      deletedAt: null,
    });

    const updated = await service.updateStatusAsAdmin(
      { userId: 'admin-1', role: 'ADMIN' },
      'dc-1',
      {
        status: 'resolved',
        note: 'Evidence reviewed and refund approved',
      },
    );

    expect(updated.status).toBe('resolved');
    expect(updated.respondedAt).toBeInstanceOf(Date);
    expect(updated.resolvedAt).toBeInstanceOf(Date);
    expect(auditRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DISPUTE_CASE_STATUS_UPDATED', userId: 'admin-1' }),
    );
  });
});
