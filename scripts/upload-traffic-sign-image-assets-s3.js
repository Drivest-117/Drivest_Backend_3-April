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

function walkImageFiles(root) {
  const allowed = new Set(['.jpg', '.jpeg', '.png', '.webp']);
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
      if (!entry.isFile()) continue;
      const extension = path.extname(entry.name).toLowerCase();
      if (!allowed.has(extension)) continue;
      output.push({
        absolutePath: absolute,
        relativePath: path.relative(root, absolute).replace(/\\/g, '/'),
        sizeBytes: fs.statSync(absolute).size,
      });
    }
  }
  return output.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function contentTypeFor(fileName) {
  const extension = path.extname(fileName).toLowerCase();
  switch (extension) {
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.jpg':
    case '.jpeg':
    default:
      return 'image/jpeg';
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apply = parseBoolean(args.apply, false);
  const dryRun = parseBoolean(args['dry-run'], !apply);
  const repoRoot = process.cwd();

  const sourceRoot = path.resolve(
    repoRoot,
    args.root || '../iOS/drivest-ios/DrivestNavigation/Resources/Data/trafficsigns',
  );
  const indexPath = path.resolve(
    repoRoot,
    args.index || './content-assets/traffic_sign_images/index.json',
  );
  const bucket = (args.bucket || process.env.CONTENT_PACK_S3_BUCKET || 'contentpackages').trim();
  const region = (args.region || process.env.CONTENT_PACK_S3_REGION || 'eu-north-1').trim();
  const prefix = (args.prefix || 'ios/traffic_sign_images/shared').replace(/^\/+|\/+$/g, '');

  if (!fs.existsSync(sourceRoot)) {
    throw new Error(`Traffic sign source root not found: ${sourceRoot}`);
  }
  if (!fs.existsSync(indexPath)) {
    throw new Error(`Traffic sign index not found: ${indexPath}`);
  }

  const images = walkImageFiles(sourceRoot);
  const totalImageBytes = images.reduce((sum, row) => sum + row.sizeBytes, 0);
  const indexSizeBytes = fs.statSync(indexPath).size;

  const summary = {
    generatedAt: new Date().toISOString(),
    apply,
    dryRun,
    bucket,
    region,
    prefix,
    sourceRoot,
    indexPath,
    fileCount: images.length + 1,
    totalSizeMB: Number(((totalImageBytes + indexSizeBytes) / 1024 / 1024).toFixed(2)),
    publicBaseUrl: `https://${bucket}.s3.${region}.amazonaws.com/${prefix}`,
    sample: images.slice(0, 8),
  };

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
  const uploads = [
    {
      absolutePath: indexPath,
      key: `${prefix}/index.json`,
      contentType: 'application/json; charset=utf-8',
    },
    ...images.map((image) => ({
      absolutePath: image.absolutePath,
      key: `${prefix}/${image.relativePath}`,
      contentType: contentTypeFor(image.relativePath),
    })),
  ];

  for (const file of uploads) {
    const body = fs.readFileSync(file.absolutePath);
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: file.key,
        Body: body,
        ContentType: file.contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    uploaded += 1;
    if (uploaded % 50 === 0 || uploaded === uploads.length) {
      console.log(`uploaded ${uploaded}/${uploads.length}`);
    }
  }

  console.log(`uploaded ${uploaded} traffic sign image assets to s3://${bucket}/${prefix}/...`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
