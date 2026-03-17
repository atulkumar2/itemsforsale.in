# Database Schema

## items

id uuid pk
slug text unique
title text
description text
category text
condition text
purchase_date date
purchase_price numeric
expected_price numeric
available_from date
location_area text
status text
created_at timestamp
updated_at timestamp

status values:

- available
- reserved
- sold

## item_images

id uuid pk
item_id uuid fk
image_url text
sort_order int
created_at timestamp

## leads

id uuid pk
item_id uuid fk
buyer_name text
phone text
email text
message text
bid_price numeric
created_at timestamp
