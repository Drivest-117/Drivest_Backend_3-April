#!/usr/bin/env node
const { execFileSync } = require('child_process');

function run(command, args) {
  execFileSync(command, args, { stdio: 'inherit', env: process.env });
}

run('npm', ['run', 'migration:run']);
run('npm', ['run', 'bootstrap:app-data']);
run('npm', ['run', 'content-packs:seed']);
