# Database Schema

Current runtime mode is local-first JSON storage in `data/local-db.json`.

The schema below represents both the local data shape and the future Supabase table structure.

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
item_id uuid fk -> items.id
image_url text
sort_order int
created_at timestamp

## leads

id uuid pk
item_id uuid fk -> items.id
buyer_name text
phone text
email text
message text
bid_price numeric
created_at timestamp

## contact_submissions

id uuid pk
buyer_name text
phone text
email text
location text
message text
captcha_prompt text
created_at timestamp

## Notes

- local file stores arrays: `items`, `itemImages`, `leads`, `contactSubmissions`
- CSV exports are generated from stored data:
	- catalogue export includes item links
	- contact submissions export includes location and timestamp
