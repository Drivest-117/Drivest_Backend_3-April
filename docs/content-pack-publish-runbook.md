# Content Pack Publish Runbook

This runbook covers the current manual publish flow for the iOS traffic-sign image pack.

## Scope

- Workflow: `Publish Content Packs`
- Current target: `traffic-sign-images`
- Current mode: manual only

This flow is intentionally not automatic. Run it only when you intend to publish a content change.

## Before You Run Anything

Confirm these conditions first:

- The source images in `Drivest2026/drivest-ios` are in the exact state you want to publish.
- The backend repo `Drivest2026/Drivest-backend` is on `main` and includes the latest publish-workflow fixes.
- GitHub Actions repository variables exist:
  - `AWS_ROLE_ARN`
  - `AWS_REGION`
- GitHub Actions repository secrets exist:
  - `DATABASE_URL`
  - `IOS_REPO_READ_TOKEN`
- Optional DB secrets match the live backend database if needed:
  - `DB_SSL`
  - `DB_SSL_REJECT_UNAUTHORIZED`

## Safe Preview

Use preview first every time.

1. Open `Drivest2026/Drivest-backend` in GitHub.
2. Go to `Actions`.
3. Open `Publish Content Packs`.
4. Click `Run workflow`.
5. Set:
   - `publish_mode = dry-run`
   - `content_target = traffic-sign-images`
6. Run the workflow.

## What A Good Dry-Run Looks Like

The workflow should finish with `Success` and show a summary block with:

- mode `dry-run`
- target `traffic-sign-images`
- indexed file count
- source root from the checked-out iOS repo
- version
- S3 bucket and prefix
- upload size
- manifest URL

Current expected shape is roughly:

- files: about `679`
- upload size: about `47.85 MB`
- bucket: `contentpackages`
- prefix: `ios/traffic_sign_images/shared`

If the dry-run does not succeed, do not run `apply`.

## Live Publish

Run this only after a successful dry-run and only when you want the new pack to go live.

1. Open `Publish Content Packs`.
2. Click `Run workflow`.
3. Set:
   - `publish_mode = apply`
   - `content_target = traffic-sign-images`
4. Run the workflow.

The apply flow will:

1. rebuild the traffic-sign index
2. upload images and `index.json` to S3
3. write the manifest row for module `traffic_sign_images`

## After Publish

Verify these points:

- The workflow completed with `Success`.
- The summary version and manifest URL look correct.
- The backend `/content-packs/manifest` response contains the new `traffic_sign_images` row.
- iOS can resolve and cache a few representative sign images.

Minimum spot-check:

- one speed sign
- one motorway sign
- one road works sign

## When Not To Publish

Do not publish if:

- the iOS source repo has unreviewed asset churn
- the pack size changed unexpectedly
- the manifest URL or bucket/prefix looks wrong
- backend DB credentials were changed and not revalidated

## Rollback

There is no automatic rollback button in the workflow today.

If a bad publish happens, rollback is operational:

1. identify the last good pack version
2. restore or republish the previous S3 content at the same prefix, or publish the previous known-good asset set as a new version
3. update the manifest so the active row points at the desired version
4. rerun app verification

The safest rollback method is a new intentional publish from a known-good iOS source state rather than manual object-by-object S3 edits.

## Operating Policy

- Keep this workflow manual-only.
- Always run `dry-run` before `apply`.
- Do not tie this workflow to every push.
- Treat content publishing as a release action, not a build side effect.
