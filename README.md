# itemsforsale.in

A local-first personal item selling board built with Next.js, TypeScript, Tailwind CSS, and a Supabase-ready data model.

## Current implementation

The app now runs fully in local mode without cloud infrastructure:

- public catalogue with search and filters
- catalogue export to CSV with item links
- item detail page with gallery and interest form
- stricter public interest form validation (phone, email, message)
- dedicated contact seller page with captcha and validation
- admin login with local cookie session
- admin CRUD for items
- admin leads page with filtering and CSV export
- inventory quick links to item-specific leads and per-item lead counts
- admin contact submissions log with CSV export
- admin system status page for data mode and PostgreSQL connectivity
- local photo upload to `public/uploads`
- data can run in JSON mode or local PostgreSQL mode
- lead and contact submission capture stored in `data/local-db.json` or PostgreSQL depending on `DATA_MODE`

This keeps the project testable before moving the same shape to Supabase.

## Local setup

1. Copy `.env.example` to `.env.local`
2. Adjust the admin credentials if needed
3. Install dependencies with `npm install`
4. Start the app with `npm run dev`
5. Open `http://localhost:3000`

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
- admin login defaults come from `.env.local`
- uploaded images are written to `public/uploads`

## Local PostgreSQL mode

The app already uses local filesystem storage for uploaded images. If you want a local database closer to the future Supabase model before switching to Supabase, use PostgreSQL mode.

1. Start PostgreSQL with Docker Compose:

```bash
npm run db:up
```

2. Copy `.env.example` to `.env.local` if not already done
3. Set `DATA_MODE=postgres`
4. Set `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/itemsforsale`
5. Optional: initialize schema manually with:

```bash
psql postgresql://postgres:postgres@localhost:5432/itemsforsale -f postgres.local.sql
```

6. Optional: import your existing JSON data into PostgreSQL:

```bash
npm run db:import
```

Useful commands:

```bash
npm run db:up
npm run db:down
npm run db:logs
```

Notes:

- the app auto-creates tables on first request in `postgres` mode
- seed data is inserted automatically if the `items` table is empty
- uploaded images still remain in `public/uploads`
- switching back to `DATA_MODE=local` returns to JSON-backed storage
- Docker Compose file: `docker-compose.yml`
- JSON import script: `scripts/import-json-to-postgres.mjs`

## Testing

- Run all tests: `npm run test`
- Run tests in watch mode: `npm run test:watch`

Current unit tests cover:

- captcha answer normalization and validation
- contact seller schema validation for phone, email, and message size rules
- interest form schema validation for phone, email, and message rules

Test files:

- `tests/contact-captcha.test.ts`
- `tests/contact-seller-validation.test.ts`
- `tests/interest-form-validation.test.ts`

## Moving to Supabase later

1. Create a Supabase project
2. Apply `supabase.sql`
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
