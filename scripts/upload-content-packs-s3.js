#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

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

function walkJsonFiles(root) {
  const out = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolute);
        continue;
      }
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
        out.push(absolute);
      }
    }
  }
  return out.sort();
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

function buildUploadPlan(rootDir, platformPrefix) {
  const files = walkJsonFiles(rootDir);
  const rows = [];
  for (const absolutePath of files) {
    const detected = detectPackInfo(absolutePath, rootDir);
    if (!detected) continue;
    const fileName = path.basename(absolutePath);
    const key = `${platformPrefix}/${detected.module}/${detected.kind}/${detected.language}/${fileName}`;
    rows.push({
      absolutePath,
      relativePath: path.relative(rootDir, absolutePath).replace(/\\/g, '/'),
      key,
      module: detected.module,
      kind: detected.kind,
      language: detected.language,
      fileName,
      sizeBytes: fs.statSync(absolutePath).size,
    });
  }
  return rows;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apply = parseBoolean(args.apply, false);
  const dryRun = parseBoolean(args['dry-run'], !apply);

  const bucket = (args.bucket || process.env.CONTENT_PACK_S3_BUCKET || 'contentpackages').trim();
  const region = (args.region || process.env.CONTENT_PACK_S3_REGION || 'eu-north-1').trim();
  const prefix = (args.prefix || 'ios').replace(/^\/+|\/+$/g, '');
  const rootDir = path.resolve(
    args.root || path.resolve(__dirname, '../../DrivestJson'),
  );

  if (!fs.existsSync(rootDir)) {
    throw new Error(`DrivestJson root not found: ${rootDir}`);
  }

  const plan = buildUploadPlan(rootDir, prefix);
  const totalBytes = plan.reduce((sum, row) => sum + row.sizeBytes, 0);

  const summary = {
    generatedAt: new Date().toISOString(),
    apply,
    dryRun,
    bucket,
    region,
    prefix,
    rootDir,
    fileCount: plan.length,
    totalSizeMB: Number((totalBytes / 1024 / 1024).toFixed(2)),
    sample: plan.slice(0, 8),
    publicBaseUrl: `https://${bucket}.s3.${region}.amazonaws.com`,
  };

  if (args.report) {
    const reportPath = path.resolve(args.report);
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify({ summary, files: plan }, null, 2), 'utf8');
    console.log(`report written: ${reportPath}`);
  }

  console.log(JSON.stringify(summary, null, 2));
  if (!apply || dryRun) {
    return;
  }

  const s3 = new S3Client({
    region,
    credentials:
      process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            sessionToken: process.env.AWS_SESSION_TOKEN,
          }
        : undefined,
  });

  let uploaded = 0;
  for (const row of plan) {
    const body = fs.readFileSync(row.absolutePath);
    const input = {
      Bucket: bucket,
      Key: row.key,
      Body: body,
      ContentType: 'application/json; charset=utf-8',
      CacheControl: 'public, max-age=31536000, immutable',
    };
    await s3.send(new PutObjectCommand(input));
    uploaded += 1;
    if (uploaded % 10 === 0 || uploaded === plan.length) {
      console.log(`uploaded ${uploaded}/${plan.length}`);
    }
  }

  console.log(`uploaded ${uploaded} files to s3://${bucket}/${prefix}/...`);
  console.log(`public base url: https://${bucket}.s3.${region}.amazonaws.com`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
