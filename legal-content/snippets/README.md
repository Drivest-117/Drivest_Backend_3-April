# Legal Snippets Channel

This folder centralizes the legal and disclaimer snippets that are currently scattered across Android and iOS resource files.

## Scope

These snippet packs are intended for:
- onboarding legal copy
- onboarding permission copy
- marketplace legal notices
- advisory disclaimers
- safety and service-availability notices
- legal attribution notes

## Free-tier translation strategy

For legal copy, the safest free-tier approach is:
1. keep English canonical text in backend-managed snippet packs
2. reuse already shipped mobile translations where they exist
3. apply manual override drafts only for gaps or clearly stale translations
4. require human review before treating legal translations as final

This avoids introducing a paid translation dependency and is lower risk than calling a free machine-translation API for legal wording.

## Files

- `catalog.json`
  Defines snippet ids, document linkage, and platform source keys.
- `manual-overrides.json`
  Holds explicit locale overrides where the shipped translation is missing or stale.
- `locales/*.json`
  Generated locale packs.

## Commands

Build packs:
```bash
npm run legal:snippets:build
```

Verify completeness:
```bash
npm run legal:snippets:verify
```

Sync packs into Android and iOS localization files:
```bash
npm run legal:snippets:sync
```

Preview sync impact without writing files:
```bash
npm run legal:snippets:sync:dry-run
```

## Weekly workflow

1. Update the English source documents in `legal-content/source/en-GB/*`.
2. Refresh `manual-overrides.json` if a translated legal snippet needs a reviewed override.
3. Run `npm run legal:snippets:build`.
4. Run `npm run legal:snippets:verify`.
5. Run `npm run legal:snippets:sync`.
6. Commit the backend source change together with the Android/iOS localization sync.

## Important limitation

These packs are now centralized in the backend repo and can be synced into Android and iOS resource files from one source.
The mobile apps are still not consuming them dynamically at runtime, so the control model is "backend canonical source + generated mobile resource sync", not live remote delivery.
