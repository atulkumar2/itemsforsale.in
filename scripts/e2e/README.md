# E2E Scripts Plan

## Current

- `postgres-admin-flow.mjs`
  - Covers admin login with captcha, item create/edit, image add/remove, public item page render, and cleanup.

## Planned For Tomorrow

- `postgres-admin-delete-flow.mjs`
  - Login and delete an existing item.
  - Verify item images are removed from DB and file storage.
  - Verify public item route returns not found after delete.

- `postgres-admin-auth-guard-flow.mjs`
  - Verify protected admin APIs reject unauthenticated requests.
  - Verify wrong credentials and wrong captcha answers are blocked.
  - Verify session cookie is required for protected mutations.

- `postgres-seller-user-contact-flow.mjs`
  - Seed an item as seller/admin.
  - Submit contact seller form and lead form as end user from public pages.
  - Verify DB persistence and admin listing visibility for both submission types.
  - Validate rate-limit and captcha behavior for repeated submissions.

- `postgres-seller-user-lifecycle-flow.mjs`
  - Seller/admin creates and updates an item.
  - End user opens public item page and submits interest.
  - Seller/admin marks item reserved/sold.
  - End user sees updated item status and availability behavior on public page.

- `postgres-bulk-interest-visibility-flow.mjs`
  - Seller/admin seeds multiple active items.
  - Many end users submit interest across those items (bulk lead generation).
  - Verify admin leads view/API shows full interest volume with correct item mapping.
  - Verify sorting/filtering still surfaces latest and high-volume interest correctly.
  - Verify no dropped/duplicate records between submission and admin visibility.

- `postgres-csv-export-flow.mjs`
  - Seed representative data.
  - Hit catalogue export endpoint and validate CSV headers/content.
  - Validate CSV escaping for commas, quotes, and newlines.

- `postgres-system-status-flow.mjs`
  - Verify admin system status endpoint in postgres mode.
  - Validate reported DB target metadata and connectivity checks.

## Notes

- Keep all new E2E scripts inside `scripts/e2e/`.
- Reuse shared helper patterns from `postgres-admin-flow.mjs` where possible.
- Prefer merged seller + user journeys where it improves confidence with fewer scripts.
- Prefer deterministic assertions and explicit cleanup in every script.
