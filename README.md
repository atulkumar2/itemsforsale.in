# itemsforsale.in

A local-first personal item selling board built with Next.js, TypeScript, Tailwind CSS, and a Supabase-ready data model.

Site URL: [itemsforsale.in](https://itemsforsale.in)

If you are new to full stack development and want to understand how the frontend and backend live together in this single Next.js repo, read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
For a practical security/threat-model view of the app, read [docs/ATTACK_SURFACE_REVIEW.md](docs/ATTACK_SURFACE_REVIEW.md).

## Current implementation

The app now runs fully in local mode without cloud infrastructure:

- public catalogue with search and filters
- catalogue export to CSV with item links
- item detail page with gallery and interest form
- stricter public interest form validation (phone, email, message)
- dedicated contact seller page with signed server-issued captcha challenges
- admin login with signed cookie session
- admin CRUD for items
- admin leads page with filtering and CSV export
- inventory quick links to item-specific leads and per-item lead counts
- admin contact submissions log with CSV export
- admin system status page for data mode and PostgreSQL connectivity
- local photo upload to `public/uploads` with JPG/PNG/WebP restrictions
- data can run in JSON mode or local PostgreSQL mode
- lead and contact submission capture stored in `data/local-db.json` or PostgreSQL depending on `DATA_MODE`
- in-memory IP-based rate limiting on admin login, leads, and contact submissions
- CSV exports neutralize spreadsheet formula payloads

This keeps the project testable before moving the same shape to Supabase.

## Local setup

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

## Dev server note

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

When accessing the dev server from another device on the same LAN (for example Windows), set NEXT_ALLOWED_DEV_ORIGINS in .env.local to include hostnames (not full URLs), for example:

```bash
NEXT_ALLOWED_DEV_ORIGINS=192.168.1.21,localhost
```

## Local defaults

- `DATA_MODE=local`
- local catalogue data is auto-seeded on first run
- in development only, admin credentials and session secret fall back to local defaults if env vars are missing
- uploaded images are written to `public/uploads`

## Security notes

- Admin sessions are signed tokens, not deterministic cookies.
- Captcha answers are kept server-side and the browser only receives a signed challenge token.
- Admin uploads accept only JPG, PNG, and WebP files, with file count and size limits enforced server-side.
- Login, lead submission, and contact submission routes have in-memory IP-based throttling.
- CSV exports escape quotes and neutralize cells beginning with spreadsheet formula characters.

## Local PostgreSQL mode

The app already uses local filesystem storage for uploaded images. If you want a local database closer to the future Supabase model before switching to Supabase, use PostgreSQL mode.

1. Start PostgreSQL with Docker Compose:

```bash
npm run db:up
```

1. Copy `.env.example` to `.env.local` if not already done
1. Set `DATA_MODE=postgres`
1. Set `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/itemsforsale`
1. Optional: initialize schema manually with:

```bash
psql postgresql://postgres:postgres@localhost:5432/itemsforsale -f data/postgres.local.sql
```

1. If you already have an older local PostgreSQL database without the latest constraints, run:

```bash
npm run db:migrate:constraints
```

1. Optional: import your existing JSON data into PostgreSQL:

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

## Dev fake data seeding

To quickly populate demo leads and contact submissions in development:

```bash
npm run db:seed:dev
```

Behavior:

- if `DATA_MODE=postgres`, inserts fake rows into `leads` and `contact_submissions`
- if `DATA_MODE=local`, writes fake rows into `data/local-db.json`

You can also seed and start dev server in one command:

```bash
npm run dev:seed
```

To remove previously seeded fake data:

```bash
npm run db:seed:cleanup
```

## Recreate PostgreSQL database

To fully recreate local PostgreSQL from scratch (drop volume, recreate schema, apply migrations, and import JSON data):

```bash
npm run db:recreate
```

To recreate and also seed fake leads/submissions:

```bash
npm run db:recreate:seed
```

## Testing

- Run all tests: `npm run test`
- Run tests in watch mode: `npm run test:watch`

Current unit tests cover:

- captcha normalization, signed challenge validation, expiry, and secret mismatch handling
- contact seller schema validation for phone, email, and message size rules
- route-level `429` and `503` responses for admin login and contact submission protections
- route-level `429` responses for lead submission protections
- signed token helpers
- upload restrictions
- CSV formula neutralization
- rate-limit bucket behavior
- interest form schema validation for phone, email, and message rules

Test files:

- `tests/admin-login-route.test.ts`
- `tests/contact-captcha.test.ts`
- `tests/contact-submissions-route.test.ts`
- `tests/crypto-tokens.test.ts`
- `tests/csv-security.test.ts`
- `tests/contact-seller-validation.test.ts`
- `tests/interest-form-validation.test.ts`
- `tests/leads-route.test.ts`
- `tests/rate-limit.test.ts`
- `tests/upload-security.test.ts`

## Moving to Supabase later

1. Create a Supabase project
2. Apply `data/supabase.sql`
3. Fill in the Supabase env vars
4. Swap the repository implementation from local storage to Supabase queries and storage operations
5. Replace the local admin cookie flow with Supabase Auth

## Spec references

- `specs/01_VISION.md`
- `specs/02_TECH_STACK.md`
- `specs/03_REQUIREMENTS.md`
- `specs/04_DATABASE.md`
- `specs/05_MVP_SCOPE.md`
- `specs/06_COPILOT_INSTRUCTIONS.md`
- `docs/ARCHITECTURE.md`
