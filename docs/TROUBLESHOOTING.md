# Troubleshooting

## Table of Contents

- [Troubleshooting](#troubleshooting)
  - [Table of Contents](#table-of-contents)
  - [Linux: OS file watch limit reached / ENOSPC](#linux-os-file-watch-limit-reached--enospc)
    - [Quick fix (current session)](#quick-fix-current-session)
    - [Persistent fix (recommended)](#persistent-fix-recommended)
    - [Verify values](#verify-values)
    - [Dev scripts in this repo](#dev-scripts-in-this-repo)
  - [Local PostgreSQL mode issues](#local-postgresql-mode-issues)
    - [PostgreSQL unreachable in admin system status](#postgresql-unreachable-in-admin-system-status)
    - [Tables missing in local PostgreSQL](#tables-missing-in-local-postgresql)
    - [Existing JSON data not visible after switching to postgres mode](#existing-json-data-not-visible-after-switching-to-postgres-mode)
    - [Docker container cleanup/reset](#docker-container-cleanupreset)

## Linux: OS file watch limit reached / ENOSPC

Symptoms while running development server:

- `OS file watch limit reached`
- `ENOSPC: System limit for number of file watchers reached`

### Quick fix (current session)

```bash
sudo sysctl fs.inotify.max_user_watches=524288
sudo sysctl fs.inotify.max_user_instances=1024
```

### Persistent fix (recommended)

Create a sysctl config file:

```bash
printf "fs.inotify.max_user_watches=524288\nfs.inotify.max_user_instances=1024\n" | sudo tee /etc/sysctl.d/99-itemsforsale-inotify.conf
sudo sysctl --system
```

### Verify values

```bash
sysctl fs.inotify.max_user_watches
sysctl fs.inotify.max_user_instances
```

### Dev scripts in this repo

- `npm run dev`: webpack + polling (safe default on constrained Linux hosts)
- `npm run dev:webpack`: webpack without polling
- `npm run dev:turbo`: Turbopack

If your machine still has watcher pressure from other apps, keep using `npm run dev`.

## Local PostgreSQL mode issues

### PostgreSQL unreachable in admin system status

Symptoms:

- `/admin/system` shows PostgreSQL as unavailable
- data mode is set to `postgres` but pages fail to load data

Checks:

```bash
npm run db:up
npm run db:logs
```

Confirm environment values in `.env.local`:

```dotenv
DATA_MODE=postgres
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/itemsforsale
```

### Tables missing in local PostgreSQL

The app auto-creates tables on first request in postgres mode, but you can also initialize manually:

```bash
psql postgresql://postgres:postgres@localhost:5432/itemsforsale -f data/postgres.local.sql
```

### Existing JSON data not visible after switching to postgres mode

Import current JSON data:

```bash
npm run db:import
```

### Docker container cleanup/reset

Stop services:

```bash
npm run db:down
```

If you need a full reset including stored PostgreSQL volume:

```bash
docker compose down -v
npm run db:up
npm run db:import
```
