# E2E Scripts

This folder is for disposable end-to-end flows that boot the app against a temporary PostgreSQL container, exercise real HTTP routes, and then tear everything down.

## Current

- `postgres-admin-flow.mjs`
  - Starts a separate Postgres container on a non-default host port.
  - Applies DDL and inserts one dummy seed row before the app starts.
  - Boots the app in postgres mode.
  - Logs in through the real admin login route and captcha flow.
  - Creates an item with 3 uploaded photos.
  - Edits that item, changes multiple fields, removes one image, and adds one new image.
  - Verifies DB state, uploaded files, and public item rendering.
  - Cleans up the app process, uploads, and temporary container.

## Scenario Backlog

### Admin inventory lifecycle

- `postgres-admin-delete-flow.mjs`
  - Login as admin.
  - Delete an existing item.
  - Verify item row, image rows, and uploaded files are removed.
  - Verify the public item route returns not found.

- `postgres-admin-create-validation-flow.mjs`
  - Try creating items with missing title, invalid dates, bad status, and oversized numbers.
  - Verify `400` responses and no partial item/image rows.

- `postgres-admin-image-validation-flow.mjs`
  - Try unsupported MIME types, too many files, and oversized files.
  - Verify validation errors and no stored files.

- `postgres-admin-slug-regression-flow.mjs`
  - Create items with similar titles.
  - Verify unique slug generation on create and edit.
  - Verify public item routes still resolve after title changes.

### Admin auth and security

- `postgres-admin-auth-guard-flow.mjs`
  - Verify protected admin APIs reject unauthenticated requests.
  - Verify wrong credentials and wrong captcha answers are blocked.
  - Verify valid session cookie is required for protected mutations.

- `postgres-admin-rate-limit-flow.mjs`
  - Repeatedly hit admin login until throttled.
  - Verify `429` and `Retry-After`.
  - Confirm a fresh flow succeeds after reset/window expiry strategy.

- `postgres-admin-session-flow.mjs`
  - Login once, reuse session across multiple admin mutations.
  - Verify logout clears access.
  - Verify expired or tampered cookie is rejected.

### Public buyer flows

- `postgres-public-lead-flow.mjs`
  - Seed one public item.
  - Submit single-item interest from the public item page.
  - Verify lead row, expected price context, and admin visibility.

- `postgres-public-bulk-interest-flow.mjs`
  - Seed multiple public items.
  - Submit one combined enquiry from `/show-interest`.
  - Verify one lead row per selected item and correct item mapping.

- `postgres-public-contact-flow.mjs`
  - Submit the merged seller contact form from `/about-seller`.
  - Verify contact submission persistence and admin visibility.

- `postgres-public-location-fallback-flow.mjs`
  - Seed one item without `locationArea`.
  - Verify the item detail page links to `/about-seller`.
  - Verify items with a real location still show their own location text.

### Captcha and abuse controls

- `postgres-human-check-refresh-flow.mjs`
  - Fetch a challenge, refresh it, and confirm the token changes.
  - Verify the old token no longer passes when the flow expects the new challenge.

- `postgres-public-rate-limit-flow.mjs`
  - Repeatedly submit lead/contact requests.
  - Verify `429` responses and no excess rows.

- `postgres-export-throttle-flow.mjs`
  - Hit public catalogue export repeatedly.
  - Verify throttling and invalid query rejection.

### Read-only public behavior

- `postgres-catalogue-render-flow.mjs`
  - Seed items in `available`, `reserved`, and `sold` states.
  - Verify grid/table rendering, status badges, and selection behavior.

- `postgres-item-detail-render-flow.mjs`
  - Seed an item with multiple photos.
  - Verify the public page renders metadata, gallery thumbnails, and enquiry form defaults.

- `postgres-about-seller-flow.mjs`
  - Verify seller address, Google Maps link, distance table, map embed, and merged contact form all render.

### Export and reporting

- `postgres-csv-export-flow.mjs`
  - Seed representative catalogue data.
  - Hit public and admin export endpoints.
  - Validate headers, row content, and CSV escaping for commas, quotes, formulas, and newlines.

- `postgres-admin-leads-view-flow.mjs`
  - Seed leads with different timestamps, items, and bid prices.
  - Verify admin leads list shows expected price, buyer bid, and correct sorting/filtering.

### System and environment behavior

- `postgres-system-status-flow.mjs`
  - Verify admin system status page in postgres mode.
  - Validate reported DB target metadata and reachability checks.

- `postgres-startup-schema-flow.mjs`
  - Start from minimal DDL only.
  - Verify the app bootstraps missing columns/constraints needed by the current store implementation.

- `postgres-cleanup-resilience-flow.mjs`
  - Force a mid-test failure after uploads are created.
  - Verify temp app/container cleanup still happens and uploaded files are removed.

## Conventions

- Keep all new E2E scripts inside `scripts/e2e/`.
- Prefer one script per clear user journey or security boundary.
- Reuse helpers from `helpers.mjs` and grow that file instead of duplicating container/app/bootstrap logic.
- Use separate container names and non-default ports so local developer databases are not disturbed.
- Insert enough seed data to avoid the app auto-seeding unrelated defaults when that matters for assertions.
- Prefer deterministic assertions against:
  - HTTP status and response payloads
  - DB rows
  - uploaded files on disk
  - rendered public/admin page HTML when useful
- Every script should clean up its app process, temporary DB container, and test uploads even on failure.

## Recommended Order

If you are building coverage incrementally, add scripts in this order:

1. Admin delete flow
2. Public single-item lead flow
3. Public bulk-interest flow
4. Public contact/about-seller flow
5. Auth guard and rate-limit flows
6. CSV export flow
7. System status and startup-schema flows
