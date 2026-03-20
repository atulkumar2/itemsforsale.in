# Architecture

## Overview

`itemsforsale.in` is a local-first Next.js App Router application for a single seller to publish household items, accept buyer enquiries, and manage submissions from an authenticated admin area.

This repository is a full-stack application in a single codebase. It does not split into separate `frontend/` and `backend/` folders because Next.js supports both UI rendering and server-side API handling in the same project.

The codebase is intentionally structured around replaceable boundaries:

- Next.js pages and components handle rendering and UX
- route handlers own writes, exports, and admin/session endpoints
- shared `lib/` modules hold validation, auth, security, and utility logic
- `lib/data/repository.ts` provides a stable persistence boundary
- persistence can run in local JSON mode or local PostgreSQL mode without changing page-level behavior

This keeps the app practical for local operation today while preserving a clean path to a later Supabase-backed implementation.

## How To Read This Repo

If you are new to full stack development, the most important thing to understand is that this repo still has a frontend and a backend. They are just packaged together.

### What counts as frontend here

Frontend code is the part that renders pages, forms, tables, buttons, and other UI in the browser.

Main frontend areas:

- `app/`
- `components/`

Examples:

- `app/page.tsx`
- `app/items/[slug]/page.tsx`
- `components/interest-form.tsx`
- `components/contact-seller-form.tsx`
- `components/admin/item-form.tsx`

### What counts as backend here

Backend code is the part that handles requests, validates input, checks auth, talks to storage, and returns JSON or CSV.

Main backend areas:

- `app/api/`
- server-side modules in `lib/`
- persistence code in `lib/data/`

Examples:

- `app/api/leads/route.ts`
- `app/api/contact-submissions/route.ts`
- `app/api/admin/login/route.ts`
- `lib/auth.ts`
- `lib/validation.ts`
- `lib/data/repository.ts`

### Why there is no separate backend folder

This app uses Next.js App Router, which allows:

- UI pages and components
- API endpoints
- server-side rendering
- server-only helpers

to live in one project.

That is why this codebase looks different from an older “React frontend + Express backend” tutorial. The backend exists, but it is embedded inside the Next.js app instead of running as a separate service.

### Simple mental model

Use this rule when reading files:

- if a file renders UI, it is frontend
- if a file handles requests, auth, validation, storage, or secrets, it is backend

### End-to-end example

When a buyer submits interest for an item:

1. The browser shows the form from `components/interest-form.tsx`.
2. The form sends a request to `/api/leads`.
3. `app/api/leads/route.ts` validates and processes that request.
4. `lib/data/repository.ts` chooses the active data store.
5. `lib/data/local-store.ts` or `lib/data/postgres-store.ts` writes the data.
6. The API returns a response to the browser.

That is a complete frontend-to-backend flow inside one repo.

## Goals and Constraints

### Primary goals

- publish a searchable catalogue of personal items
- collect structured interest and direct-contact enquiries
- manage items and submissions from a lightweight admin interface
- support local development without requiring cloud infrastructure
- keep the data and route shapes close to a future hosted deployment model

### Non-goals for the current phase

- multi-user seller accounts
- full RBAC or tenant isolation
- object storage/CDN-backed media
- external anti-abuse services
- distributed rate limiting or durable session storage

## Runtime Topology

At runtime, the app consists of one Next.js server process with three major responsibilities:

1. Render public and admin pages.
2. Serve API routes for writes, exports, login, and logout.
3. Read and write item, lead, contact, and image data through the repository layer.

The system also uses local filesystem storage for uploaded images in both persistence modes.

### High-level flow

```text
Browser
  -> App Router pages/components
  -> API route handlers
  -> validation/auth/security helpers in lib/
  -> repository boundary
  -> JSON store or PostgreSQL store
  -> filesystem uploads under public/uploads
```

## Layered Design

### 1. Presentation Layer

Located mainly in `app/` and `components/`.

Responsibilities:

- render public catalogue, item detail, and contact pages
- render admin dashboard, admin tables, forms, and system status views
- provide client-side form UX through React Hook Form
- submit writes to route handlers instead of talking to persistence directly
- display CSV export actions and navigation between catalogue/admin views

Representative files:

- `app/page.tsx`: public catalogue entry point
- `app/items/[slug]/page.tsx`: item details and interest flow
- `app/contact-seller/page.tsx`: server-rendered initial captcha challenge and contact form
- `app/admin/page.tsx`: admin landing view
- `app/admin/leads/page.tsx`: lead review UI
- `app/admin/contact-submissions/page.tsx`: contact submission review UI
- `app/admin/system/page.tsx`: active mode and PostgreSQL health display
- `components/contact-seller-form.tsx`: contact workflow client component
- `components/admin/item-form.tsx`: admin item create/update UI

Design choice:

- pages and components do not know whether the backing store is JSON or PostgreSQL
- they call route handlers or repository-backed server functions and stay focused on UI concerns

### 2. API Layer

Located in `app/api/`.

Responsibilities:

- accept and validate write requests
- enforce admin authentication on protected routes
- enforce abuse controls such as rate limiting and captcha verification
- build CSV export responses
- translate domain failures into HTTP responses

Current route groups:

- public writes
  - `/api/leads`
  - `/api/contact-submissions`
- public export
  - `/api/catalogue/export`
- admin auth
  - `/api/admin/login`
  - `/api/admin/logout`
- admin item management
  - `/api/admin/items`
  - `/api/admin/items/[id]`
- admin exports
  - `/api/admin/leads/export`
  - `/api/admin/contact-submissions/export`

### Route responsibilities by concern

- validation: `lib/validation.ts`
- auth/session checks: `lib/auth.ts`
- captcha issuing and verification: `lib/contact-captcha-store.ts`
- rate limiting: `lib/rate-limit.ts`
- CSV escaping and formula neutralization: `lib/csv.ts`
- upload restrictions: `lib/upload-security.ts`

### 3. Domain and Security Layer

Located in `lib/`.

This is the most important shared layer in the app. It holds business rules, validation, security helpers, and reusable utilities.

Representative modules:

- `lib/types.ts`
  - item, image, lead, and contact submission shapes
  - repository input types
- `lib/constants.ts`
  - field length limits
  - regex patterns
  - shared enums such as item status
- `lib/validation.ts`
  - Zod schemas used by both the UI and route handlers
- `lib/auth.ts`
  - signed admin session handling
  - admin page/admin API gate helpers
- `lib/crypto-tokens.ts`
  - HMAC-signed JSON token helpers
- `lib/contact-captcha.ts`
  - shared captcha answer normalization and public challenge type
- `lib/contact-captcha-store.ts`
  - private captcha question bank
  - signed challenge issuance
  - server-side answer verification
- `lib/rate-limit.ts`
  - in-memory per-IP throttling
- `lib/upload-security.ts`
  - allowed MIME types
  - file count and size checks
- `lib/csv.ts`
  - safe CSV cell serialization
- `lib/env.ts`
  - runtime configuration access
  - production auth/captcha configuration checks

### 4. Data Access Layer

Located in `lib/data/`.

This layer hides storage details from the rest of the application.

### Repository facade

`lib/data/repository.ts` is the app-facing gateway. It chooses the active store based on `DATA_MODE` and exposes stable operations such as:

- `listPublicItems`
- `getPublicItemBySlug`
- `submitLead`
- `saveAdminItem`
- `listAdminLeads`
- `submitContactSubmission`
- `listAdminContactSubmissions`
- `getAdminSystemStatus`

### Store implementations

- `lib/data/local-store.ts`
  - JSON-file-backed persistence in `data/local-db.json`
  - filesystem image writes to `public/uploads`
- `lib/data/postgres-store.ts`
  - PostgreSQL-backed CRUD for the same domain model
  - local schema bootstrapping and health checks
- `lib/data/local-seed.ts`
  - initial seed data used by local modes

Design choice:

- the rest of the app talks to the repository, not directly to `local-store` or `postgres-store`
- switching the backing store should not require page or route rewrites

## Routing Structure

### Public routes

- `/`
  - searchable catalogue
  - status/category filtering
  - CSV export entry point
- `/items/[slug]`
  - item details
  - gallery rendering
  - interest submission
- `/contact-seller`
  - direct contact form
  - initial captcha challenge bootstrap

### Admin routes

- `/admin`
  - overview/dashboard
- `/admin/items/new`
  - create item flow
- `/admin/items/[id]/edit`
  - edit and delete flow
- `/admin/leads`
  - lead review and filtering
- `/admin/contact-submissions`
  - direct-contact review
- `/admin/system`
  - runtime and PostgreSQL status
- `/admin/login`
  - admin sign-in

## Data Model

The application uses four main domain entities.

### Item

Represents a sale listing:

- identity: `id`, `slug`
- display fields: `title`, `description`, `category`, `condition`
- pricing fields: `purchasePrice`, `expectedPrice`
- availability/location fields: `availableFrom`, `locationArea`
- lifecycle fields: `status`, `createdAt`, `updatedAt`

### ItemImage

Represents an uploaded image associated with an item:

- `id`
- `itemId`
- `imageUrl`
- `sortOrder`
- `createdAt`

### Lead

Represents interest submitted from an item detail page:

- `itemId`
- buyer identity/contact fields
- free-text message
- optional bid price
- `createdAt`

### ContactSubmission

Represents direct contact intent from the contact page:

- buyer identity/contact fields
- location
- free-text message
- stored `captchaPrompt` for audit/history
- `createdAt`

### Persistence shapes

JSON mode stores:

- `items`
- `itemImages`
- `leads`
- `contactSubmissions`

PostgreSQL mode mirrors the same conceptual entities with relational tables:

- `items`
- `item_images`
- `leads`
- `contact_submissions`

## Persistence Modes

### JSON mode

Enabled when `DATA_MODE=local` or unset.

Characteristics:

- no external database required
- data stored in `data/local-db.json`
- initial seed inserted automatically
- ideal for quick local development

Tradeoffs:

- no concurrent-writer protection
- no query engine beyond in-process filtering
- not suitable for multi-instance deployment

### PostgreSQL mode

Enabled when `DATA_MODE=postgres`.

Characteristics:

- uses `DATABASE_URL`
- auto-creates schema on first use
- supports health checks surfaced in `/admin/system`
- better matches a future hosted relational deployment model

Tradeoffs:

- still uses local filesystem uploads
- still uses in-memory rate limiting and signed-cookie auth
- still assumes a single-seller application model

## Core Request Flows

### Public catalogue read flow

1. User loads `/`.
2. Server renders the catalogue shell.
3. Repository resolves items from the active store.
4. UI renders either card or table views and exposes export actions.
5. `/api/catalogue/export` can emit the same filtered result set as CSV.

### Item interest flow

1. User opens `/items/[slug]`.
2. Client-side form validates against `interestFormSchema`.
3. Request posts to `/api/leads`.
4. Server applies rate limiting.
5. Server validates the payload again.
6. Repository verifies that the item exists.
7. Repository stores the lead in the active persistence mode.
8. Admin later reviews the data in `/admin/leads`.

### Contact seller flow

1. Server renders `/contact-seller` with an initial signed captcha challenge.
2. Client submits form data plus the signed captcha token.
3. `/api/contact-submissions` verifies captcha configuration in production.
4. Server applies rate limiting.
5. Server validates the payload.
6. Server verifies the captcha token and answer against the private challenge bank.
7. Repository stores the contact submission.
8. Admin reviews the data in `/admin/contact-submissions`.

The route also supports `GET /api/contact-submissions` to issue a new captcha challenge without exposing the answer key to the client.

### Admin item management flow

1. Admin signs in through `/api/admin/login`.
2. `lib/auth.ts` validates credentials and issues a signed HTTP-only cookie.
3. Admin pages call `requireAdminPage()`.
4. Admin APIs call `ensureAdminApiAuth()`.
5. Item create/update requests go through `/api/admin/items`.
6. Item image uploads are validated for type/count/size before persistence.
7. Repository writes metadata and image records to the active store.
8. Raw image bytes are stored under `public/uploads/<itemId>/...`.

### CSV export flow

1. User or admin triggers an export route.
2. Route resolves the relevant filtered dataset.
3. `lib/csv.ts` escapes quotes and neutralizes dangerous leading formula characters.
4. Route returns a downloadable CSV with `text/csv` content type and `no-store`.

## Authentication Model

Admin authentication is intentionally lightweight but no longer deterministic.

### Current model

- credentials come from environment variables
- in development only, local defaults can be used if env vars are missing
- in production, missing admin auth env vars cause login to fail closed with `503`
- login issues a signed HTTP-only cookie
- cookie payload includes the admin email, random session ID, and expiry timestamp
- verification checks signature, expiry, and configured admin identity

### Why this design

- simpler than a full auth provider for local-first operation
- stronger than a static predictable cookie
- still easy to replace later with Supabase Auth or another hosted identity system

Limitations:

- sessions are stateless signed tokens rather than revocable server-side records
- only one admin identity is modeled

## Security Boundaries and Trust Model

### Trusted server responsibilities

- validate every write request
- guard admin-only pages and APIs
- keep captcha answers private
- sign and verify admin session tokens
- sign and verify captcha challenge tokens
- apply upload restrictions
- apply rate limiting
- sanitize CSV output for spreadsheet consumers

### Client trust assumptions

- the client is untrusted
- client-side validation exists for UX only
- any hidden field, captcha token, or file metadata can be tampered with
- route handlers must re-check everything

### Current security controls

- signed admin cookies via HMAC token signing
- server-side captcha challenge bank
- in-memory IP-based rate limiting
- MIME/type/count/size restrictions on admin uploads
- CSV formula neutralization
- production misconfiguration checks for auth/captcha

Known limitations:

- rate limiting is per-process, not distributed
- uploaded images are still served from `public/uploads`
- uploads are restricted but not re-encoded
- sessions are not backed by durable server-side storage

## File and Image Handling

Uploads are stored in the local filesystem regardless of JSON or PostgreSQL mode.

Current behavior:

- accepted formats: JPEG, PNG, WebP
- file count limit enforced per request
- per-file size limit enforced per request
- extension is derived from trusted MIME mapping, not original filename alone
- image metadata is stored separately from item metadata

This separation keeps list/detail queries simple while allowing multiple images per item.

## Runtime Status and Observability

The app currently has minimal built-in observability.

What it does expose:

- `/admin/system` shows active data mode
- `/admin/system` shows persistence type
- `/admin/system` shows upload storage type
- `/admin/system` shows PostgreSQL reachability and parsed connection target in `postgres` mode

What it does not yet include:

- structured application logs
- tracing
- metrics dashboards
- audit logs for admin actions

## Testing Strategy

The current automated coverage uses Vitest with a node test environment.

### Covered areas

- schema validation
- captcha normalization, signing, expiry, and secret mismatch handling
- token signing helpers
- upload security rules
- CSV security rules
- rate-limit state behavior
- route-level `429` and `503` responses for critical API protections

### Test categories

- pure unit tests for helpers in `lib/`
- route-level tests with mocked collaborators for API behavior

This is a good fit for the current codebase because most important logic lives in small modules and route handlers with clear dependencies.

## Migration Path

The architecture is already set up so the main future migration happens behind existing boundaries.

### Likely future migration steps

1. Replace repository internals with Supabase queries.
2. Move uploaded image storage from local filesystem to object storage.
3. Replace local admin auth with Supabase Auth or another identity layer.
4. Replace per-process rate limiting with shared infrastructure.
5. Add proper observability and audit logging.

### What should stay stable

- public routes
- admin route structure
- most page components
- Zod validation layer
- repository method surface
- domain types

That stability is the main architectural goal of the current design.
