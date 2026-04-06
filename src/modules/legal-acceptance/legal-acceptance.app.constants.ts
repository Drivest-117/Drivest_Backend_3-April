import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { resolve } from 'path';

export type AppLegalDocumentType = 'terms' | 'privacy' | 'safety_notice';
export type AppConsentType = 'analytics' | 'notifications' | 'location';

export const APP_LEGAL_HEADER_INSTALL_ID = 'x-drivest-install-id';
export const APP_LEGAL_HEADER_PLATFORM = 'x-drivest-platform';
export const APP_LEGAL_HEADER_APP_VERSION = 'x-drivest-app-version';

export const APP_LEGAL_SOURCE_ONBOARDING = 'onboarding_legal';
export const APP_CONSENT_SOURCE_ONBOARDING = 'onboarding_permissions';

type LegalRegistryDocument = {
  id: string;
  title: string;
  locale: string;
  audience: string;
  version: string;
  lastUpdated: string;
  publicationTimestamp: string;
  relativePath: string;
  sourceFormat: string;
  translationEligible: boolean;
  appLegalDocumentType?: AppLegalDocumentType;
  metadata?: Record<string, unknown>;
};

type LegalRegistry = {
  defaultLocale: string;
  updatedAt: string;
  documents: LegalRegistryDocument[];
};

const LEGAL_CONTENT_ROOT = resolve(process.cwd(), 'legal-content');
const LEGAL_REGISTRY_PATH = resolve(LEGAL_CONTENT_ROOT, 'registry.json');

const legalRegistry = JSON.parse(
  readFileSync(LEGAL_REGISTRY_PATH, 'utf8'),
) as LegalRegistry;

function computeLegalContentHash(relativePath: string): string {
  const absolutePath = resolve(LEGAL_CONTENT_ROOT, relativePath);
  const normalizedContent = readFileSync(absolutePath, 'utf8').replace(/\r\n/g, '\n');
  return createHash('sha256').update(normalizedContent, 'utf8').digest('hex');
}

const APP_LEGAL_REGISTRY_DOCUMENTS = legalRegistry.documents.filter(
  (document): document is LegalRegistryDocument & { appLegalDocumentType: AppLegalDocumentType } =>
    document.locale === legalRegistry.defaultLocale && Boolean(document.appLegalDocumentType),
);

export const APP_LEGAL_DEFAULT_DOCUMENTS: Array<{
  documentType: AppLegalDocumentType;
  version: string;
  contentHash: string;
  publicationTimestamp: string;
  metadata: Record<string, unknown>;
}> = APP_LEGAL_REGISTRY_DOCUMENTS.map((document) => ({
  documentType: document.appLegalDocumentType,
  version: document.version,
  contentHash: computeLegalContentHash(document.relativePath),
  publicationTimestamp: document.publicationTimestamp,
  metadata: {
    ...(document.metadata ?? {}),
    sourceFile: `legal-content/${document.relativePath}`,
  },
}));
