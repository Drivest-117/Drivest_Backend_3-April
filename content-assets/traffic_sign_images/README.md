# Traffic Sign Images Channel

This folder holds the generated traffic-sign image index used by the iOS app to resolve sign images from backend-managed storage instead of bundling the full JPG archive inside the app.

## Files

- `index.json`
  Generated image index with `baseUrl` and `relativePaths`.

## Commands

Build or refresh the index:

```bash
npm run traffic-sign-images:index
```

Preview the S3 upload plan:

```bash
npm run traffic-sign-images:upload:s3:dry-run
```

Upload the image set and index:

```bash
npm run traffic-sign-images:upload:s3
```

Preview the manifest row:

```bash
npm run traffic-sign-images:manifest:dry-run
```

Apply the manifest row:

```bash
npm run traffic-sign-images:manifest
```

## Expected flow

1. Refresh `index.json` from the canonical traffic-sign image source.
2. Upload the image files and `index.json` to S3.
3. Seed the `content_pack_manifest` row for module `traffic_sign_images`, kind `index`, language `shared`.
4. iOS downloads the index through `/content-packs/manifest`, then lazily fetches and caches images on device.

## Operations

For the manual GitHub Actions operator flow, see [`docs/content-pack-publish-runbook.md`](../../docs/content-pack-publish-runbook.md).
