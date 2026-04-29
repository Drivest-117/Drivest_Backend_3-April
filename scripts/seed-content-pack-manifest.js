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
    const key = trimmed.slice(0, separator);
    const value = trimmed.slice(separator + 1);
    args[key] = value;
  }
  return args;
}

function currentDateTag() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function walkJsonFiles(root) {
  const output = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolute);
        continue;
      }
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
        output.push(absolute);
      }
    }
  }
  return output.sort();
}

function detectPackInfo(absolutePath, rootDir) {
  const relative = path.relative(rootDir, absolutePath).replace(/\\/g, '/');
  const parts = relative.split('/');
  if (parts.length < 2) return null;
  const folder = parts[0];
  const fileName = parts[parts.length - 1];

  if (folder === 'Theory') {
    const match = fileName.match(/^Drivest_1200_Questions_([a-zA-Z-]+)\.json$/);
    if (!match) return null;
    return { module: 'theory', kind: 'questions', language: match[1].toLowerCase() };
  }

  if (folder === 'Highway Code') {
    const match = fileName.match(/^Drivest_HighwayCode_Theory_([a-zA-Z-]+)\.json$/);
    if (!match) return null;
    return { module: 'highway_code', kind: 'theory', language: match[1].toLowerCase() };
  }

  if (folder === 'Traffic Signs') {
    let match = fileName.match(
      /^Drivest_KnowYourSigns_Theory_Expanded_([a-zA-Z-]+)\.json$/,
    );
    if (match) {
      return {
        module: 'know_your_signs',
        kind: 'theory',
        language: match[1].toLowerCase(),
      };
    }
    match = fileName.match(/^Drivest_KnowYourSigns_Questions_([a-zA-Z-]+)\.json$/);
    if (match) {
      return {
        module: 'know_your_signs',
        kind: 'questions',
        language: match[1].toLowerCase(),
      };
    }
    return null;
  }

  if (folder === 'Fines & Penalties') {
    const match = fileName.match(/^pack_([a-zA-Z-]+)\.json$/);
    if (!match) return null;
    return {
      module: 'fines_penalties',
      kind: 'questions',
      language: match[1].toLowerCase(),
    };
  }

  return null;
}

function sha256Hex(contentBuffer) {
  return crypto.createHash('sha256').update(contentBuffer).digest('hex');
}

function normalizeBaseUrl(value) {
  if (!value) return null;
  return value.trim().replace(/\/+$/, '');
}

function buildUrl(baseUrl, platform, moduleKey, kind, language, fileName) {
  const key = `${platform}/${moduleKey}/${kind}/${language}/${fileName}`;
  return `${baseUrl}/${key}`;
}

function parseBoolean(value, defaultValue = false) {
  if (value == null) return defaultValue;
  const lowered = String(value).toLowerCase();
  return lowered === '1' || lowered === 'true' || lowered === 'yes';
}

const FINES_CONTAMINATION_TOKENS = new Set([
  'primarily',
  'supply',
  'firms',
  'confirm',
  'confirms',
  'clerk',
  'vehicle',
  'warning',
  'mobile',
  'phone',
  'speeding',
  'insurance',
  'court',
  'fixed',
  'penalty',
  'points',
  'limit',
  'driving',
  'offence',
  'offences',
  'licence',
  'motorway',
  'failure',
  'this',
  'much',
  'were',
  'size',
  'their',
  'considered',
  'standard',
  'handles',
  'selling',
  'renewing',
  'house',
  'tow',
  'day',
  'safe',
  'route',
  'choice',
  'nothing',
  'only',
]);

function assessFinesLocalizationQuality(rawContent, language) {
  if (!rawContent || language === 'en') {
    return {
      sampledTextCount: 0,
      englishTokenHits: 0,
      contaminated: false,
    };
  }

  let payload;
  try {
    payload = JSON.parse(rawContent.toString('utf8'));
  } catch (_) {
    return {
      sampledTextCount: 0,
      englishTokenHits: 0,
      contaminated: false,
    };
  }

  const questions = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object' && Array.isArray(payload.questions)
      ? payload.questions
      : [];
  if (!Array.isArray(questions) || questions.length === 0) {
    return {
      sampledTextCount: 0,
      englishTokenHits: 0,
      contaminated: false,
    };
  }

  const texts = [];
  for (const question of questions.slice(0, 15)) {
    if (!question || typeof question !== 'object') continue;
    const prompt = question.prompt ?? question.question ?? question.questionText;
    if (typeof prompt === 'string' && prompt.trim().length > 0) {
      texts.push(prompt);
    }
    if (
      typeof question.explanation === 'string' &&
      question.explanation.trim().length > 0
    ) {
      texts.push(question.explanation);
    }
    if (Array.isArray(question.options)) {
      for (const option of question.options) {
        if (typeof option === 'string' && option.trim().length > 0) {
          texts.push(option);
        }
      }
    }
  }

  let englishTokenHits = 0;
  for (const text of texts) {
    const words = text.toLowerCase().match(/[a-z]{3,}/g);
    if (!words) continue;
    for (const word of words) {
      if (FINES_CONTAMINATION_TOKENS.has(word)) {
        englishTokenHits += 1;
      }
    }
  }

  return {
    sampledTextCount: texts.length,
    englishTokenHits,
    contaminated: englishTokenHits >= 6,
  };
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

async function applyRows(rows, options) {
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
    for (const row of rows) {
      if (options.deactivateOld) {
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
      }

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
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apply = parseBoolean(args.apply, false);
  const dryRun = parseBoolean(args['dry-run'], !apply);
  const deactivateOld = parseBoolean(args['deactivate-old'], true);
  const platform = (args.platform || 'ios').trim().toLowerCase();
  const minAppVersion = (args['min-app-version'] || '1.0.0').trim();
  const versionTag = (args['version-tag'] || currentDateTag()).trim();
  const publishedAt = args['published-at']
    ? new Date(args['published-at']).toISOString()
    : new Date().toISOString();
  const rootDir = path.resolve(
    args.root ||
      process.env.CONTENT_PACK_SOURCE_ROOT ||
      path.resolve(__dirname, '../../DrivestJson'),
  );
  const baseUrl = normalizeBaseUrl(args['base-url'] || process.env.CONTENT_PACK_PUBLIC_BASE_URL);

  if (!fs.existsSync(rootDir)) {
    throw new Error(`DrivestJson root not found: ${rootDir}`);
  }
  if (apply && !baseUrl) {
    throw new Error('base URL is required for --apply. Provide --base-url=...');
  }

  const files = walkJsonFiles(rootDir);
  const rows = [];
  for (const absolutePath of files) {
    const detected = detectPackInfo(absolutePath, rootDir);
    if (!detected) continue;
    const content = fs.readFileSync(absolutePath);
    const hash = sha256Hex(content);
    const fileName = path.basename(absolutePath);
    const metadata = {
      fileName,
      sourceRelativePath: path.relative(rootDir, absolutePath).replace(/\\/g, '/'),
      uploadKey: `${platform}/${detected.module}/${detected.kind}/${detected.language}/${fileName}`,
    };

    if (detected.module === 'fines_penalties' && detected.kind === 'questions') {
      const quality = assessFinesLocalizationQuality(content, detected.language);
      metadata.localizationContaminated = quality.contaminated;
      metadata.localization = {
        sourceLanguage: detected.language,
        quality,
      };
    }

    rows.push({
      platform,
      module: detected.module,
      kind: detected.kind,
      language: detected.language,
      version: `${versionTag}-${hash.slice(0, 12)}`,
      hash,
      sizeBytes: content.length,
      url: baseUrl
        ? buildUrl(
            baseUrl,
            platform,
            detected.module,
            detected.kind,
            detected.language,
            fileName,
          )
        : null,
      minAppVersion,
      isActive: true,
      publishedAt,
      metadata,
    });
  }

  const summary = rows.reduce((acc, row) => {
    const key = `${row.module}/${row.kind}`;
    acc.byModule[key] = (acc.byModule[key] || 0) + 1;
    acc.byLanguage[row.language] = (acc.byLanguage[row.language] || 0) + 1;
    acc.totalSizeBytes += row.sizeBytes;
    return acc;
  }, { byModule: {}, byLanguage: {}, totalSizeBytes: 0 });

  const report = {
    generatedAt: new Date().toISOString(),
    apply,
    dryRun,
    rootDir,
    baseUrl,
    rowCount: rows.length,
    totalSizeMB: Number((summary.totalSizeBytes / 1024 / 1024).toFixed(2)),
    byModule: summary.byModule,
    byLanguage: summary.byLanguage,
    preview: rows.slice(0, 10),
  };

  const reportPath = args.report
    ? path.resolve(args.report)
    : null;
  if (reportPath) {
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify({ report, rows }, null, 2), 'utf8');
    console.log(`report written: ${reportPath}`);
  }

  console.log(JSON.stringify(report, null, 2));

  if (!apply || dryRun) {
    return;
  }

  await applyRows(rows, { deactivateOld });
  console.log(`applied ${rows.length} content pack manifest rows`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
