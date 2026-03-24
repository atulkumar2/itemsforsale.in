# E2E Scripts

This folder is for disposable end-to-end flows that boot the app against a temporary PostgreSQL container, exercise real HTTP routes, and then tear everything down.

## Current

### Admin inventory lifecycle

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

### Admin auth and security

- `admin-auth-guard-flow.mjs`
  - Verifies protected admin APIs reject unauthenticated requests.
  - Verifies wrong captcha and wrong credentials are blocked.
  - Verifies valid session cookie is required for protected create/delete mutations.

- `admin-session-flow.mjs`
  - Logs in once and reuses one session for multiple admin mutations.
  - Verifies logout clears browser access for protected routes.
  - Verifies tampered admin session cookie is rejected.

### Public buyer flows

- `public-lead-flow.mjs`
  - Seeds one public item.
  - Submits single-item interest via public route.
  - Verifies lead row fields and expected price context linkage.
  - Verifies admin leads page visibility for submitted enquiry.

- `public-bulk-interest-flow.mjs`
  - Seeds multiple public items.
  - Submits one combined enquiry via `/api/bulk-leads`.
  - Verifies one lead row per selected item and correct mapping.
  - Verifies admin leads page visibility for submitted enquiry.

- `public-contact-flow.mjs`
  - Submits merged seller contact request via public route.
  - Verifies contact submission persistence including captcha prompt.
  - Verifies admin contact submissions page visibility.

- `public-location-fallback-flow.mjs`
  - Seeds one item without `locationArea` and one with real location text.
  - Verifies no-location item page links to `/about-seller`.
  - Verifies located item page renders location text directly.

### Captcha and abuse controls

- `human-check-refresh-flow.mjs`
  - Fetches one challenge and then a refreshed challenge from `/api/human-check`.
  - Verifies challenge token changes across refresh.
  - Verifies stale token with refreshed answer is rejected.
  - Verifies refreshed challenge accepts valid lead submission.

- `admin-rate-limit-flow.mjs`
  - Repeatedly hits admin login until throttled.
  - Verifies `429` responses include `Retry-After`.
  - Verifies login succeeds again after fresh app restart (window reset strategy).

- `public-rate-limit-flow.mjs`
  - Repeatedly submits valid public lead requests to route limit.
  - Repeatedly submits valid public contact requests to route limit.
  - Verifies `429` and `Retry-After` on overflow attempts.
  - Verifies no excess lead/contact rows are written after throttle.

- `export-throttle-flow.mjs`
  - Verifies invalid export filter is rejected with `400`.
  - Repeatedly hits public catalogue export until throttled.
  - Verifies `429` and `Retry-After` on overflow request.

### Read-only public behavior

- `catalogue-render-flow.mjs`
  - Seeds items in `available`, `reserved`, and `sold` states.
  - Verifies catalogue heading, seeded cards, and status badges render.
  - Verifies export link and grid/table controls render.

- `item-detail-render-flow.mjs`
  - Seeds one item with multiple photos.
  - Verifies item metadata panel and location rendering.
  - Verifies gallery thumbnails and enquiry form section render.

- `about-seller-flow.mjs`
  - Verifies seller address and Google Maps link render.
  - Verifies distance table rows and map embed render.
  - Verifies merged contact form and captcha selector render.

### Export and reporting

- `csv-export-flow.mjs`
  - Seeds representative catalogue and leads data.
  - Verifies public and admin CSV export headers.
  - Verifies CSV escaping for commas, quotes, formulas, and newlines.

- `admin-leads-view-flow.mjs`
  - Seeds leads with varied timestamps, items, and bid prices.
  - Verifies admin leads list renders expected and bid prices.
  - Verifies newest-first ordering and filter behavior.

### System and environment behavior

- `system-status-flow.mjs` ✓
  - Verify admin system status page renders correctly in postgres mode
  - Validate reported DB connection metadata (host, port, database) is displayed
  - Check PostgreSQL reachability status shows "Reachable" when DB is accessible
  - Coverage: HTTP 200, page structure, connection details rendering

- `startup-schema-flow.mjs` ✓
  - Start fresh PostgreSQL database without prior schema
  - Apply DDL and verify schema initialization creates all tables (items, item_images, leads, contact_submissions)
  - Verify 14, 5, 8, 8 columns respectively for each table
  - Insert test data, reapply DDL (idempotent check), verify data survives
  - Test foreign key constraints remain functional after schema reapplication
  - Coverage: Idempotent schema DDL, data persistence, constraint integrity

- `cleanup-resilience-flow.mjs` ✓
  - Create item with multiple file uploads to generate temporary resources
  - Intentionally trigger test failure mid-execution (try block throws error)
  - Verify cleanup handlers execute reliably even after failure (finally block)
  - Validate uploaded image files are removed from disk after cleanup
  - Validate resource cleanup (app process, database container) executes properly
  - Distinguish expected intentional failure from unexpected errors (exit code 0 vs 1)
  - Coverage: Failure recovery, cleanup reliability under error conditions, file removal verification

## Conventions

- Keep all new E2E scripts inside `scripts/e2e/flows/`.
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
- `npm run test:e2e` auto-discovers `*-flow.mjs` scripts from `scripts/e2e/flows/` and uses `scripts/e2e/flow-run-config.json`.
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
- Run one configured category:
  - `npm run test:e2e -- --category system-environment`
- Available categories in `flow-run-config.json`:
  - `admin-inventory`
  - `admin-auth-security`
  - `public-buyer`
  - `captcha-abuse`
  - `public-readonly`
  - `export-reporting`
  - `system-environment`
- Run one flow directly:
  - `node scripts/e2e/flows/admin-flow.mjs`
  - `node scripts/e2e/flows/admin-delete-flow.mjs`
- Control combined runs with `scripts/e2e/flow-run-config.json`.
- Every `npm run test:e2e` run writes logs to:
  - `scripts/e2e/logs/run-all-latest.log`
  - `scripts/e2e/logs/run-all-<timestamp>.log`
- Timestamped logs are auto-rotated to keep only the latest 5 files.

Example `flow-run-config.json`:

```json
{
  "admin-flow.mjs": {
    "status": "run",
    "category": "admin-inventory"
  },
  "admin-delete-flow.mjs": {
    "status": "not-run",
    "category": "admin-inventory"
  }
}
```

Allowed values:

- `"run"`: include script in `npm run test:e2e`
- `"not-run"`: skip script in `npm run test:e2e`
- `"category"`: assign the script to a category for `--category <name>` filtering
- Legacy string-only entries (`"run"` / `"not-run"`) still work, but object entries are preferred for category-based runs

## Recommended Order

If you are building coverage incrementally, add scripts in this order:

01. ✅ Admin delete flow
02. ✅ Admin create-validation flow
03. ✅ Admin image-validation flow  
04. ✅ Admin slug-regression flow
05. ✅ Admin rate-limit flow
06. ✅ Admin session flow
07. ✅ Public single-item lead flow
08. ✅ Public bulk-interest flow
09. ✅ Public contact/about-seller flow
10. ✅ Public location fallback flow
11. ✅ Human-check refresh flow
12. ✅ Public rate-limit flow
13. ✅ Export throttle flow
14. ✅ Catalogue render flow
15. ✅ Item detail render flow
16. ✅ About seller flow
17. ✅ CSV export flow
18. ✅ Admin leads view flow
19. ✅ System status, startup-schema, and cleanup-resilience flows
