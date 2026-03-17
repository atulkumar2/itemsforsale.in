# Tech Stack

Frontend

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS v4
- Custom reusable UI components (no mandatory UI kit dependency)

Backend

- Next.js route handlers

Validation and forms

- Zod
- React Hook Form

Data and storage

- Local-first JSON persistence (`data/local-db.json`) for development and launch simplicity
- Optional local PostgreSQL persistence (`DATA_MODE=postgres`, `DATABASE_URL`) for pre-Supabase workflows
- Local image storage in `public/uploads`
- Supabase-ready schema for later migration (Postgres + Storage)

Auth

- Local admin cookie session currently
- Designed to be replaceable with Supabase Auth later

Testing

- Vitest unit tests for key validation and captcha logic
- Interest form validation tests

Hosting and deployment

- Vercel-friendly
- Domain: itemsforsale.in

Rules

- No payments
- No buyer login
- No multi-seller model
- No chat system
- No notification pipeline
- Keep local development fully usable before cloud migration
