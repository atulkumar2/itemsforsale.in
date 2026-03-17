create table if not exists items (
  id uuid primary key,
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
  status text not null check (status in ('available', 'reserved', 'sold')),
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists item_images (
  id uuid primary key,
  item_id uuid not null references items(id) on delete cascade,
  image_url text not null,
  sort_order int not null default 0,
  created_at timestamptz not null
);

create table if not exists leads (
  id uuid primary key,
  item_id uuid not null references items(id) on delete cascade,
  buyer_name text not null,
  phone text,
  email text,
  message text,
  bid_price numeric(12,2),
  created_at timestamptz not null
);

create table if not exists contact_submissions (
  id uuid primary key,
  buyer_name text not null,
  phone text,
  email text,
  location text,
  message text not null,
  captcha_prompt text not null,
  created_at timestamptz not null
);

create index if not exists idx_items_status on items(status);
create index if not exists idx_items_category on items(category);
create index if not exists idx_item_images_item_id on item_images(item_id);
create index if not exists idx_leads_item_id on leads(item_id);
create index if not exists idx_contact_submissions_created_at on contact_submissions(created_at desc);