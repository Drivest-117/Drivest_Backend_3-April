# Legal Content Channel

This folder is the backend-side source-of-truth for Drivest legal content.

## Why this exists

Before this channel was added, legal wording and version metadata were split across:
- Word documents outside the backend repo
- hardcoded backend legal constants
- mobile string resources and screen copy

That made weekly updates and translation work prone to drift.

## What belongs here

Canonical English source documents live under:
- `legal-content/source/en-GB/public`
- `legal-content/source/en-GB/internal`

The catalog of documents lives in:
- `legal-content/registry.json`

Canonical legal and disclaimer snippet packs live under:
- `legal-content/snippets`

Use text files in git, not Word binaries, as the canonical source. Export `.docx` only when you need external sharing or legal review packaging.

## Current limitation

This folder is now the backend source-of-truth for legal document storage and app-legal registry seeding, but not every downstream client string is dynamically sourced from it yet.

Today, some disclaimer and legal copy still exists directly in Android and iOS string resources. That means:
- backend legal versions and hashes can now stay aligned with the canonical source files here
- mobile disclaimers, onboarding copy, and some marketplace notices still need a later sync or extraction workflow if you want full end-to-end centralization

## Weekly workflow

1. Update the canonical English files in `legal-content/source/en-GB/...`.
2. If a legal meaning changes, update the corresponding `version`, `lastUpdated`, and `publicationTimestamp` in `legal-content/registry.json`.
3. Run:
   ```bash
   npm run legal:verify
   ```
4. If the changed document is part of app legal onboarding or bootstrap (`terms`, `privacy`, `safety_notice`), ship the backend update before client re-consent logic depends on it.
5. Run your translation workflow from these English source files, placing translated copies in locale folders such as `legal-content/source/fr-GB/...` or `legal-content/source/fr/...` when ready.
6. When a translated public legal page is published on the website, add its locale-specific URL under the relevant document's `metadata.localizedUrls` entry in `legal-content/registry.json`.

## Translation guidance

- Treat `en-GB` as the canonical authoring locale.
- Keep document ids stable across locales.
- Keep versions aligned by document meaning, not by translation date alone.
- Do not silently revise translated text without updating the source or documenting the difference.
- For public pages opened by the mobile apps, keep the default English page in `metadata.url` and add any translated website pages in `metadata.localizedUrls` keyed by locale, for example `ar`, `fr`, or `pt-PT`.

## Verification

The backend includes a verification script:
- `scripts/verify-legal-content.js`

It validates that registry entries point to real files and prints the computed hashes for the app-legal onboarding documents.
