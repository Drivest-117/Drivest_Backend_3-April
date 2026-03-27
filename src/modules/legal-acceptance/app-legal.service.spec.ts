import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Request } from 'express';
import { AuditLog } from '../../entities/audit-log.entity';
import { User } from '../../entities/user.entity';
import { AppLegalService } from './app-legal.service';
import { ConsentHistoryEntity } from './entities/consent-history.entity';
import { LegalDocumentVersionEntity } from './entities/legal-document-version.entity';
import { UserConsentEntity } from './entities/user-consent.entity';
import { UserLegalAcceptanceEntity } from './entities/user-legal-acceptance.entity';

type MockRepo<T extends object> = {
  findOne: jest.Mock;
  find: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  update: jest.Mock;
};

function createMockRepo<T extends object>(): MockRepo<T> {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((input: T) => input),
    save: jest.fn(async (input: T) => input),
    update: jest.fn(async () => ({ affected: 1 })),
  };
}

describe('AppLegalService', () => {
  let service: AppLegalService;
  let legalDocumentsRepo: MockRepo<LegalDocumentVersionEntity>;
  let userLegalAcceptancesRepo: MockRepo<UserLegalAcceptanceEntity>;
  let userConsentsRepo: MockRepo<UserConsentEntity>;
  let consentHistoryRepo: MockRepo<ConsentHistoryEntity>;
  let usersRepo: MockRepo<User>;
  let auditRepo: MockRepo<AuditLog>;
  let jwtService: { verifyAsync: jest.Mock };

  beforeEach(async () => {
    legalDocumentsRepo = createMockRepo<LegalDocumentVersionEntity>();
    userLegalAcceptancesRepo = createMockRepo<UserLegalAcceptanceEntity>();
    userConsentsRepo = createMockRepo<UserConsentEntity>();
    consentHistoryRepo = createMockRepo<ConsentHistoryEntity>();
    usersRepo = createMockRepo<User>();
    auditRepo = createMockRepo<AuditLog>();
    jwtService = {
      verifyAsync: jest.fn(),
    };

    const currentDocuments = [
      {
        id: 'terms-doc',
        documentType: 'terms',
        version: '3.0',
        contentHash: 'hash-terms',
        publicationTimestamp: new Date('2026-03-24T00:00:00.000Z'),
        isActive: true,
        metadata: {},
        createdAt: new Date('2026-03-24T00:00:00.000Z'),
      },
      {
        id: 'privacy-doc',
        documentType: 'privacy',
        version: '3.0',
        contentHash: 'hash-privacy',
        publicationTimestamp: new Date('2026-03-24T00:00:00.000Z'),
        isActive: true,
        metadata: {},
        createdAt: new Date('2026-03-24T00:00:00.000Z'),
      },
      {
        id: 'safety-doc',
        documentType: 'safety_notice',
        version: '2026-03-24.v1',
        contentHash: 'hash-safety',
        publicationTimestamp: new Date('2026-03-24T00:00:00.000Z'),
        isActive: true,
        metadata: {},
        createdAt: new Date('2026-03-24T00:00:00.000Z'),
      },
    ];

    legalDocumentsRepo.findOne.mockResolvedValue(currentDocuments[0]);
    legalDocumentsRepo.find.mockResolvedValue(currentDocuments);

    let savedAcceptance: any = null;
    userLegalAcceptancesRepo.save.mockImplementation(async (input: any) => {
      savedAcceptance = {
        id: 'acceptance-1',
        createdAt: new Date('2026-03-27T08:00:00.000Z'),
        ...input,
      };
      return savedAcceptance;
    });
    userLegalAcceptancesRepo.findOne.mockImplementation(async ({ where }: any) => {
      if (where?.installIdentifier === 'install-123') {
        return savedAcceptance;
      }
      return null;
    });

    userConsentsRepo.find.mockResolvedValue([]);

    const moduleRef = await Test.createTestingModule({
      providers: [
        AppLegalService,
        {
          provide: getRepositoryToken(LegalDocumentVersionEntity),
          useValue: legalDocumentsRepo,
        },
        {
          provide: getRepositoryToken(UserLegalAcceptanceEntity),
          useValue: userLegalAcceptancesRepo,
        },
        {
          provide: getRepositoryToken(UserConsentEntity),
          useValue: userConsentsRepo,
        },
        {
          provide: getRepositoryToken(ConsentHistoryEntity),
          useValue: consentHistoryRepo,
        },
        {
          provide: getRepositoryToken(User),
          useValue: usersRepo,
        },
        {
          provide: getRepositoryToken(AuditLog),
          useValue: auditRepo,
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
      ],
    }).compile();

    service = moduleRef.get(AppLegalService);
  });

  it('treats a stale authenticated token as anonymous when the user no longer exists', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: '11111111-1111-4111-8111-111111111111',
    });
    usersRepo.findOne.mockResolvedValue(null);

    const req = {
      headers: {
        'x-drivest-install-id': 'install-123',
        'x-drivest-platform': 'ios',
        'x-drivest-app-version': '1.0.0 (1)',
        authorization: 'Bearer stale-token',
      },
    } as unknown as Request;

    const result = await service.recordLegalAcceptance(req, {
      termsVersion: '3.0',
      privacyVersion: '3.0',
      safetyVersion: '2026-03-24.v1',
      ageConfirmed: true,
      safetyAccepted: true,
      sourceScreen: 'onboarding_legal',
    });

    expect(userLegalAcceptancesRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: null,
        installIdentifier: 'install-123',
      }),
    );
    expect(auditRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: null,
        action: 'APP_LEGAL_ACCEPTANCE_RECORDED',
      }),
    );
    expect(usersRepo.update).not.toHaveBeenCalled();
    expect(result.acceptance?.isCurrent).toBe(true);
  });
});
