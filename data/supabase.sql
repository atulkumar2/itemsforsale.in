-- Enable extensions
create extension if not exists pgcrypto;

-- Status check can also be an enum, but varchar + check keeps iteration easier in MVP
-- NOTE: ID and timestamp defaults are intentionally omitted so the app controls generation.
-- This ensures consistent behavior across local, postgres, and Supabase modes.
create table if not exists public.items (
  id uuid primary key,
  slug varchar(220) not null unique check (char_length(slug) <= 220),
  title varchar(200) not null check (char_length(title) between 3 and 200),
  description varchar(5000) check (description is null or char_length(description) <= 5000),
  category varchar(80) check (category is null or char_length(category) <= 80),
  condition varchar(80) check (condition is null or char_length(condition) <= 80),
  purchase_date date,
  purchase_price numeric(12,2),
  expected_price numeric(12,2),
  available_from date,
  location_area varchar(120) check (location_area is null or char_length(location_area) <= 120),
  status varchar(20) not null check (status in ('available', 'reserved', 'sold')),
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists public.item_images (
  id uuid primary key,
  item_id uuid not null references public.items(id) on delete cascade,
  image_url varchar(500) not null check (char_length(image_url) <= 500),
  sort_order int not null default 0,
  created_at timestamptz not null
);

create table if not exists public.leads (
  id uuid primary key,
  item_id uuid not null references public.items(id) on delete cascade,
  buyer_name varchar(80) not null check (char_length(buyer_name) between 2 and 80),
  phone varchar(10) check (phone is null or char_length(phone) = 10),
  email varchar(160) check (email is null or char_length(email) <= 160),
  message varchar(1000) check (message is null or char_length(message) <= 1000),
  bid_price numeric(12,2),
  created_at timestamptz not null
);

create table if not exists public.contact_submissions (
  id uuid primary key,
  buyer_name varchar(80) not null check (char_length(buyer_name) between 2 and 80),
  phone varchar(10) check (phone is null or char_length(phone) = 10),
  email varchar(160) check (email is null or char_length(email) <= 160),
  location varchar(100) check (location is null or char_length(location) <= 100),
  message varchar(1200) not null check (char_length(message) between 10 and 1200),
  captcha_prompt varchar(160) not null check (char_length(captcha_prompt) <= 160),
  created_at timestamptz not null
);

create index if not exists idx_items_status on public.items(status);
create index if not exists idx_items_category on public.items(category);
create index if not exists idx_leads_item_id on public.leads(item_id);
create index if not exists idx_item_images_item_id on public.item_images(item_id);
create index if not exists idx_contact_submissions_created_at on public.contact_submissions(created_at desc);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_items_updated_at on public.items;
create trigger trg_items_updated_at
before update on public.items
for each row
execute function public.set_updated_at();

-- RLS
alter table public.items enable row level security;
alter table public.item_images enable row level security;
alter table public.leads enable row level security;
alter table public.contact_submissions enable row level security;

-- Public read access (no status filtering at RLS level; app enforces filtering if needed)
drop policy if exists "Public can read items" on public.items;
create policy "Public can read items"
on public.items
for select
to anon, authenticated
using (true);

-- Public can read images for any item (foreign key ensures valid item_id)
drop policy if exists "Public can read images for public items" on public.item_images;
create policy "Public can read images for public items"
on public.item_images
for select
to anon, authenticated
using (true);

-- Public can submit leads
drop policy if exists "Public can create leads" on public.leads;
create policy "Public can create leads"
on public.leads
for insert
to anon, authenticated
with check (true);

drop policy if exists "Public can create contact submissions" on public.contact_submissions;
create policy "Public can create contact submissions"
on public.contact_submissions
for insert
to anon, authenticated
with check (true);

-- IMPORTANT: Admin access is restricted to service_role key usage only.
-- Set RLS-enforcing policies to disable direct authenticated user access to admin tables.
-- All admin mutations (item CRUD, lead/submission management) must use service_role key
-- from secure server actions, never anon or user-authenticated access.
drop policy if exists "Only service_role can manage items" on public.items;
create policy "Only service_role can manage items"
on public.items
for all
using (false)
with check (false);

drop policy if exists "Only service_role can manage item_images" on public.item_images;
create policy "Only service_role can manage item_images"
on public.item_images
for all
using (false)
with check (false);

drop policy if exists "Only service_role can manage leads" on public.leads;
create policy "Only service_role can manage leads"
on public.leads
for all
using (false)
with check (false);

drop policy if exists "Only service_role can manage contact_submissions" on public.contact_submissions;
create policy "Only service_role can manage contact_submissions"
on public.contact_submissions
for all
using (false)
with check (false);
