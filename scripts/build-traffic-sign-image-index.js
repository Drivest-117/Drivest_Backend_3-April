#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

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

function currentDateTag() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
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
      output.push(path.relative(root, absolute).replace(/\\/g, '/'));
    }
  }
  return output.sort();
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const sourceRoot = path.resolve(
    repoRoot,
    args.root || '../iOS/drivest-ios/DrivestNavigation/Resources/Data/trafficsigns',
  );
  const outputPath = path.resolve(
    repoRoot,
    args.output || './content-assets/traffic_sign_images/index.json',
  );
  const baseUrl = (
    args['base-url'] ||
    process.env.TRAFFIC_SIGN_IMAGES_BASE_URL ||
    'https://contentpackages.s3.eu-north-1.amazonaws.com/ios/traffic_sign_images/shared'
  ).trim().replace(/\/+$/, '');

  if (!fs.existsSync(sourceRoot)) {
    throw new Error(`Traffic sign source root not found: ${sourceRoot}`);
  }

  const relativePaths = walkImageFiles(sourceRoot);
  const payload = {
    generatedAt: new Date().toISOString(),
    version: args.version || currentDateTag(),
    baseUrl,
    fileCount: relativePaths.length,
    relativePaths,
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');

  console.log(
    JSON.stringify(
      {
        sourceRoot,
        outputPath,
        version: payload.version,
        baseUrl: payload.baseUrl,
        fileCount: payload.fileCount,
      },
      null,
      2,
    ),
  );
}

main();
