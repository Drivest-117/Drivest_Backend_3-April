import { Injectable, NotFoundException } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

type LegalRegistryDocument = {
  id: string;
  title: string;
  locale: string;
  audience: string;
  relativePath: string;
  metadata?: {
    title?: string;
  };
};

type LegalRegistry = {
  defaultLocale: string;
  documents: LegalRegistryDocument[];
};

const LEGAL_CONTENT_ROOT = resolve(process.cwd(), 'legal-content');
const LEGAL_REGISTRY_PATH = resolve(LEGAL_CONTENT_ROOT, 'registry.json');
const PUBLIC_DOCUMENT_IDS = new Set([
  'terms-and-conditions',
  'privacy-policy',
  'faq',
  'safety-notice',
]);
const RTL_LOCALE_PREFIXES = ['ar', 'fa', 'he', 'ku', 'prs', 'ps', 'ur'];

@Injectable()
export class PublicLegalService {
  renderPublicDocument(documentId: string, locale: string): string {
    const registry = this.loadRegistry();
    const normalizedDocumentId = documentId.trim();
    const normalizedLocale = locale.trim();

    if (!PUBLIC_DOCUMENT_IDS.has(normalizedDocumentId)) {
      throw new NotFoundException(`Unknown public legal document "${normalizedDocumentId}"`);
    }

    const registryDocument = registry.documents.find(
      (document) => document.id === normalizedDocumentId && document.audience === 'public',
    );

    if (!registryDocument) {
      throw new NotFoundException(`Missing public legal registry entry for "${normalizedDocumentId}"`);
    }

    const localizedPath = resolve(
      LEGAL_CONTENT_ROOT,
      `source/${normalizedLocale}/public/${this.basename(registryDocument.relativePath)}`,
    );

    if (!existsSync(localizedPath)) {
      throw new NotFoundException(
        `Missing localized legal document "${normalizedDocumentId}" for locale "${normalizedLocale}"`,
      );
    }

    const sourceText = readFileSync(localizedPath, 'utf8').replace(/\r\n/g, '\n').trim();
    if (!sourceText) {
      throw new NotFoundException(
        `Localized legal document "${normalizedDocumentId}" for locale "${normalizedLocale}" is empty`,
      );
    }

    const lines = sourceText.split('\n');
    const displayTitle = lines.find((line) => line.trim().length > 0)?.trim()
      || registryDocument.metadata?.title
      || registryDocument.title;
    const direction = this.isRtlLocale(normalizedLocale) ? 'rtl' : 'ltr';

    return `<!doctype html>
<html lang="${this.escapeHtml(normalizedLocale)}" dir="${direction}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
  <title>${this.escapeHtml(displayTitle)}</title>
  <style>
    :root {
      color-scheme: light;
      --page-bg: #f4efe7;
      --card-bg: #fffaf2;
      --ink: #1f1a14;
      --muted: #5e5142;
      --border: #d9c7b2;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background:
        radial-gradient(circle at top left, #fff3d9 0%, transparent 34%),
        linear-gradient(180deg, #f9f1e6 0%, var(--page-bg) 100%);
      color: var(--ink);
      padding: 24px 16px 40px;
    }
    .shell {
      max-width: 860px;
      margin: 0 auto;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 20px;
      box-shadow: 0 10px 30px rgba(60, 40, 20, 0.08);
    }
    h1 {
      margin: 0 0 8px;
      font-size: clamp(26px, 4vw, 36px);
      line-height: 1.1;
    }
    .locale {
      margin: 0 0 18px;
      color: var(--muted);
      font-size: 14px;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }
    .content {
      margin: 0;
      white-space: pre-wrap;
      line-height: 1.65;
      font-size: 16px;
      word-break: break-word;
    }
  </style>
</head>
<body>
  <main class="shell">
    <section class="card">
      <h1>${this.escapeHtml(displayTitle)}</h1>
      <p class="locale">${this.escapeHtml(normalizedLocale)}</p>
      <article class="content">${this.escapeHtml(sourceText)}</article>
    </section>
  </main>
</body>
</html>
`;
  }

  private loadRegistry(): LegalRegistry {
    return JSON.parse(readFileSync(LEGAL_REGISTRY_PATH, 'utf8')) as LegalRegistry;
  }

  private basename(relativePath: string): string {
    return relativePath.replace(/\\/g, '/').split('/').pop() ?? relativePath;
  }

  private isRtlLocale(locale: string): boolean {
    const normalized = locale.trim().toLowerCase();
    return RTL_LOCALE_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}-`));
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
