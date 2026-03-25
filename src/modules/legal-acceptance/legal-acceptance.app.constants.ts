export type AppLegalDocumentType = 'terms' | 'privacy' | 'safety_notice';
export type AppConsentType = 'analytics' | 'notifications' | 'location';

export const APP_LEGAL_HEADER_INSTALL_ID = 'x-drivest-install-id';
export const APP_LEGAL_HEADER_PLATFORM = 'x-drivest-platform';
export const APP_LEGAL_HEADER_APP_VERSION = 'x-drivest-app-version';
export const APP_LEGAL_PUBLICATION_TIMESTAMP = '2026-03-24T00:00:00.000Z';

export const APP_LEGAL_SOURCE_ONBOARDING = 'onboarding_legal';
export const APP_CONSENT_SOURCE_ONBOARDING = 'onboarding_permissions';

export const APP_LEGAL_DEFAULT_DOCUMENTS: Array<{
  documentType: AppLegalDocumentType;
  version: string;
  contentHash: string;
  publicationTimestamp: string;
  metadata: Record<string, string>;
}> = [
  {
    documentType: 'terms',
    version: '3.0',
    contentHash: 'dcb6875e1c23a3577366a2dd1bb30b476d555a92ba66cbc7e193084ae7861d91',
    publicationTimestamp: APP_LEGAL_PUBLICATION_TIMESTAMP,
    metadata: {
      url: 'https://www.drivest.uk/terms.html',
      title: 'Drivest Terms and Conditions',
    },
  },
  {
    documentType: 'privacy',
    version: '3.0',
    contentHash: '6eae2b5bf2571e1a2f4738fc11d8dfb2502f57216288ad4f445486e64bd5e805',
    publicationTimestamp: APP_LEGAL_PUBLICATION_TIMESTAMP,
    metadata: {
      url: 'https://www.drivest.uk/privacypolicy.html',
      title: 'Drivest Privacy Policy',
    },
  },
  {
    documentType: 'safety_notice',
    version: '2026-03-24.v1',
    contentHash: '63da846f6eb4baaffbdefec0927fefb6cf148f47d44149b58d3549fc0b2125f6',
    publicationTimestamp: APP_LEGAL_PUBLICATION_TIMESTAMP,
    metadata: {
      title: 'Drivest Safety Notice',
      scope: 'combined_onboarding_legal_screen',
    },
  },
];

