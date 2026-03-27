import { HealthService } from './health.service';

describe('HealthService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns deploy metadata from the process environment', () => {
    process.env.APP_VERSION = '1.2.3';
    process.env.DEPLOY_GIT_SHA = 'abcdef1234567890';
    process.env.DEPLOY_GIT_REF = 'main';
    process.env.DEPLOYED_AT = '2026-03-27T05:00:00Z';
    process.env.DEPLOY_RUN_ID = '1001';
    process.env.DEPLOY_RUN_NUMBER = '88';

    const service = new HealthService();

    expect(service.snapshot()).toEqual({
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
    });
  });
});
