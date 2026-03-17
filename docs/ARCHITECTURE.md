# Architecture

## Overview

itemsforsale.in is a local-first Next.js application for a single seller to publish household items, collect buyer interest, and manage enquiries from an admin interface.

The app is designed around a simple layered architecture:

- App Router pages for public and admin screens
- Reusable UI components for rendering forms, cards, tables, and layout
- Route handlers for writes and exports
- Shared validation and utility modules
- A repository boundary that can use local JSON or local PostgreSQL before later moving to Supabase

## High-Level Layers

### 1. Presentation layer

Located mainly in `app/` and `components/`.

Responsibilities:

- render public catalogue and item detail pages
- render admin dashboard and admin data views
- handle client-side form interactions
- expose grid/table switching and CSV export actions

Examples:

- `app/page.tsx`: homepage catalogue and seller location section
- `app/items/[slug]/page.tsx`: item detail page
- `app/contact-seller/page.tsx`: direct contact page with captcha gate
- `app/admin/page.tsx`: admin dashboard
- `components/catalogue-view.tsx`: grid/table toggle and export button
- `components/contact-seller-form.tsx`: validated contact form

### 2. API layer

Located in `app/api/`.

Responsibilities:

- accept validated writes from forms
- protect admin-only export endpoints
- transform persisted data into downloadable CSV responses

Current route handlers:

- `/api/leads`: saves item interest submissions
- `/api/contact-submissions`: saves contact seller submissions after captcha validation
- `/api/catalogue/export`: exports filtered catalogue rows with item links
- `/api/admin/leads/export`: exports filtered leads as CSV
- `/api/admin/contact-submissions/export`: exports contact submission logs as CSV
- `/api/admin/items/*`: admin item create/update/delete flows
- `/api/admin/login` and `/api/admin/logout`: local admin session lifecycle

### 3. Domain and validation layer

Located in `lib/`.

Responsibilities:

- define shared types
- validate request payloads
- centralize constants and formatting helpers
- encapsulate captcha logic

Important modules:

- `lib/types.ts`: core domain types and persistence shapes
- `lib/validation.ts`: Zod schemas for forms and API payloads
- `lib/constants.ts`: shared enums, max lengths, and regex patterns
- `lib/contact-captcha.ts`: captcha answer validation
- `lib/contact-captcha-questions.ts`: editable question bank
- `lib/utils.ts`: formatting and parsing helpers

### 4. Data access layer

Located in `lib/data/`.

Responsibilities:

- provide a stable repository interface to the app
- isolate the local JSON implementation from page and API code
- preserve a future migration path to Supabase

Important modules:

- `lib/data/repository.ts`: app-facing data access interface
- `lib/data/local-store.ts`: file-backed CRUD implementation
- `lib/data/postgres-store.ts`: PostgreSQL-backed CRUD implementation for local database mode
- `lib/data/local-seed.ts`: initial seeded dataset

## Routing Structure

### Public routes

- `/`: homepage with search, filters, catalogue view toggle, and seller map
- `/items/[slug]`: item detail page with images and interest form
- `/contact-seller`: direct contact page with captcha verification

### Admin routes

- `/admin`: dashboard and inventory overview
- `/admin/items/new`: create item
- `/admin/items/[id]/edit`: edit item
- `/admin/leads`: filter and review buyer interest submissions
- `/admin/contact-submissions`: review direct contact submissions
- `/admin/system`: runtime mode and PostgreSQL health details
- `/admin/login`: admin authentication

### Export routes

- `/api/catalogue/export`: public CSV export for filtered catalogue data
- `/api/admin/leads/export`: admin CSV export for filtered leads
- `/api/admin/contact-submissions/export`: admin CSV export for contact logs

## Data Model

The runtime persistence model supports two local modes:

- JSON mode via `data/local-db.json`
- PostgreSQL mode via `DATABASE_URL` when `DATA_MODE=postgres`

Top-level collections:

- `items`
- `itemImages`
- `leads`
- `contactSubmissions`

Both local modes mirror the intended cloud-ready structure so they can later be replaced by Supabase-backed queries without changing page-level behavior.

## Request and Write Flows

### Item interest flow

1. User opens an item detail page.
2. User submits the interest form.
3. Client validates input through React Hook Form + Zod.
4. `/api/leads` re-validates on the server.
5. Repository writes a new lead into local storage.
6. Admin can review submissions under `/admin/leads`.

In `postgres` mode, the same repository flow writes the lead into the local PostgreSQL database instead.

### Lead management flow

1. Admin opens `/admin/leads`.
2. Admin filters by `itemId` and/or text query.
3. Repository resolves filtered leads in active data mode.
4. Admin can export filtered leads using `/api/admin/leads/export`.
5. Admin inventory table shows per-item lead counts and item-specific lead shortcuts.

### Contact seller flow

1. User opens `/contact-seller`.
2. User fills in name, phone, email, location, message, and captcha.
3. Client validates against shared schema rules.
4. `/api/contact-submissions` validates again on the server.
5. Captcha answer is verified using the shared captcha module.
6. Submission is stored in `contactSubmissions`.
7. Admin can review logs or export them as CSV.

In `postgres` mode, the submission is stored in the `contact_submissions` table instead.

### Catalogue export flow

1. User filters catalogue on the homepage.
2. Export button preserves current search parameters.
3. `/api/catalogue/export` fetches the same filtered items.
4. Route handler emits CSV rows including direct `itemLink` URLs.

## Authentication Model

Current admin authentication is local and cookie-based.

- credentials come from `.env.local`
- login issues an HTTP-only cookie
- admin pages use `requireAdminPage()`
- admin APIs use `ensureAdminApiAuth()`

This is intentionally simple for local-first operation and can later be replaced with Supabase Auth.

## Validation Strategy

Validation is enforced in two places:

- frontend: immediate UX feedback through React Hook Form + Zod
- backend: final protection in API route handlers using the same schema layer

Examples:

- contact phone must be exactly 10 digits and start with 6, 7, 8, or 9
- contact email must pass regex validation
- contact field lengths are driven from shared constants
- captcha answer is validated both structurally and semantically

## File and Image Handling

Uploaded item images are stored in `public/uploads/<itemId>/...`.

The item record and image metadata are stored separately:

- item metadata lives in `items`
- image metadata lives in `itemImages`

At read time, `hydrateItems()` joins items and images into `ItemWithImages` objects for rendering.

## Testing Strategy

Current automated coverage uses Vitest for unit tests.

Covered areas:

- captcha normalization and answer validation
- contact form validation rules
- interest form validation rules

Test files:

- `tests/contact-captcha.test.ts`
- `tests/contact-seller-validation.test.ts`
- `tests/interest-form-validation.test.ts`

## Migration Path

The main architectural boundary that enables future migration is `lib/data/repository.ts`.

To move to Supabase later:

1. keep route handlers and page components unchanged where possible
2. replace local-store-backed repository calls with Supabase queries
	or replace postgres-store-backed local queries with Supabase queries
3. move image storage from `public/uploads` to Supabase Storage
4. replace local cookie auth with Supabase Auth

This keeps the UI and domain logic stable while changing only the persistence and auth implementations.