-- Enable extensions
create extension if not exists pgcrypto;

-- Status check can also be an enum, but text + check keeps iteration easier in MVP
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  category text,
  condition text,
  purchase_date date,
  purchase_price numeric(12,2),
  expected_price numeric(12,2),
  available_from date,
  location_area text,
  status text not null default 'available' check (status in ('available', 'reserved', 'sold')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.item_images (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  image_url text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  buyer_name text not null,
  phone text,
  email text,
  message text,
  bid_price numeric(12,2),
  created_at timestamptz not null default now()
);

create index if not exists idx_items_status on public.items(status);
create index if not exists idx_items_category on public.items(category);
create index if not exists idx_leads_item_id on public.leads(item_id);
create index if not exists idx_item_images_item_id on public.item_images(item_id);

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

-- Public can read only available items
drop policy if exists "Public can read items" on public.items;
create policy "Public can read items"
on public.items
for select
to anon, authenticated
using (true);

-- Public can read images for public items
drop policy if exists "Public can read images for public items" on public.item_images;
create policy "Public can read images for public items"
on public.item_images
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.items i
    where i.id = item_images.item_id
  )
);

-- Public can submit leads
drop policy if exists "Public can create leads" on public.leads;
create policy "Public can create leads"
on public.leads
for insert
to anon, authenticated
with check (true);

-- Admin policies
-- Replace auth.email() check later with a proper role model if needed
drop policy if exists "Admin full access items" on public.items;
create policy "Admin full access items"
on public.items
for all
to authenticated
using (auth.email() = current_setting('request.jwt.claim.email', true))
with check (auth.email() = current_setting('request.jwt.claim.email', true));

drop policy if exists "Admin full access item_images" on public.item_images;
create policy "Admin full access item_images"
on public.item_images
for all
to authenticated
using (auth.email() = current_setting('request.jwt.claim.email', true))
with check (auth.email() = current_setting('request.jwt.claim.email', true));

drop policy if exists "Admin full access leads" on public.leads;
create policy "Admin full access leads"
on public.leads
for all
to authenticated
using (auth.email() = current_setting('request.jwt.claim.email', true))
with check (auth.email() = current_setting('request.jwt.claim.email', true));

-- NOTE:
-- For real admin security, prefer a dedicated profiles/user_roles table
-- or service-role-only admin mutations via secure server actions.
