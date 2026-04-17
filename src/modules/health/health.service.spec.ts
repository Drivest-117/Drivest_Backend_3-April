import { HealthService } from './health.service';

describe('HealthService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns deploy metadata and database status from the process environment', async () => {
    process.env.APP_VERSION = '1.2.3';
    process.env.DEPLOY_GIT_SHA = 'abcdef1234567890';
    process.env.DEPLOY_GIT_REF = 'main';
    process.env.DEPLOYED_AT = '2026-03-27T05:00:00Z';
    process.env.DEPLOY_RUN_ID = '1001';
    process.env.DEPLOY_RUN_NUMBER = '88';

    const service = new HealthService({
      query: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    } as any);

    await expect(service.snapshot()).resolves.toEqual({
      status: 'ok',
      build: {
        version: '1.2.3',
        gitSha: 'abcdef1234567890',
        gitShaShort: 'abcdef1',
        gitRef: 'main',
        deployedAt: '2026-03-27T05:00:00Z',
        workflowRunId: '1001',
        workflowRunNumber: '88',
      },
      dependencies: {
        database: {
          status: 'ok',
          latencyMs: expect.any(Number),
          error: null,
        },
      },
    });
  });

  it('marks health degraded when the database ping fails', async () => {
    const service = new HealthService({
      query: jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED')),
    } as any);

    await expect(service.snapshot()).resolves.toEqual({
      status: 'degraded',
      build: {
        version: expect.any(String),
        gitSha: null,
        gitShaShort: null,
        gitRef: null,
        deployedAt: null,
        workflowRunId: null,
        workflowRunNumber: null,
      },
      dependencies: {
        database: {
          status: 'error',
          latencyMs: expect.any(Number),
          error: 'connect ECONNREFUSED',
        },
      },
    });
  });
});
