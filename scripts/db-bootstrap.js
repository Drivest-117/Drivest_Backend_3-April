#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function run(command, args) {
  execFileSync(command, args, { stdio: 'inherit', env: process.env });
}

function contentPackRoot() {
  return process.env.CONTENT_PACK_SOURCE_ROOT || path.resolve(__dirname, '../../DrivestJson');
}

run('npm', ['run', 'migration:run']);
run('npm', ['run', 'bootstrap:app-data']);

const rootDir = contentPackRoot();
if (fs.existsSync(rootDir)) {
  run('npm', ['run', 'content-packs:seed']);
} else {
  console.log(`[db-bootstrap] Skipping content pack seed; root not found at ${rootDir}`);
}
