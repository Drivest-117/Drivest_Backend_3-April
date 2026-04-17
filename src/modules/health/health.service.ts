import { Injectable, Optional } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { DataSource } from 'typeorm';

type HealthBuildMetadata = {
  version: string;
  gitSha: string | null;
  gitShaShort: string | null;
  gitRef: string | null;
  deployedAt: string | null;
  workflowRunId: string | null;
  workflowRunNumber: string | null;
};

type HealthDependencyStatus = {
  status: 'ok' | 'error' | 'skipped';
  latencyMs: number | null;
  error: string | null;
};

@Injectable()
export class HealthService {
  constructor(
    @Optional()
    @InjectDataSource()
    private readonly dataSource?: DataSource,
  ) {}

  async snapshot() {
    const database = await this.databaseStatus();
    return {
      status: database.status === 'ok' ? 'ok' : 'degraded',
      build: this.buildMetadata(),
      dependencies: {
        database,
      },
    };
  }

  private buildMetadata(): HealthBuildMetadata {
    const version = this.resolveVersion();
    const gitSha = this.normalizedEnv('DEPLOY_GIT_SHA');

    return {
      version,
      gitSha,
      gitShaShort: gitSha ? gitSha.slice(0, 7) : null,
      gitRef: this.normalizedEnv('DEPLOY_GIT_REF'),
      deployedAt: this.normalizedEnv('DEPLOYED_AT'),
      workflowRunId: this.normalizedEnv('DEPLOY_RUN_ID'),
      workflowRunNumber: this.normalizedEnv('DEPLOY_RUN_NUMBER'),
    };
  }

  private resolveVersion(): string {
    const envVersion = this.normalizedEnv('APP_VERSION');
    if (envVersion) {
      return envVersion;
    }

    try {
      const packagePath = path.resolve(process.cwd(), 'package.json');
      const raw = fs.readFileSync(packagePath, 'utf8');
      const parsed = JSON.parse(raw) as { version?: unknown };
      if (typeof parsed.version === 'string' && parsed.version.trim().length > 0) {
        return parsed.version.trim();
      }
    } catch {
      // Ignore package resolution failures and fall back to unknown.
    }

    return 'unknown';
  }

  private normalizedEnv(key: string): string | null {
    const value = process.env[key]?.trim();
    return value ? value : null;
  }

  private async databaseStatus(): Promise<HealthDependencyStatus> {
    if (!this.dataSource) {
      return {
        status: 'skipped',
        latencyMs: null,
        error: 'Database connection not configured',
      };
    }

    const startedAt = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
      return {
        status: 'ok',
        latencyMs: Date.now() - startedAt,
        error: null,
      };
    } catch (error) {
      return {
        status: 'error',
        latencyMs: Date.now() - startedAt,
        error: this.formatError(error),
      };
    }
  }

  private formatError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return 'Unknown database error';
  }
}
