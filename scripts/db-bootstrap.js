#!/usr/bin/env node
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function run(command, args) {
  execFileSync(command, args, { stdio: 'inherit', env: process.env });
}

function asBool(value) {
  if (value == null) return null;
  const v = String(value).trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'yes') return true;
  if (v === '0' || v === 'false' || v === 'no') return false;
  return null;
}

function runContentPacksSeedIfEnabled() {
  // Modes:
  // - DB_BOOTSTRAP_CONTENT_PACKS=true  => always run (and fail on error)
  // - DB_BOOTSTRAP_CONTENT_PACKS=false => always skip
  // - DB_BOOTSTRAP_CONTENT_PACKS=auto  => run only when root exists and base URL is configured
  const modeRaw = (process.env.DB_BOOTSTRAP_CONTENT_PACKS || 'auto').trim().toLowerCase();
  const modeBool = asBool(modeRaw);
  const mode = modeBool === null ? modeRaw : modeBool ? 'true' : 'false';

  const root =
    (process.env.CONTENT_PACKS_ROOT || '').trim() ||
    path.resolve(__dirname, '../../DrivestJson');
  const hasRoot = fs.existsSync(root);
  const hasBaseUrl = Boolean(
    (process.env.CONTENT_PACK_PUBLIC_BASE_URL || '').trim(),
  );

  if (mode === 'false') {
    console.log(
      '[db-bootstrap] Skipping content pack seed (DB_BOOTSTRAP_CONTENT_PACKS=false)',
    );
    return;
  }

  if (mode === 'auto' && (!hasRoot || !hasBaseUrl)) {
    const reasons = [];
    if (!hasRoot) reasons.push(`missing root: ${root}`);
    if (!hasBaseUrl)
      reasons.push('missing CONTENT_PACK_PUBLIC_BASE_URL');
    console.log(
      `[db-bootstrap] Skipping content pack seed (auto): ${reasons.join(', ')}`,
    );
    return;
  }

  const args = ['run', 'content-packs:seed', '--', `--root=${root}`];
  console.log(`[db-bootstrap] Running content pack seed with root: ${root}`);
  run('npm', args);
}

run('npm', ['run', 'migration:run']);
run('npm', ['run', 'bootstrap:app-data']);
runContentPacksSeedIfEnabled();
