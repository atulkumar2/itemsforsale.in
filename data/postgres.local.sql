create table if not exists items (
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

create table if not exists item_images (
  id uuid primary key,
  item_id uuid not null references items(id) on delete cascade,
  image_url varchar(500) not null check (char_length(image_url) <= 500),
  sort_order int not null default 0,
  created_at timestamptz not null
);

create table if not exists leads (
  id uuid primary key,
  item_id uuid not null references items(id) on delete cascade,
  buyer_name varchar(80) not null check (char_length(buyer_name) between 2 and 80),
  phone varchar(10) check (phone is null or char_length(phone) = 10),
  email varchar(160) check (email is null or char_length(email) <= 160),
  message varchar(1000) check (message is null or char_length(message) <= 1000),
  bid_price numeric(12,2),
  created_at timestamptz not null
);

create table if not exists contact_submissions (
  id uuid primary key,
  buyer_name varchar(80) not null check (char_length(buyer_name) between 2 and 80),
  phone varchar(10) check (phone is null or char_length(phone) = 10),
  email varchar(160) check (email is null or char_length(email) <= 160),
  location varchar(100) check (location is null or char_length(location) <= 100),
  message varchar(1200) not null check (char_length(message) between 10 and 1200),
  captcha_prompt varchar(160) not null check (char_length(captcha_prompt) <= 160),
  created_at timestamptz not null
);

create index if not exists idx_items_status on items(status);
create index if not exists idx_items_category on items(category);
create index if not exists idx_item_images_item_id on item_images(item_id);
create index if not exists idx_leads_item_id on leads(item_id);
create index if not exists idx_contact_submissions_created_at on contact_submissions(created_at desc);
