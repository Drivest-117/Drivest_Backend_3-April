#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();
const snippetsRoot = path.join(repoRoot, 'legal-content', 'snippets');
const catalogPath = path.join(snippetsRoot, 'catalog.json');
const localePacksRoot = path.join(snippetsRoot, 'locales');

const androidResRoot = path.resolve(
  repoRoot,
  '../android/android/app/src/main/res',
);
const iosLocalizationRoot = path.resolve(
  repoRoot,
  '../iOS/drivest-ios/DrivestNavigation/Resources/Localization',
);

const dryRun = process.argv.includes('--dry-run');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function encodeAndroidValue(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function encodeIosValue(value) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/"/g, '\\"');
}

function replaceAndroidString(filePath, key, value) {
  const input = fs.readFileSync(filePath, 'utf8');
  const pattern = new RegExp(
    `(<string\\s+name="${escapeRegExp(key)}">)([\\s\\S]*?)(</string>)`,
    'm',
  );
  if (!pattern.test(input)) {
    throw new Error(`Android key "${key}" not found in ${filePath}`);
  }
  const output = input.replace(pattern, `$1${encodeAndroidValue(value)}$3`);
  return { changed: output !== input, output };
}

function replaceIosString(filePath, key, value) {
  const input = fs.readFileSync(filePath, 'utf8');
  const pattern = new RegExp(
    `("${escapeRegExp(key)}"\\s*=\\s*")((?:\\\\.|[^"])*)(";)$`,
    'm',
  );
  if (!pattern.test(input)) {
    throw new Error(`iOS key "${key}" not found in ${filePath}`);
  }
  const output = input.replace(pattern, `$1${encodeIosValue(value)}$3`);
  return { changed: output !== input, output };
}

function syncLocale(locale) {
  const mapping = localeMap[locale];
  if (!mapping) {
    throw new Error(`Missing locale map for ${locale}`);
  }

  const packPath = path.join(localePacksRoot, `${locale}.json`);
  if (!fs.existsSync(packPath)) {
    throw new Error(`Missing locale pack ${packPath}`);
  }
  const pack = JSON.parse(fs.readFileSync(packPath, 'utf8'));

  const androidFile = path.join(androidResRoot, mapping.android, 'strings.xml');
  const iosFile = path.join(iosLocalizationRoot, mapping.ios, 'Localizable.strings');

  let androidBuffer = fs.readFileSync(androidFile, 'utf8');
  let iosBuffer = fs.readFileSync(iosFile, 'utf8');

  let androidChanged = 0;
  let iosChanged = 0;

  for (const snippet of catalog.snippets) {
    const value = pack.snippets[snippet.id];
    if (typeof value !== 'string') {
      throw new Error(`Missing snippet "${snippet.id}" in locale ${locale}`);
    }

    if (snippet.androidKey) {
      const pattern = new RegExp(
        `(<string\\s+name="${escapeRegExp(snippet.androidKey)}">)([\\s\\S]*?)(</string>)`,
        'm',
      );
      if (!pattern.test(androidBuffer)) {
        throw new Error(`Android key "${snippet.androidKey}" not found for locale ${locale}`);
      }
      const nextBuffer = androidBuffer.replace(
        pattern,
        `$1${encodeAndroidValue(value)}$3`,
      );
      if (nextBuffer !== androidBuffer) {
        androidChanged += 1;
        androidBuffer = nextBuffer;
      }
    }

    if (snippet.iosKey) {
      const pattern = new RegExp(
        `("${escapeRegExp(snippet.iosKey)}"\\s*=\\s*")((?:\\\\.|[^"])*)(";)$`,
        'm',
      );
      if (!pattern.test(iosBuffer)) {
        throw new Error(`iOS key "${snippet.iosKey}" not found for locale ${locale}`);
      }
      const nextBuffer = iosBuffer.replace(
        pattern,
        `$1${encodeIosValue(value)}$3`,
      );
      if (nextBuffer !== iosBuffer) {
        iosChanged += 1;
        iosBuffer = nextBuffer;
      }
    }
  }

  if (!dryRun) {
    fs.writeFileSync(androidFile, androidBuffer, 'utf8');
    fs.writeFileSync(iosFile, iosBuffer, 'utf8');
  }

  return {
    locale,
    androidChanged,
    iosChanged,
    androidFile,
    iosFile,
  };
}

const results = catalog.supportedLocales.map(syncLocale);

const totalAndroid = results.reduce((sum, result) => sum + result.androidChanged, 0);
const totalIos = results.reduce((sum, result) => sum + result.iosChanged, 0);

for (const result of results) {
  console.log(
    `${dryRun ? 'Would sync' : 'Synced'} ${result.locale}: android ${result.androidChanged}, ios ${result.iosChanged}`,
  );
}

console.log(
  `${dryRun ? 'Dry-run complete' : 'Sync complete'}: android changes ${totalAndroid}, ios changes ${totalIos}.`,
);
