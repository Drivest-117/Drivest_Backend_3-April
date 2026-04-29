import axios from 'axios';
import { ContentPackManifest } from '../../entities/content-pack-manifest.entity';
import { ContentPacksService } from './content-packs.service';

jest.mock('axios');

type MockQueryBuilder = {
  where: jest.Mock;
  andWhere: jest.Mock;
  orderBy: jest.Mock;
  addOrderBy: jest.Mock;
  getMany: jest.Mock<Promise<ContentPackManifest[]>, []>;
};

type MockRepo = {
  createQueryBuilder: jest.Mock<MockQueryBuilder, [string]>;
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
};

function createMockQueryBuilder(rows: ContentPackManifest[]): MockQueryBuilder {
  const builder = {
    where: jest.fn(),
    andWhere: jest.fn(),
    orderBy: jest.fn(),
    addOrderBy: jest.fn(),
    getMany: jest.fn().mockResolvedValue(rows),
  } as unknown as MockQueryBuilder;

  builder.where.mockReturnValue(builder);
  builder.andWhere.mockReturnValue(builder);
  builder.orderBy.mockReturnValue(builder);
  builder.addOrderBy.mockReturnValue(builder);
  return builder;
}

function createMockRepo(): MockRepo {
  return {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
  };
}

function createManifestRow(
  overrides: Partial<ContentPackManifest>,
): ContentPackManifest {
  const now = new Date('2026-04-25T07:00:00.000Z');
  return {
    id: overrides.id ?? 'row-1',
    platform: overrides.platform ?? 'ios',
    moduleKey: overrides.moduleKey ?? 'fines_penalties',
    contentKind: overrides.contentKind ?? 'questions',
    language: overrides.language ?? 'en',
    version: overrides.version ?? '20260425-a',
    hash: overrides.hash ?? 'hash',
    sizeBytes: overrides.sizeBytes ?? 1024,
    url: overrides.url ?? 'https://example.invalid/pack_en.json',
    minAppVersion: overrides.minAppVersion ?? '1.0.0',
    isActive: overrides.isActive ?? true,
    metadata: overrides.metadata ?? null,
    publishedAt: overrides.publishedAt ?? now,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  } as ContentPackManifest;
}

describe('ContentPacksService fines localization fallback', () => {
  const mockedAxios = axios as jest.Mocked<typeof axios>;
  let repo: MockRepo;
  let service: ContentPacksService;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = createMockRepo();
    service = new ContentPacksService(repo as any);
  });

  it('falls back to English fines pack when localized content is contaminated', async () => {
    const localized = createManifestRow({
      id: 'row-ar',
      language: 'ar',
      version: '20260425-ar',
      url: 'https://cdn.example/fines/pack_ar.json',
    });
    const english = createManifestRow({
      id: 'row-en',
      language: 'en',
      version: '20260425-en',
      url: 'https://cdn.example/fines/pack_en.json',
    });

    repo.createQueryBuilder
      .mockReturnValueOnce(createMockQueryBuilder([localized]))
      .mockReturnValueOnce(createMockQueryBuilder([english]));

    mockedAxios.get.mockResolvedValue({
      data: {
        questions: [
          {
            prompt: 'متأثر القيادة primarily توجد',
            explanation: 'supply firms confirms warning',
            options: ['vehicle', 'safe', 'route', 'choice'],
          },
        ],
      },
    } as any);

    const manifest = await service.getManifest({
      platform: 'ios',
      module: 'fines_penalties',
      kind: 'questions',
      language: 'ar',
    });

    expect(manifest.items).toHaveLength(1);
    expect(manifest.items[0].language).toBe('ar');
    expect(manifest.items[0].url).toBe(english.url);
    expect(manifest.items[0].version).toBe(english.version);
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    expect(repo.createQueryBuilder).toHaveBeenCalledTimes(2);
  });

  it('keeps localized fines pack when contamination is not detected', async () => {
    const localized = createManifestRow({
      id: 'row-ar',
      language: 'ar',
      version: '20260425-ar',
      url: 'https://cdn.example/fines/pack_ar.json',
    });

    repo.createQueryBuilder.mockReturnValueOnce(
      createMockQueryBuilder([localized]),
    );

    mockedAxios.get.mockResolvedValue({
      data: {
        questions: [
          {
            prompt: 'ما العقوبة إذا تجاوزت السرعة',
            explanation: 'تبدأ الغرامة من مبلغ محدد مع نقاط.',
            options: ['خيار أول', 'خيار ثان', 'خيار ثالث', 'خيار رابع'],
          },
        ],
      },
    } as any);

    const manifest = await service.getManifest({
      platform: 'ios',
      module: 'fines_penalties',
      kind: 'questions',
      language: 'ar',
    });

    expect(manifest.items).toHaveLength(1);
    expect(manifest.items[0].language).toBe('ar');
    expect(manifest.items[0].url).toBe(localized.url);
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    expect(repo.createQueryBuilder).toHaveBeenCalledTimes(1);
  });

  it('detects contamination when fines payload uses array schema with question field', async () => {
    const localized = createManifestRow({
      id: 'row-ar',
      language: 'ar',
      version: '20260425-ar',
      url: 'https://cdn.example/fines/pack_ar.json',
    });
    const english = createManifestRow({
      id: 'row-en',
      language: 'en',
      version: '20260425-en',
      url: 'https://cdn.example/fines/pack_en.json',
    });

    repo.createQueryBuilder
      .mockReturnValueOnce(createMockQueryBuilder([localized]))
      .mockReturnValueOnce(createMockQueryBuilder([english]));

    mockedAxios.get.mockResolvedValue({
      data: [
        {
          question: 'هذا primarily اختبار speeding و insurance',
          explanation: 'court fixed penalty points',
          options: ['mobile', 'phone', 'warning', 'choice'],
        },
      ],
    } as any);

    const manifest = await service.getManifest({
      platform: 'ios',
      module: 'fines_penalties',
      kind: 'questions',
      language: 'ar',
    });

    expect(manifest.items).toHaveLength(1);
    expect(manifest.items[0].language).toBe('ar');
    expect(manifest.items[0].url).toBe(english.url);
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    expect(repo.createQueryBuilder).toHaveBeenCalledTimes(2);
  });

  it('uses metadata contamination flag without downloading the localized pack', async () => {
    const localized = createManifestRow({
      id: 'row-ar',
      language: 'ar',
      version: '20260425-ar',
      url: 'https://cdn.example/fines/pack_ar.json',
      metadata: {
        localizationContaminated: true,
      },
    });
    const english = createManifestRow({
      id: 'row-en',
      language: 'en',
      version: '20260425-en',
      url: 'https://cdn.example/fines/pack_en.json',
    });

    repo.createQueryBuilder
      .mockReturnValueOnce(createMockQueryBuilder([localized]))
      .mockReturnValueOnce(createMockQueryBuilder([english]));

    const manifest = await service.getManifest({
      platform: 'ios',
      module: 'fines_penalties',
      kind: 'questions',
      language: 'ar',
    });

    expect(manifest.items).toHaveLength(1);
    expect(manifest.items[0].language).toBe('ar');
    expect(manifest.items[0].url).toBe(english.url);
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });
});
