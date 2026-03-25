#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function parseBoolean(value, fallback = false) {
  if (value == null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function readDocs(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.documents)) return raw.documents;
  if (raw && typeof raw === 'object') {
    return Object.entries(raw).map(([id, value]) => ({ id, ...(value || {}) }));
  }
  return [];
}

function asDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function buildClient() {
  const clientConfig = { connectionString: process.env.DATABASE_URL };
  if (parseBoolean(process.env.DB_SSL, false)) {
    clientConfig.ssl = {
      rejectUnauthorized: parseBoolean(process.env.DB_SSL_REJECT_UNAUTHORIZED, false),
    };
  }
  return new Client(clientConfig);
}

async function upsertAuditLog(client, doc) {
  await client.query(
    `
      INSERT INTO "audit_logs" ("id", "userId", "action", "metadata", "createdAt")
      VALUES ($1, $2, $3, $4::jsonb, COALESCE($5::timestamptz, now()))
      ON CONFLICT ("id")
      DO UPDATE SET
        "userId" = EXCLUDED."userId",
        "action" = EXCLUDED."action",
        "metadata" = EXCLUDED."metadata",
        "createdAt" = EXCLUDED."createdAt"
    `,
    [
      doc.id,
      doc.userId ?? null,
      doc.action,
      JSON.stringify(doc.metadata ?? null),
      asDate(doc.createdAt ?? doc.created_at),
    ],
  );
}

async function upsertEntitlement(client, doc) {
  await client.query(
    `
      INSERT INTO "entitlements" ("id", "userId", "scope", "centreId", "startsAt", "endsAt", "isActive", "sourcePurchaseId", "createdAt")
      VALUES ($1, $2, $3, $4, $5::timestamptz, $6::timestamptz, COALESCE($7, true), $8, COALESCE($9::timestamptz, now()))
      ON CONFLICT ("id")
      DO UPDATE SET
        "userId" = EXCLUDED."userId",
        "scope" = EXCLUDED."scope",
        "centreId" = EXCLUDED."centreId",
        "startsAt" = EXCLUDED."startsAt",
        "endsAt" = EXCLUDED."endsAt",
        "isActive" = EXCLUDED."isActive",
        "sourcePurchaseId" = EXCLUDED."sourcePurchaseId",
        "createdAt" = EXCLUDED."createdAt"
    `,
    [
      doc.id,
      doc.userId,
      doc.scope,
      doc.centreId ?? null,
      asDate(doc.startsAt ?? doc.starts_at) || new Date().toISOString(),
      asDate(doc.endsAt ?? doc.ends_at),
      doc.isActive ?? doc.is_active ?? true,
      doc.sourcePurchaseId ?? doc.source_purchase_id ?? null,
      asDate(doc.createdAt ?? doc.created_at),
    ],
  );
}

async function upsertPurchase(client, doc) {
  await client.query(
    `
      INSERT INTO "purchases" ("id", "userId", "productId", "provider", "status", "transactionId", "purchasedAt", "rawEvent", "createdAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8::jsonb, COALESCE($9::timestamptz, now()))
      ON CONFLICT ("id")
      DO UPDATE SET
        "userId" = EXCLUDED."userId",
        "productId" = EXCLUDED."productId",
        "provider" = EXCLUDED."provider",
        "status" = EXCLUDED."status",
        "transactionId" = EXCLUDED."transactionId",
        "purchasedAt" = EXCLUDED."purchasedAt",
        "rawEvent" = EXCLUDED."rawEvent",
        "createdAt" = EXCLUDED."createdAt"
    `,
    [
      doc.id,
      doc.userId ?? doc.user_id,
      doc.productId ?? doc.product_id,
      doc.provider ?? 'REVCAT',
      doc.status ?? 'COMPLETED',
      doc.transactionId ?? doc.transaction_id,
      asDate(doc.purchasedAt ?? doc.purchased_at) || new Date().toISOString(),
      JSON.stringify(doc.rawEvent ?? doc.raw_event ?? null),
      asDate(doc.createdAt ?? doc.created_at),
    ],
  );
}

async function upsertContentPackManifest(client, doc) {
  await client.query(
    `
      INSERT INTO "content_pack_manifest" (
        "id", "platform", "module_key", "content_kind", "language", "version", "hash",
        "size_bytes", "url", "min_app_version", "is_active", "metadata", "published_at", "created_at", "updated_at"
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11, true), $12::jsonb,
        COALESCE($13::timestamptz, now()), COALESCE($14::timestamptz, now()), COALESCE($15::timestamptz, now())
      )
      ON CONFLICT ("id")
      DO UPDATE SET
        "platform" = EXCLUDED."platform",
        "module_key" = EXCLUDED."module_key",
        "content_kind" = EXCLUDED."content_kind",
        "language" = EXCLUDED."language",
        "version" = EXCLUDED."version",
        "hash" = EXCLUDED."hash",
        "size_bytes" = EXCLUDED."size_bytes",
        "url" = EXCLUDED."url",
        "min_app_version" = EXCLUDED."min_app_version",
        "is_active" = EXCLUDED."is_active",
        "metadata" = EXCLUDED."metadata",
        "published_at" = EXCLUDED."published_at",
        "created_at" = EXCLUDED."created_at",
        "updated_at" = EXCLUDED."updated_at"
    `,
    [
      doc.id,
      doc.platform,
      doc.moduleKey ?? doc.module_key,
      doc.contentKind ?? doc.content_kind ?? 'default',
      doc.language ?? 'en',
      doc.version,
      doc.hash ?? null,
      doc.sizeBytes ?? doc.size_bytes ?? null,
      doc.url,
      doc.minAppVersion ?? doc.min_app_version ?? null,
      doc.isActive ?? doc.is_active ?? true,
      JSON.stringify(doc.metadata ?? null),
      asDate(doc.publishedAt ?? doc.published_at),
      asDate(doc.createdAt ?? doc.created_at),
      asDate(doc.updatedAt ?? doc.updated_at),
    ],
  );
}

async function upsertMarketplaceLegalAcceptance(client, doc) {
  const surface = doc.surface;
  const userRole =
    doc.userRole ??
    doc.user_role ??
    (surface === 'instructor_hub' ? 'instructor' : 'learner');
  await client.query(
    `
      INSERT INTO "marketplace_legal_acceptances" (
        "id", "user_id", "user_role", "surface", "version", "accepted_at", "metadata", "created_at"
      )
      VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, now()), $7::jsonb, COALESCE($8::timestamptz, now()))
      ON CONFLICT ("id")
      DO UPDATE SET
        "user_id" = EXCLUDED."user_id",
        "user_role" = EXCLUDED."user_role",
        "surface" = EXCLUDED."surface",
        "version" = EXCLUDED."version",
        "accepted_at" = EXCLUDED."accepted_at",
        "metadata" = EXCLUDED."metadata",
        "created_at" = EXCLUDED."created_at"
    `,
    [
      doc.id,
      doc.userId ?? doc.user_id,
      userRole,
      surface,
      doc.version,
      asDate(doc.acceptedAt ?? doc.accepted_at),
      JSON.stringify(doc.metadata ?? null),
      asDate(doc.createdAt ?? doc.created_at),
    ],
  );
}

const collectionHandlers = {
  audit_logs: upsertAuditLog,
  entitlements: upsertEntitlement,
  purchases: upsertPurchase,
  content_pack_manifest: upsertContentPackManifest,
  module_legal_acceptances: upsertMarketplaceLegalAcceptance,
  marketplace_legal_acceptances: upsertMarketplaceLegalAcceptance,
};

async function main() {
  const exportDir = process.env.FIRESTORE_EXPORT_DIR;
  if (!exportDir) {
    throw new Error('FIRESTORE_EXPORT_DIR is required');
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const files = fs
    .readdirSync(exportDir)
    .filter((name) => name.endsWith('.json'))
    .sort();
  const report = {
    exportDir,
    appliedAt: new Date().toISOString(),
    collections: [],
  };

  const client = buildClient();
  await client.connect();
  await client.query('BEGIN');
  try {
    for (const file of files) {
      const collection = path.basename(file, '.json');
      const docs = readDocs(path.join(exportDir, file));
      const handler = collectionHandlers[collection];
      const entry = {
        collection,
        docs: docs.length,
        imported: 0,
        skipped: 0,
        supported: Boolean(handler),
      };
      if (handler) {
        for (const doc of docs) {
          if (!doc || !doc.id) {
            entry.skipped += 1;
            continue;
          }
          await handler(client, doc);
          entry.imported += 1;
        }
      } else {
        entry.skipped = docs.length;
      }
      report.collections.push(entry);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }

  if (process.env.FIRESTORE_BACKFILL_REPORT_PATH) {
    fs.writeFileSync(
      process.env.FIRESTORE_BACKFILL_REPORT_PATH,
      JSON.stringify(report, null, 2),
    );
  }
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error('[firestore-backfill] fatal', error);
  process.exit(1);
});
