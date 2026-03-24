# itemsforsale.in

A local-first personal item selling board built with Next.js, TypeScript, Tailwind CSS, and a Supabase-ready data model.

Site URL: [itemsforsale.in](https://itemsforsale.in)

## Table Of Contents

- [Overview](#overview)
- [Current Implementation](#current-implementation)
- [Documents](#documents)
- [Local Setup](#local-setup)
- [Dev Server Notes](#dev-server-notes)
- [Local Defaults](#local-defaults)
- [Security Notes](#security-notes)
- [Local PostgreSQL Mode](#local-postgresql-mode)
- [Dev Fake Data Seeding](#dev-fake-data-seeding)
- [Recreate PostgreSQL Database](#recreate-postgresql-database)
- [Testing](#testing)
- [Moving To Supabase Later](#moving-to-supabase-later)
- [Spec References](#spec-references)

## Overview

This repository is a single Next.js full-stack app. The frontend and backend are in one codebase:

- UI pages and components live in `app/` and `components/`
- API routes live in `app/api/`
- shared validation, auth, security, and repository code lives in `lib/`

If you are new to full stack development and want to understand how that works in this repo, start with [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Current Implementation

The app currently runs fully in local mode without cloud infrastructure:

- public catalogue with search, filters, grid/table views, and CSV export
- homepage multi-select flow that lets buyers choose multiple items and submit one combined interest request
- item detail page with gallery, thumbnail switching, and single-item interest form
- merged seller page with address, map, distance table, and server-issued human-check contact form
- public catalogue export with CSV hardening and rate limiting
- admin login with signed cookie session and human check
- admin CRUD for items
- admin leads page with filtering and CSV export
- admin contact submissions log with CSV export
- admin system status page for active data mode and PostgreSQL connectivity
- local image upload with JPG/PNG/WebP restrictions, server-side compression, and generated thumbnail/full variants
- data can run in JSON mode or local PostgreSQL mode
- lead and contact submission capture stored in `data/local-db.json` or PostgreSQL depending on `DATA_MODE`
- in-memory IP-based rate limiting on login, lead/contact submission, bulk interest submission, and public catalogue export
- CSV exports neutralize spreadsheet formula payloads

This keeps the project usable locally while preserving a path to Supabase and Vercel later.

## Documents

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): system architecture, request flows, frontend/backend explanation, and persistence model
- [docs/ATTACK_SURFACE_REVIEW.md](docs/ATTACK_SURFACE_REVIEW.md): practical threat model, exposed routes, defenses, and remaining gaps
- [docs/SUPABASE_VERCEL_MIGRATION.md](docs/SUPABASE_VERCEL_MIGRATION.md): migration checklist for moving to Supabase and Vercel
- [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md): development environment and local runtime troubleshooting
- [docs/security-review-20260320-090536.md](docs/security-review-20260320-090536.md): saved security review report
- [scripts/e2e/README.md](scripts/e2e/README.md): disposable end-to-end test scenarios and coverage plan

## Local Setup

1. Copy `.env.example` to `.env.local`
2. Set admin and captcha secrets in `.env.local`
3. Install dependencies with `npm install`
4. Start the app with `npm run dev`
5. Open `http://localhost:3000`

Recommended local env values:

```bash
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-this-password
ADMIN_SESSION_SECRET=change-this-session-secret
CONTACT_CAPTCHA_SECRET=change-this-captcha-secret
```

Production note:

- `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ADMIN_SESSION_SECRET` must be set in production or admin login returns `503`
- `CONTACT_CAPTCHA_SECRET` is recommended explicitly; if omitted, captcha signing falls back to `ADMIN_SESSION_SECRET`

## Dev Server Notes

The default `npm run dev` script uses webpack with polling enabled. On Linux machines that have low inotify limits, both Turbopack and normal webpack file watching can fail with `OS file watch limit reached` or `ENOSPC`.

If you want to try Turbopack explicitly, use `npm run dev:turbo`.

If you want webpack without polling, use `npm run dev:webpack`.

If the host machine still runs out of file watchers globally, raise the Linux inotify limits:

```bash
sudo sysctl fs.inotify.max_user_watches=524288
sudo sysctl fs.inotify.max_user_instances=1024
```

To make that persistent across reboots, add these values to `/etc/sysctl.conf` or a file under `/etc/sysctl.d/`.

For a complete Linux troubleshooting guide, see [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

When accessing the dev server from another device on the same LAN, set `NEXT_ALLOWED_DEV_ORIGINS` in `.env.local` to include hostnames, not full URLs:

```bash
NEXT_ALLOWED_DEV_ORIGINS=192.168.1.21,localhost
```

## Local Defaults

- `DATA_MODE=local`
- local catalogue data is auto-seeded on first run
- in development only, admin credentials and session secret fall back to local defaults if env vars are missing
- uploaded images are written to `public/uploads`

## Security Notes

- Admin sessions are signed tokens, not deterministic cookies.
- Captcha answers are kept server-side and the browser only receives a signed challenge token.
- Item interest, multi-item interest, contact seller, and admin login all use human-check questions.
- Admin uploads accept only JPG, PNG, and WebP files, with file count and size limits enforced server-side.
- Uploaded images are re-encoded server-side and stored as optimized WebP display and thumbnail variants.
- Login, lead submission, bulk interest submission, contact submission, and public catalogue export routes have in-memory IP-based throttling.
- CSV exports escape quotes and neutralize cells beginning with spreadsheet formula characters.

## Local PostgreSQL Mode

The app can run against local PostgreSQL while still using local filesystem image storage.

1. Start PostgreSQL with Docker Compose:

```bash
npm run db:up
```

2. Copy `.env.example` to `.env.local` if not already done
3. Set `DATA_MODE=postgres`
4. Set `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/itemsforsale`
5. Optional: initialize schema manually with:

```bash
psql postgresql://postgres:postgres@localhost:5432/itemsforsale -f data/postgres.local.sql
```

6. If you already have an older local PostgreSQL database without the latest constraints, run:

```bash
npm run db:migrate:constraints
```

7. Optional: import your existing JSON data into PostgreSQL:

```bash
npm run db:import
```

Useful commands:

```bash
npm run db:up
npm run db:down
npm run db:logs
npm run db:migrate:constraints
npm run db:seed:dev
npm run db:seed:cleanup
npm run db:recreate
npm run db:recreate:seed
```

Notes:

- the app auto-creates tables on first request in `postgres` mode
- seed data is inserted automatically if the `items` table is empty
- uploaded images still remain in `public/uploads`
- switching back to `DATA_MODE=local` returns to JSON-backed storage
- Docker Compose file: `docker-compose.yml`
- JSON import script: `scripts/import-json-to-postgres.mjs`

## Dev Fake Data Seeding

To quickly populate demo leads and contact submissions in development:

```bash
npm run db:seed:dev
```

Behavior:

- if `DATA_MODE=postgres`, inserts fake rows into `leads` and `contact_submissions`
- if `DATA_MODE=local`, writes fake rows into `data/local-db.json`

You can also seed and start the dev server in one command:

```bash
npm run dev:seed
```

To remove previously seeded fake data:

```bash
npm run db:seed:cleanup
```

## Recreate PostgreSQL Database

To fully recreate local PostgreSQL from scratch:

```bash
npm run db:recreate
```

To recreate and also seed fake leads/submissions:

```bash
npm run db:recreate:seed
```

## Testing

- Run all tests: `npm test`
- Run tests in watch mode: `npm run test:watch`
- Run all E2E scripts (auto-discovers `scripts/e2e/*-flow.mjs`): `npm run test:e2e`
- Run one E2E flow directly: `node scripts/e2e/<name>-flow.mjs`
- Run lint: `npm run lint`

E2E run behavior:

- `npm run test:e2e` uses `scripts/e2e/run-all.mjs`
- runner discovers all `*-flow.mjs` files inside `scripts/e2e/`
- runner reads `scripts/e2e/flow-run-config.json` for run control
- set a flow to `"not-run"` in that file to skip it from combined runs

Example:

```json
{
  "postgres-admin-flow.mjs": "run",
  "postgres-admin-delete-flow.mjs": "not-run"
}
```

Current automated coverage includes:

- captcha normalization, signed challenge validation, expiry, and secret mismatch handling
- signed token helpers
- rate-limit bucket behavior
- upload restrictions and server-side re-encoding
- CSV formula neutralization
- schema validation for single-item interest, multi-item interest, and contact seller flows
- route-level `429` and `503` responses for admin login and contact submission protections
- route-level `429` responses for lead submission, multi-item lead submission, and public catalogue export protections
- disposable PostgreSQL-backed end-to-end admin create/edit flow via `npm run test:e2e:postgres-admin`

Current test files:

- `tests/admin-login-route.test.ts`
- `tests/bulk-interest-form-validation.test.ts`
- `tests/bulk-leads-route.test.ts`
- `tests/catalogue-export-route.test.ts`
- `tests/contact-captcha.test.ts`
- `tests/contact-seller-validation.test.ts`
- `tests/contact-submissions-route.test.ts`
- `tests/crypto-tokens.test.ts`
- `tests/csv-security.test.ts`
- `tests/human-check-route.test.ts`
- `tests/interest-form-validation.test.ts`
- `tests/leads-route.test.ts`
- `tests/rate-limit.test.ts`
- `tests/upload-security.test.ts`

End-to-end flow:

- `npm run test:e2e:postgres-admin`
  - starts a temporary PostgreSQL container on a non-default port
  - applies local DDL and seed data
  - boots the app in postgres mode
  - logs in as admin through the real HTTP flow
  - creates an item with 3 images
  - edits the item, removes an image, adds another image, and verifies DB/files/public rendering
  - tears down the app process, test uploads, and the temporary container

## Moving To Supabase Later

1. Create a Supabase project
2. Apply `data/supabase.sql`
3. Fill in the Supabase env vars
4. Swap the repository implementation from local storage to Supabase queries and storage operations
5. Replace the local admin cookie flow with Supabase Auth

## Spec References

- `specs/01_VISION.md`
- `specs/02_TECH_STACK.md`
- `specs/03_REQUIREMENTS.md`
- `specs/04_DATABASE.md`
- `specs/05_MVP_SCOPE.md`
- `specs/06_COPILOT_INSTRUCTIONS.md`
