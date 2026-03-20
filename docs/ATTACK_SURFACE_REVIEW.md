# Attack Surface Review

## Table of Contents

- [Purpose](#purpose)
- [What an attacker wants](#what-an-attacker-wants)
- [Main entry points](#main-entry-points)
- [Attack surface by area](#attack-surface-by-area)
- [1. Public form abuse](#1-public-form-abuse)
- [2. Admin login attacks](#2-admin-login-attacks)
- [3. Admin upload abuse](#3-admin-upload-abuse)
- [4. CSV export abuse](#4-csv-export-abuse)
- [5. Environment and deployment misconfiguration](#5-environment-and-deployment-misconfiguration)
- [6. Supabase policy mistakes](#6-supabase-policy-mistakes)
- [7. Session and cookie attacks](#7-session-and-cookie-attacks)
- [8. Denial of service and resource exhaustion](#8-denial-of-service-and-resource-exhaustion)
- [Attacker profiles](#attacker-profiles)
- [Current security posture summary](#current-security-posture-summary)
- [Highest-priority remaining work before Supabase + Vercel](#highest-priority-remaining-work-before-supabase--vercel)
- [Practical checklist before launch](#practical-checklist-before-launch)
- [Related documents](#related-documents)

## Purpose

This document explains how someone might realistically try to attack `itemsforsale.in`, what parts of the system are exposed, what defenses already exist, and what still needs hardening before a public Supabase + Vercel deployment.

It is written as a practical threat-modeling document, not as a penetration test report.

## What an attacker wants

For this application, the main attacker goals are usually:

- spam or abuse public forms
- gain admin access
- upload malicious content
- steal or tamper with stored data
- cause service disruption
- abuse cloud resources after deployment

Because this is a single-seller app, the most valuable target is the admin path. The most exposed targets are the public forms.

## Main entry points

The current public and protected entry points are:

### Public browser pages

- `/`
- `/about-seller`
- `/show-interest`
- `/items/[slug]`
- `/contact-seller`

These mostly expose rendered data, but they also lead users into form submission paths.

### Public API routes

- `/api/leads`
- `/api/bulk-leads`
- `/api/contact-submissions`
- `/api/human-check`
- `/api/catalogue/export`

These are the first places a bot or attacker would send automated traffic.

### Admin-facing routes

- `/admin/login`
- `/admin`
- `/admin/items/new`
- `/admin/items/[id]/edit`
- `/admin/leads`
- `/admin/contact-submissions`
- `/admin/system`

### Admin API routes

- `/api/admin/login`
- `/api/admin/logout`
- `/api/admin/items`
- `/api/admin/items/[id]`
- `/api/admin/leads/export`
- `/api/admin/contact-submissions/export`

### Infrastructure and configuration entry points

- environment variables
- Supabase database and storage configuration
- Supabase Row Level Security policies
- Vercel project settings

When moving to production, misconfiguration becomes part of the attack surface.

## Attack surface by area

## 1. Public form abuse

### What an attacker would try

- submit thousands of lead requests
- submit thousands of multi-item lead requests
- submit thousands of contact requests
- bypass client-side validation by sending raw HTTP requests
- send very large payloads to consume CPU/memory
- probe validation messages to learn server behavior

### Why this area matters

Public form endpoints are open to the internet and easy to automate. They are usually the first thing spam bots hit.

### Current exposed routes

- [`app/api/leads/route.ts`](/E:/ws-ifs/itemsforsale.in/app/api/leads/route.ts)
- [`app/api/bulk-leads/route.ts`](/E:/ws-ifs/itemsforsale.in/app/api/bulk-leads/route.ts)
- [`app/api/contact-submissions/route.ts`](/E:/ws-ifs/itemsforsale.in/app/api/contact-submissions/route.ts)

### Current defenses

- server-side Zod validation in [`lib/validation.ts`](/E:/ws-ifs/itemsforsale.in/lib/validation.ts)
- in-memory IP-based rate limiting in [`lib/rate-limit.ts`](/E:/ws-ifs/itemsforsale.in/lib/rate-limit.ts)
- server-issued signed captcha challenges in [`lib/contact-captcha-store.ts`](/E:/ws-ifs/itemsforsale.in/lib/contact-captcha-store.ts)

### Remaining gaps

- rate limiting is per-process memory only
- attackers can rotate IPs
- there is no external bot protection such as Turnstile/reCAPTCHA/hCaptcha
- there is no queueing or moderation layer for suspicious submissions

### Production priority

High.

Before public launch, you should assume these routes will be hit by spam and scripted traffic.

## 2. Admin login attacks

### What an attacker would try

- brute-force the admin password
- credential stuffing with leaked email/password combos
- replay or forge session cookies
- exploit weak or missing production secrets

### Current exposed route

- [`app/api/admin/login/route.ts`](/E:/ws-ifs/itemsforsale.in/app/api/admin/login/route.ts)

### Current defenses

- signed HTTP-only admin cookie in [`lib/auth.ts`](/E:/ws-ifs/itemsforsale.in/lib/auth.ts)
- production fail-closed behavior for missing admin auth config in [`lib/env.ts`](/E:/ws-ifs/itemsforsale.in/lib/env.ts)
- IP-based login throttling in [`lib/rate-limit.ts`](/E:/ws-ifs/itemsforsale.in/lib/rate-limit.ts)

### Remaining gaps

- only one admin identity exists
- auth is still custom rather than using a mature auth provider
- rate limiting is not distributed across instances
- there is no MFA
- there is no audit trail for admin logins

### Production priority

Very high.

If admin access is compromised, the attacker can upload content, inspect leads, inspect contact submissions, and manipulate inventory.

## 3. Admin upload abuse

### What an attacker would try

- upload HTML, SVG, or script-like content
- upload oversized files to exhaust memory or disk
- upload many files at once
- abuse image hosting from your domain for phishing or content spoofing

### Current exposed route

- [`app/api/admin/items/route.ts`](/E:/ws-ifs/itemsforsale.in/app/api/admin/items/route.ts)

### Current defenses

- admin-only access check
- upload MIME allowlist in [`lib/upload-security.ts`](/E:/ws-ifs/itemsforsale.in/lib/upload-security.ts)
- per-request file count limit
- per-file size limit
- trusted extension mapping from MIME type
- server-side image re-encoding and thumbnail generation

### Remaining gaps

- uploads are not virus-scanned
- optimized image bytes are still served from `public/uploads`
- there is still no malware scanning or separate object-storage isolation

### Production priority

Medium to high.

The route is admin-only, which lowers exposure, but upload handling remains a classic security hotspot.

## 4. CSV export abuse

### What an attacker would try

- submit malicious spreadsheet formulas in lead or contact fields
- wait for an admin to export and open the CSV
- trigger outbound requests, misleading values, or spreadsheet payload execution

### Current exposed routes

- [`app/api/catalogue/export/route.ts`](/E:/ws-ifs/itemsforsale.in/app/api/catalogue/export/route.ts)
- [`app/api/admin/leads/export/route.ts`](/E:/ws-ifs/itemsforsale.in/app/api/admin/leads/export/route.ts)
- [`app/api/admin/contact-submissions/export/route.ts`](/E:/ws-ifs/itemsforsale.in/app/api/admin/contact-submissions/export/route.ts)

### Current defenses

- CSV escaping and formula neutralization in [`lib/csv.ts`](/E:/ws-ifs/itemsforsale.in/lib/csv.ts)
- public catalogue export throttling and filter validation in [`app/api/catalogue/export/route.ts`](/E:/ws-ifs/itemsforsale.in/app/api/catalogue/export/route.ts)

### Remaining gaps

- admins still need to treat exported files as untrusted data
- CSV exports remain a downstream risk if future code bypasses the shared serializer

### Production priority

Medium.

This is no longer one of the highest-risk issues, but the defense needs to stay in place.

## 5. Environment and deployment misconfiguration

### What an attacker would try

- exploit missing secrets
- abuse weak admin credentials
- obtain exposed service role keys
- inspect accidentally exposed environment variables in logs or client bundles

### Sensitive configuration values

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`
- `CONTACT_CAPTCHA_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Current defenses

- production checks for required admin auth config
- server-only usage patterns for privileged credentials

### Remaining gaps

- no dedicated deployment checklist enforcement exists in code
- `.env.example` is currently missing, which increases setup drift risk
- human error during Vercel setup is still a real threat

### Production priority

Very high.

Many production incidents are misconfiguration problems, not code exploits.

## 6. Supabase policy mistakes

This becomes important as soon as you move off local storage.

### What an attacker would try

- read or write rows through weak RLS policies
- access storage objects they should not access
- exploit client-side access with an overly permissive anon role
- abuse a leaked service role key

### Likely target areas after migration

- `items`
- `item_images`
- `leads`
- `contact_submissions`
- storage bucket for item images

### Required mindset

- the anon key is public by design
- the service role key must never reach the browser
- RLS must be correct even if a user directly calls Supabase APIs outside your app

### Production priority

Critical for Supabase mode.

This is one of the main new risks introduced by the migration.

## 7. Session and cookie attacks

### What an attacker would try

- steal admin cookies through another vulnerability
- replay stolen session tokens
- exploit insecure deployment settings

### Current defenses

- HTTP-only cookies
- `sameSite=lax`
- `secure` in production
- signed session token verification

### Remaining gaps

- no server-side session revocation store
- no admin session management UI
- if a cookie is stolen, replay remains possible until expiry

### Production priority

Medium to high.

The current model is reasonable for a small app, but not equivalent to a full auth platform.

## 8. Denial of service and resource exhaustion

### What an attacker would try

- flood public routes
- force repeated export generation
- send large request bodies
- create high database/storage usage in cloud mode

### Current defenses

- basic rate limiting
- upload count and size limits
- public export throttling

### Remaining gaps

- no edge-based or provider-based request throttling
- no caching strategy for heavy traffic scenarios
- no durable abuse controls shared across instances

### Production priority

Medium.

This matters more after public deployment than during local development.

## Attacker profiles

The most realistic attacker profiles for this app are:

### Low-skill spammer

Tools:

- browser automation
- simple scripts
- curl/Postman

Likely targets:

- `/api/leads`
- `/api/bulk-leads`
- `/api/contact-submissions`

### Opportunistic internet scanner

Tools:

- generic web scanners
- wordlists
- botnets

Likely targets:

- `/api/admin/login`
- exposed admin routes
- weak deployment config

### More capable attacker

Tools:

- custom scripts
- direct API calls
- cloud misconfiguration probing

Likely targets:

- Supabase RLS mistakes
- leaked service keys
- storage bucket permissions
- admin session weaknesses

## Current security posture summary

Compared with the earlier review, the app is in a better place now because it has:

- fail-closed production admin auth config
- signed admin sessions instead of deterministic cookies
- server-side captcha issuance and verification
- upload type/count/size restrictions plus server-side re-encoding
- CSV formula neutralization
- route-level abuse throttling, including public catalogue export

That said, this is still not “hardened SaaS” security. It is a small full-stack app with sensible first-layer controls.

## Highest-priority remaining work before Supabase + Vercel

### 1. Implement secure Supabase mode

- add a real Supabase store
- keep `SUPABASE_SERVICE_ROLE_KEY` server-side only
- use strict RLS policies
- separate public and admin capabilities carefully

### 2. Move uploads to controlled cloud storage

- use Supabase Storage for production
- avoid relying on ephemeral filesystem storage in Vercel
- consider generating safe URLs rather than writing to `public/uploads`

### 3. Improve anti-abuse controls

- consider Cloudflare Turnstile or similar
- move from in-memory throttling to a shared rate-limit backend
- add alerting or logging for repeated abuse

### 4. Tighten admin security

- use a strong unique admin password
- consider moving admin auth to Supabase Auth or another managed identity provider
- consider MFA if this becomes a real production system

### 5. Add deployment guardrails

- restore or create `.env.example`
- document exact Vercel and Supabase settings
- verify all production secrets before first deploy

## Practical checklist before launch

- confirm all required production env vars are set
- verify admin login returns `503` if secrets are missing in a non-production test environment
- implement Supabase RLS before exposing Supabase mode publicly
- verify storage bucket permissions
- verify service role key is never used in client code
- test public form abuse scenarios
- test repeated login attempts
- test CSV exports with attacker-controlled strings
- test admin upload rejection for bad file types and oversized files

## Related documents

- [`docs/security-review-20260320-090536.md`](/E:/ws-ifs/itemsforsale.in/docs/security-review-20260320-090536.md)
- [`docs/ARCHITECTURE.md`](/E:/ws-ifs/itemsforsale.in/docs/ARCHITECTURE.md)
- [`docs/SUPABASE_VERCEL_MIGRATION.md`](/E:/ws-ifs/itemsforsale.in/docs/SUPABASE_VERCEL_MIGRATION.md)
