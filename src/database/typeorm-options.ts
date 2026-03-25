import { DataSourceOptions } from 'typeorm';

function readBool(value: string | undefined, fallback = false): boolean {
  if (value == null) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function readInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

function buildSslOptions() {
  if (!readBool(process.env.DB_SSL, false)) {
    return false;
  }
  return {
    rejectUnauthorized: readBool(process.env.DB_SSL_REJECT_UNAUTHORIZED, false),
  };
}

export function buildTypeOrmOptions(
  overrides: Partial<DataSourceOptions> = {},
): DataSourceOptions {
  return {
    type: 'postgres',
    url: process.env.DATABASE_URL,
    ssl: buildSslOptions(),
    extra: {
      max: readInt(process.env.DB_POOL_MAX, 10),
      statement_timeout: readInt(process.env.DB_STATEMENT_TIMEOUT_MS, 30_000),
      connectionTimeoutMillis: readInt(process.env.DB_CONNECTION_TIMEOUT_MS, 10_000),
    },
    synchronize: false,
    logging: false,
    ...overrides,
  } as DataSourceOptions;
}
