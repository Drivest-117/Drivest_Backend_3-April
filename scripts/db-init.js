#!/usr/bin/env node
const { execFileSync } = require('child_process');

function toBool(value, fallback = false) {
  if (value == null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function run(command, args) {
  execFileSync(command, args, { stdio: 'inherit', env: process.env });
}

run('npm', ['run', 'db:bootstrap']);

if (toBool(process.env.DB_INIT_IMPORT_OUTPUT_ROUTES, false)) {
  run('npm', ['run', 'seed:output']);
}

if (toBool(process.env.DB_INIT_IMPORT_FREE_TRO, false)) {
  run('npm', ['run', 'seed:tro:free']);
}

if (toBool(process.env.DB_INIT_BACKFILL_HAZARDS, false)) {
  run('npm', ['run', 'seed:hazards:backfill']);
}
