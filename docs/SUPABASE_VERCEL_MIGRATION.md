# Supabase + Vercel Migration Runbook

This checklist is for moving the app from local/local-postgres mode to Supabase + Vercel.

## Goal

- Use Supabase as primary database backend
- Deploy production app on Vercel
- Keep local fallback available while migrating

## Preflight (Before Starting)

1. Confirm local app is healthy:
   - `npm test`
   - `npm run build`
2. Confirm Supabase project is created
3. Keep these values ready from Supabase project settings:
   - Project URL
   - Anon key
   - Service role key
4. Ensure you have repository write access for code changes and Vercel project access

## Step 1: Prepare Supabase Database

1. Open Supabase SQL Editor
2. Run schema from `data/supabase.sql`
3. Verify tables exist:
   - `items`
   - `item_images`
   - `leads`
   - `contact_submissions`

Verification query:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('items', 'item_images', 'leads', 'contact_submissions')
order by table_name;
```

## Step 2: Move Existing Data

Use either CSV import from Supabase UI or SQL copy/import method.

Recommended load order:

1. `items`
2. `item_images`
3. `leads`
4. `contact_submissions`

Post-import verification query:

```sql
select
  (select count(*) from public.items) as items_count,
  (select count(*) from public.item_images) as item_images_count,
  (select count(*) from public.leads) as leads_count,
  (select count(*) from public.contact_submissions) as contact_submissions_count;
```

## Step 3: Add Supabase Runtime Mode in App

Current repository switching is local/postgres only. Add supabase mode.

Code tasks:

1. Update mode handling in `lib/env.ts`
   - Allow `DATA_MODE=supabase`
2. Add supabase data store module (for example `lib/data/supabase-store.ts`)
   - Implement same methods currently used in repository
3. Update `lib/data/repository.ts`
   - Route calls to supabase store when `DATA_MODE=supabase`
4. Keep public/admin page components unchanged where possible

Minimum methods to implement in supabase store:

- list/get items
- save/delete item
- list categories
- create/list leads
- create/list contact submissions
- admin summary/system checks as needed

## Step 4: Image Storage Migration

Current uploads are filesystem-based. For cloud deployment, move item images to Supabase Storage.

1. Create Supabase bucket (for example `item-images`)
2. Upload new images to storage bucket from server code
3. Save storage public URL/path in `item_images.image_url`
4. Keep local filesystem upload behavior for non-supabase modes

## Step 5: Set Environment Variables

### Local `.env.local` (for testing supabase mode)

```env
DATA_MODE=supabase
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SITE_NAME=itemsforsale.in
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ADMIN_EMAIL=...
ADMIN_PASSWORD=...
ADMIN_SESSION_SECRET=...
```

### Vercel Project Environment Variables

Set the same values in Vercel for Production (and Preview if required):

- `DATA_MODE`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SITE_NAME`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`

## Step 6: Deploy to Vercel

1. Push migration code to main branch
2. Trigger Vercel deployment
3. After deployment, run smoke tests

Production smoke tests:

1. Home page loads
2. Search/filter works
3. Item details load
4. Interest form submit works
5. Contact form submit works
6. Admin login works
7. Admin item CRUD works
8. Admin leads/contact submissions pages load
9. CSV export endpoints work

## Step 7: Security Follow-up (Do Not Skip)

1. Review RLS policies in Supabase for admin operations
2. Ensure service role key is used server-side only
3. Rotate keys if any accidental exposure occurred
4. Restrict admin access model (recommended: explicit admin roles)

## Tomorrow Quick Checklist

1. Run `data/supabase.sql` in Supabase
2. Import current data and verify counts
3. Add supabase store + repository branch
4. Move uploads to Supabase Storage path for supabase mode
5. Set env vars locally and test
6. Deploy to Vercel with env vars
7. Run production smoke tests
8. Lock down RLS/admin security

## Rollback Plan

If deployment has issues:

1. Set `DATA_MODE=postgres` in Vercel env
2. Redeploy previous stable commit
3. Keep Supabase data intact for next attempt
