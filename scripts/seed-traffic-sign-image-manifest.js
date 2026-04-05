#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

function parseArgs(argv) {
  const args = {};
  for (const token of argv) {
    if (!token.startsWith('--')) continue;
    const trimmed = token.slice(2);
    const separator = trimmed.indexOf('=');
    if (separator === -1) {
      args[trimmed] = 'true';
      continue;
    }
    args[trimmed.slice(0, separator)] = trimmed.slice(separator + 1);
  }
  return args;
}

function parseBoolean(value, defaultValue = false) {
  if (value == null) return defaultValue;
  const lowered = String(value).toLowerCase();
  return lowered === '1' || lowered === 'true' || lowered === 'yes';
}

function sha256Hex(contentBuffer) {
  return crypto.createHash('sha256').update(contentBuffer).digest('hex');
}

function buildSslConfig() {
  const enabled = parseBoolean(process.env.DB_SSL, false);
  if (!enabled) {
    return undefined;
  }
  return {
    rejectUnauthorized: parseBoolean(process.env.DB_SSL_REJECT_UNAUTHORIZED, false),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apply = parseBoolean(args.apply, false);
  const dryRun = parseBoolean(args['dry-run'], !apply);
  const repoRoot = process.cwd();
  const indexPath = path.resolve(
    repoRoot,
    args.index || './content-assets/traffic_sign_images/index.json',
  );
  const bucket = (args.bucket || process.env.CONTENT_PACK_S3_BUCKET || 'contentpackages').trim();
  const region = (args.region || process.env.CONTENT_PACK_S3_REGION || 'eu-north-1').trim();
  const prefix = (args.prefix || 'ios/traffic_sign_images/shared').replace(/^\/+|\/+$/g, '');

  if (!fs.existsSync(indexPath)) {
    throw new Error(`Traffic sign index not found: ${indexPath}`);
  }

  const content = fs.readFileSync(indexPath);
  const decoded = JSON.parse(content.toString('utf8'));
  const row = {
    platform: 'ios',
    module: 'traffic_sign_images',
    kind: 'index',
    language: 'shared',
    version: String(args.version || decoded.version || '1').trim(),
    hash: sha256Hex(content),
    sizeBytes: content.length,
    url: `https://${bucket}.s3.${region}.amazonaws.com/${prefix}/index.json`,
    minAppVersion: String(args['min-app-version'] || '1.0.0').trim(),
    isActive: true,
    metadata: {
      fileCount: decoded.fileCount ?? null,
      baseUrl: decoded.baseUrl ?? null,
    },
    publishedAt: new Date().toISOString(),
  };

  console.log(JSON.stringify({ apply, dryRun, row }, null, 2));
  if (!apply || dryRun) {
    return;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is missing');
  }

  const clientConfig = { connectionString };
  const ssl = buildSslConfig();
  if (ssl) {
    clientConfig.ssl = ssl;
  }
  const client = new Client(clientConfig);
  await client.connect();

  try {
    await client.query('BEGIN');
    await client.query(
      `
      UPDATE content_pack_manifest
      SET is_active = false, updated_at = now()
      WHERE platform = $1
        AND module_key = $2
        AND content_kind = $3
        AND language = $4
        AND version <> $5
        AND is_active = true
      `,
      [row.platform, row.module, row.kind, row.language, row.version],
    );

    await client.query(
      `
      INSERT INTO content_pack_manifest (
        platform,
        module_key,
        content_kind,
        language,
        version,
        hash,
        size_bytes,
        url,
        min_app_version,
        is_active,
        metadata,
        published_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::timestamptz)
      ON CONFLICT (platform, module_key, content_kind, language, version)
      DO UPDATE SET
        hash = EXCLUDED.hash,
        size_bytes = EXCLUDED.size_bytes,
        url = EXCLUDED.url,
        min_app_version = EXCLUDED.min_app_version,
        is_active = EXCLUDED.is_active,
        metadata = EXCLUDED.metadata,
        published_at = EXCLUDED.published_at,
        updated_at = now()
      `,
      [
        row.platform,
        row.module,
        row.kind,
        row.language,
        row.version,
        row.hash,
        row.sizeBytes,
        row.url,
        row.minAppVersion,
        row.isActive,
        JSON.stringify(row.metadata),
        row.publishedAt,
      ],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }

  console.log('traffic sign image manifest row applied');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
