#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();
const snippetsRoot = path.join(repoRoot, 'legal-content', 'snippets');
const catalogPath = path.join(snippetsRoot, 'catalog.json');
const outputRoot = path.join(snippetsRoot, 'locales');

function fail(message) {
  console.error(`legal-snippets verification failed: ${message}`);
  process.exit(1);
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const expectedIds = catalog.snippets.map((snippet) => snippet.id);

for (const locale of catalog.supportedLocales) {
  const localePath = path.join(outputRoot, `${locale}.json`);
  if (!fs.existsSync(localePath)) {
    fail(`missing locale pack ${locale}.json`);
  }
  const pack = JSON.parse(fs.readFileSync(localePath, 'utf8'));
  for (const id of expectedIds) {
    if (!pack.snippets || typeof pack.snippets[id] !== 'string' || pack.snippets[id].trim() === '') {
      fail(`locale ${locale} is missing snippet ${id}`);
    }
  }
}

console.log(
  `Verified ${catalog.supportedLocales.length} locale packs with ${expectedIds.length} snippets each.`,
);
