import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLog } from '../../entities/audit-log.entity';
import { MarketplaceLegalAcceptanceEntity } from './entities/marketplace-legal-acceptance.entity';
import { LegalAcceptanceService } from './legal-acceptance.service';

type MockRepo<T extends object> = {
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
};

function createMockRepo<T extends object>(): MockRepo<T> {
  return {
    findOne: jest.fn(),
    create: jest.fn((input: T) => input),
    save: jest.fn(async (input: T) => input),
  };
}

describe('LegalAcceptanceService', () => {
  let service: LegalAcceptanceService;
  let legalAcceptanceRepo: MockRepo<MarketplaceLegalAcceptanceEntity>;
  let auditRepo: MockRepo<AuditLog>;

  beforeEach(async () => {
    legalAcceptanceRepo = createMockRepo<MarketplaceLegalAcceptanceEntity>();
    auditRepo = createMockRepo<AuditLog>();

    const moduleRef = await Test.createTestingModule({
      providers: [
        LegalAcceptanceService,
        {
          provide: getRepositoryToken(MarketplaceLegalAcceptanceEntity),
          useValue: legalAcceptanceRepo,
        },
        {
          provide: getRepositoryToken(AuditLog),
          useValue: auditRepo,
        },
      ],
    }).compile();

    service = moduleRef.get(LegalAcceptanceService);
  });

  it('returns not accepted state when there is no acceptance row', async () => {
    legalAcceptanceRepo.findOne.mockResolvedValue(null);

    const result = await service.getCurrentAcceptance(
      { userId: 'learner-1', role: 'USER' },
      'find_instructor',
    );

    expect(result.accepted).toBe(false);
    expect(result.acceptance).toBeNull();
    expect(result.currentVersion).toBeTruthy();
  });

  it('blocks instructor-hub learner access by role', async () => {
    await expect(
      service.getCurrentAcceptance({ userId: 'learner-1', role: 'USER' }, 'instructor_hub'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('creates acceptance for current version and writes audit log', async () => {
    legalAcceptanceRepo.findOne.mockResolvedValueOnce(null);
    legalAcceptanceRepo.save.mockImplementation(async (input) => ({
      ...input,
      id: 'legal-1',
      createdAt: new Date('2026-03-23T12:00:00.000Z'),
    }));

    const result = await service.acceptCurrentVersion(
      { userId: 'instructor-1', role: 'INSTRUCTOR' },
      'instructor_hub',
      { locale: 'en-GB' },
    );

    expect(result.accepted).toBe(true);
    expect(result.alreadyAccepted).toBe(false);
    expect(legalAcceptanceRepo.save).toHaveBeenCalled();
    expect(auditRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'instructor-1',
        action: 'MARKETPLACE_LEGAL_ACCEPTED',
      }),
    );
  });

  it('returns existing acceptance without creating duplicates', async () => {
    const existing = {
      id: 'legal-1',
      userId: 'learner-1',
      userRole: 'learner',
      surface: 'find_instructor',
      version: '2026-03-23.find_instructor.v1',
      acceptedAt: new Date('2026-03-23T10:00:00.000Z'),
      createdAt: new Date('2026-03-23T10:00:00.000Z'),
      metadata: null,
    };
    legalAcceptanceRepo.findOne.mockResolvedValue(existing);

    const result = await service.acceptCurrentVersion(
      { userId: 'learner-1', role: 'USER' },
      'find_instructor',
    );

    expect(result.accepted).toBe(true);
    expect(result.alreadyAccepted).toBe(true);
    expect(legalAcceptanceRepo.save).not.toHaveBeenCalled();
    expect(auditRepo.save).not.toHaveBeenCalled();
  });
});
