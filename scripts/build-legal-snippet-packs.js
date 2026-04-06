#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();
const snippetsRoot = path.join(repoRoot, 'legal-content', 'snippets');
const catalogPath = path.join(snippetsRoot, 'catalog.json');
const manualOverridesPath = path.join(snippetsRoot, 'manual-overrides.json');
const outputRoot = path.join(snippetsRoot, 'locales');

const androidResRoot = path.resolve(
  repoRoot,
  '../android/android/app/src/main/res',
);
const iosLocalizationRoot = path.resolve(
  repoRoot,
  '../iOS/drivest-ios/DrivestNavigation/Resources/Localization',
);

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const manualOverrides = JSON.parse(fs.readFileSync(manualOverridesPath, 'utf8'));

const localeMap = {
  'en-GB': {
    android: 'values',
    ios: 'en-GB.lproj',
  },
  ar: {
    android: 'values-ar',
    ios: 'ar.lproj',
  },
  de: {
    android: 'values-de',
    ios: 'de.lproj',
  },
  es: {
    android: 'values-es',
    ios: 'es.lproj',
  },
  fr: {
    android: 'values-fr',
    ios: 'fr.lproj',
  },
  it: {
    android: 'values-it',
    ios: 'it.lproj',
  },
  nl: {
    android: 'values-nl',
    ios: 'nl.lproj',
  },
  pl: {
    android: 'values-pl',
    ios: 'pl.lproj',
  },
  'pt-PT': {
    android: 'values-pt-rPT',
    ios: 'pt-PT.lproj',
  },
  ro: {
    android: 'values-ro',
    ios: 'ro.lproj',
  },
  'zh-Hans': {
    android: 'values-zh-rCN',
    ios: 'zh-Hans.lproj',
  },
};

function readIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
}

function parseAndroidStrings(filePath) {
  const text = readIfExists(filePath);
  if (!text) return {};
  const result = {};
  const regex = /<string\s+name="([^"]+)">([\s\S]*?)<\/string>/g;
  let match;
  while ((match = regex.exec(text))) {
    result[match[1]] = match[2]
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&#10;/g, '\n');
  }
  return result;
}

function parseIosStrings(filePath) {
  const text = readIfExists(filePath);
  if (!text) return {};
  const result = {};
  const regex = /"((?:\\"|[^"])*)"\s*=\s*"((?:\\"|[^"])*)";/g;
  let match;
  while ((match = regex.exec(text))) {
    const key = match[1].replace(/\\"/g, '"');
    const value = match[2]
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'");
    result[key] = value;
  }
  return result;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function sourceForSnippet(locale, snippet, androidStrings, iosStrings) {
  const overrides = manualOverrides[locale] || {};
  if (overrides[snippet.id]) {
    return {
      value: overrides[snippet.id],
      source: 'manual_override',
    };
  }

  if (snippet.androidKey && androidStrings[snippet.androidKey]) {
    return {
      value: androidStrings[snippet.androidKey],
      source: `android:${snippet.androidKey}`,
    };
  }

  if (snippet.iosKey && iosStrings[snippet.iosKey]) {
    return {
      value: iosStrings[snippet.iosKey],
      source: `ios:${snippet.iosKey}`,
    };
  }

  return null;
}

ensureDir(outputRoot);

for (const locale of catalog.supportedLocales) {
  const mapping = localeMap[locale];
  if (!mapping) {
    throw new Error(`Missing locale map for ${locale}`);
  }

  const androidStrings = parseAndroidStrings(
    path.join(androidResRoot, mapping.android, 'strings.xml'),
  );
  const iosStrings = parseIosStrings(
    path.join(iosLocalizationRoot, mapping.ios, 'Localizable.strings'),
  );

  const snippets = {};
  const sources = {};

  for (const snippet of catalog.snippets) {
    const resolved = sourceForSnippet(locale, snippet, androidStrings, iosStrings);
    if (!resolved) {
      throw new Error(`Missing snippet "${snippet.id}" for locale "${locale}"`);
    }
    snippets[snippet.id] = resolved.value;
    sources[snippet.id] = resolved.source;
  }

  const output = {
    locale,
    generatedAt: new Date().toISOString(),
    strategy: 'existing_mobile_localizations_plus_manual_overrides',
    snippets,
    sources,
  };

  fs.writeFileSync(
    path.join(outputRoot, `${locale}.json`),
    `${JSON.stringify(output, null, 2)}\n`,
    'utf8',
  );
}

console.log(`Built ${catalog.supportedLocales.length} legal snippet locale packs.`);
