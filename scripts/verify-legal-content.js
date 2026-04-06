#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const repoRoot = process.cwd();
const legalRoot = path.join(repoRoot, 'legal-content');
const registryPath = path.join(legalRoot, 'registry.json');

function fail(message) {
  console.error(`legal-content verification failed: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(registryPath)) {
  fail(`missing registry file at ${registryPath}`);
}

const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const documents = Array.isArray(registry.documents) ? registry.documents : [];

if (documents.length === 0) {
  fail('registry contains no documents');
}

const seenIds = new Set();
const seenPaths = new Set();

for (const document of documents) {
  if (!document.id) {
    fail('found document entry without id');
  }
  if (seenIds.has(document.id)) {
    fail(`duplicate document id "${document.id}"`);
  }
  seenIds.add(document.id);

  if (!document.relativePath) {
    fail(`document "${document.id}" is missing relativePath`);
  }

  const absolutePath = path.join(legalRoot, document.relativePath);
  if (seenPaths.has(absolutePath)) {
    fail(`duplicate document path "${document.relativePath}"`);
  }
  seenPaths.add(absolutePath);

  if (!fs.existsSync(absolutePath)) {
    fail(`missing file for "${document.id}": ${document.relativePath}`);
  }
}

const appLegalDocs = documents.filter((document) => document.appLegalDocumentType);

console.log(`Verified ${documents.length} legal-content documents.`);

if (appLegalDocs.length > 0) {
  console.log('App legal document hashes:');
  for (const document of appLegalDocs) {
    const absolutePath = path.join(legalRoot, document.relativePath);
    const normalizedContent = fs.readFileSync(absolutePath, 'utf8').replace(/\r\n/g, '\n');
    const contentHash = crypto.createHash('sha256').update(normalizedContent, 'utf8').digest('hex');
    console.log(
      `- ${document.appLegalDocumentType}@${document.version} ${contentHash} (${document.relativePath})`,
    );
  }
}
