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

function buildClient() {
  const clientConfig = { connectionString: process.env.DATABASE_URL };
  if (parseBoolean(process.env.DB_SSL, false)) {
    clientConfig.ssl = {
      rejectUnauthorized: parseBoolean(process.env.DB_SSL_REJECT_UNAUTHORIZED, false),
    };
  }
  return new Client(clientConfig);
}

function readDocs(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.documents)) return raw.documents;
  if (raw && typeof raw === 'object') return Object.entries(raw).map(([id, value]) => ({ id, ...(value || {}) }));
  return [];
}

const supportedCollections = {
  audit_logs: 'SELECT COUNT(*)::int AS count FROM "audit_logs"',
  entitlements: 'SELECT COUNT(*)::int AS count FROM "entitlements"',
  purchases: 'SELECT COUNT(*)::int AS count FROM "purchases"',
  content_pack_manifest: 'SELECT COUNT(*)::int AS count FROM "content_pack_manifest"',
  module_legal_acceptances:
    'SELECT COUNT(*)::int AS count FROM "marketplace_legal_acceptances"',
  marketplace_legal_acceptances:
    'SELECT COUNT(*)::int AS count FROM "marketplace_legal_acceptances"',
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
  const client = buildClient();
  await client.connect();
  const report = {
    exportDir,
    verifiedAt: new Date().toISOString(),
    collections: [],
    ok: true,
  };

  try {
    for (const file of files) {
      const collection = path.basename(file, '.json');
      const docs = readDocs(path.join(exportDir, file));
      const sql = supportedCollections[collection];
      const entry = {
        collection,
        exportDocs: docs.length,
        tableRows: null,
        supported: Boolean(sql),
        ok: true,
      };
      if (sql) {
        const result = await client.query(sql);
        entry.tableRows = Number(result.rows[0]?.count ?? 0);
        entry.ok = entry.exportDocs === entry.tableRows;
        if (!entry.ok) {
          report.ok = false;
        }
      }
      report.collections.push(entry);
    }
  } finally {
    await client.end();
  }

  if (process.env.FIRESTORE_VERIFY_REPORT_PATH) {
    fs.writeFileSync(
      process.env.FIRESTORE_VERIFY_REPORT_PATH,
      JSON.stringify(report, null, 2),
    );
  }
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[firestore-verify] fatal', error);
  process.exit(1);
});
