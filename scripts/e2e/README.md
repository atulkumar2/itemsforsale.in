# E2E Scripts

This folder is for disposable end-to-end flows that boot the app against a temporary PostgreSQL container, exercise real HTTP routes, and then tear everything down.

## Current

- `admin-flow.mjs`
  - Starts a separate Postgres container on a non-default host port.
  - Applies DDL and inserts one dummy seed row before the app starts.
  - Boots the app in postgres mode.
  - Logs in through the real admin login route and captcha flow.
  - Creates an item with 3 uploaded photos.
  - Edits that item, changes multiple fields, removes one image, and adds one new image.
  - Verifies DB state, uploaded files, and public item rendering.
  - Cleans up the app process, uploads, and temporary container.

- `admin-delete-flow.mjs`
  - Covers admin login and item delete.
  - Verifies item and image rows are removed from PostgreSQL.
  - Verifies item image files are removed from local upload storage.
  - Verifies public item route returns not found after delete.

- `admin-auth-guard-flow.mjs`
  - Verifies protected admin APIs reject unauthenticated requests.
  - Verifies wrong captcha and wrong credentials are blocked.
  - Verifies valid session cookie is required for protected create/delete mutations.

- `admin-rate-limit-flow.mjs`
  - Repeatedly hits admin login until throttled.
  - Verifies `429` responses include `Retry-After`.
  - Verifies login succeeds again after fresh app restart (window reset strategy).

- `admin-session-flow.mjs`
  - Logs in once and reuses one session for multiple admin mutations.
  - Verifies logout clears browser access for protected routes.
  - Verifies tampered admin session cookie is rejected.

- `admin-create-validation-flow.mjs`
  - Verifies missing title, invalid dates, bad status, and oversized number fields are rejected.
  - Verifies title too long is rejected.
  - Verifies no partial item/image rows created on validation failure.

- `admin-image-validation-flow.mjs`
  - Verifies unsupported MIME types are rejected.
  - Verifies too many image files (>8) are rejected.
  - Verifies oversized image files (>5 MB) are rejected.
  - Verifies no files stored on validation failure.

- `admin-slug-regression-flow.mjs`
  - Creates multiple items with similar titles.
  - Verifies each gets a unique slug.
  - Edits an item and verifies slug changes to match new title.
  - Verifies old public route returns not-found.
  - Verifies new public route renders with updated content.

## Scenario Backlog

### Admin inventory lifecycle (Complete)

### Admin auth and security (Complete)

### Public buyer flows

- `public-lead-flow.mjs`
  - Seed one public item.
  - Submit single-item interest from the public item page.
  - Verify lead row, expected price context, and admin visibility.

- `public-bulk-interest-flow.mjs`
  - Seed multiple public items.
  - Submit one combined enquiry from `/show-interest`.
  - Verify one lead row per selected item and correct item mapping.

- `public-contact-flow.mjs`
  - Submit the merged seller contact form from `/about-seller`.
  - Verify contact submission persistence and admin visibility.

- `public-location-fallback-flow.mjs`
  - Seed one item without `locationArea`.
  - Verify the item detail page links to `/about-seller`.
  - Verify items with a real location still show their own location text.

### Captcha and abuse controls

- `human-check-refresh-flow.mjs`
  - Fetch a challenge, refresh it, and confirm the token changes.
  - Verify the old token no longer passes when the flow expects the new challenge.

- `public-rate-limit-flow.mjs`
  - Repeatedly submit lead/contact requests.
  - Verify `429` responses and no excess rows.

- `export-throttle-flow.mjs`
  - Hit public catalogue export repeatedly.
  - Verify throttling and invalid query rejection.

### Read-only public behavior

- `catalogue-render-flow.mjs`
  - Seed items in `available`, `reserved`, and `sold` states.
  - Verify grid/table rendering, status badges, and selection behavior.

- `item-detail-render-flow.mjs`
  - Seed an item with multiple photos.
  - Verify the public page renders metadata, gallery thumbnails, and enquiry form defaults.

- `about-seller-flow.mjs`
  - Verify seller address, Google Maps link, distance table, map embed, and merged contact form all render.

### Export and reporting

- `csv-export-flow.mjs`
  - Seed representative catalogue data.
  - Hit public and admin export endpoints.
  - Validate headers, row content, and CSV escaping for commas, quotes, formulas, and newlines.

- `admin-leads-view-flow.mjs`
  - Seed leads with different timestamps, items, and bid prices.
  - Verify admin leads list shows expected price, buyer bid, and correct sorting/filtering.

### System and environment behavior

- `system-status-flow.mjs`
  - Verify admin system status page in postgres mode.
  - Validate reported DB target metadata and reachability checks.

- `startup-schema-flow.mjs`
  - Start from minimal DDL only.
  - Verify the app bootstraps missing columns/constraints needed by the current store implementation.

- `cleanup-resilience-flow.mjs`
  - Force a mid-test failure after uploads are created.
  - Verify temp app/container cleanup still happens and uploaded files are removed.

## Conventions

- Keep all new E2E scripts inside `scripts/e2e/`.
- Prefer one script per clear user journey or security boundary.
- Reuse helpers from `helpers.mjs` and shared setup/teardown from `flow-common.mjs`.
- Use separate container names and non-default ports so local developer databases are not disturbed.
- Insert enough seed data to avoid the app auto-seeding unrelated defaults when that matters for assertions.
- Prefer deterministic assertions against:
  - HTTP status and response payloads
  - DB rows
  - uploaded files on disk
  - rendered public/admin page HTML when useful
- Every script should clean up its app process, temporary DB container, and test uploads even on failure.
- `npm run test:e2e` auto-discovers `*-flow.mjs` scripts and uses `scripts/e2e/flow-run-config.json`.
- Mark a script as `"not-run"` in that config to skip it during combined runs.

## Script Structure Conventions

- Put shared setup and teardown code in `flow-common.mjs`.
- Keep each `*-flow.mjs` focused on scenario-specific steps and assertions.
- Prefer this shape for each flow script:
  - module docs with coverage bullets
  - `config` from `getPostgresE2EConfig()`
  - scenario helpers (`createX`, `verifyX`, etc.)
  - `main()` that uses shared preflight/start/login/cleanup helpers
- Keep side effects isolated:
  - seed data in `applySchemaAndSeedData(...)`
  - process startup through `startApp(...)`
  - cleanup through `cleanupRun(...)`
- Use deterministic assertions only (DB rows, file presence, route response state).

## Shared Building Blocks

Use these from `flow-common.mjs` when writing new scripts:

- Runtime and infra:
  - `getPostgresE2EConfig`
  - `ensureDockerAvailable`
  - `startPostgresContainer`
  - `waitForPostgres`
  - `applySchemaAndSeedData`
- App and auth:
  - `startApp`
  - `waitForApp`
  - `loginAsAdmin`
- Files and images:
  - `createImageFile`
  - `assertFileExists`
  - `assertFileMissing`
- Safety and cleanup:
  - `preflightCleanup`
  - `cleanupRun`

## Running E2E

- Run all enabled flows:
  - `npm run test:e2e`
- Run one flow directly:
  - `node scripts/e2e/admin-flow.mjs`
  - `node scripts/e2e/admin-delete-flow.mjs`
- Control combined runs with `scripts/e2e/flow-run-config.json`.

Example `flow-run-config.json`:

```json
{
  "admin-flow.mjs": "run",
  "admin-delete-flow.mjs": "not-run"
}
```

Allowed values:

- `"run"`: include script in `npm run test:e2e`
- `"not-run"`: skip script in `npm run test:e2e`

## Recommended Order

If you are building coverage incrementally, add scripts in this order:

1. ✅ Admin delete flow
2. ✅ Admin create-validation flow
3. ✅ Admin image-validation flow  
4. ✅ Admin slug-regression flow
5. ✅ Admin rate-limit flow
6. ✅ Admin session flow
7. Public single-item lead flow
8. Public bulk-interest flow
9. Public contact/about-seller flow
10. CSV export flow
11. System status and startup-schema flows
