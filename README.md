# itemsforsale.in

A local-first personal item selling board built with Next.js, TypeScript, Tailwind CSS, and a Supabase-ready data model.

## Current implementation

The app now runs fully in local mode without cloud infrastructure:

- public catalogue with search and filters
- item detail page with gallery and interest form
- admin login with local cookie session
- admin CRUD for items
- local photo upload to `public/uploads`
- lead capture stored in `data/local-db.json`

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
