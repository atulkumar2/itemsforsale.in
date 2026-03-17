begin;

do $$
begin
  if exists (select 1 from items where id is null) then
    raise exception 'Cannot add items primary key: items.id contains null values';
  end if;
  if exists (select 1 from items group by id having count(*) > 1) then
    raise exception 'Cannot add items primary key: items.id contains duplicate values';
  end if;
  if exists (select 1 from items where slug is null) then
    raise exception 'Cannot add items slug constraints: items.slug contains null values';
  end if;
  if exists (select 1 from items group by slug having count(*) > 1) then
    raise exception 'Cannot add items slug unique constraint: items.slug contains duplicate values';
  end if;
  if exists (select 1 from items where char_length(slug) > 220) then
    raise exception 'Cannot add items slug length constraint: items.slug has values longer than 220';
  end if;
  if exists (select 1 from items where char_length(title) not between 3 and 200) then
    raise exception 'Cannot add items title length constraint: items.title has values outside 3..200';
  end if;
  if exists (select 1 from items where description is not null and char_length(description) > 5000) then
    raise exception 'Cannot add items description length constraint: items.description has values longer than 5000';
  end if;
  if exists (select 1 from items where category is not null and char_length(category) > 80) then
    raise exception 'Cannot add items category length constraint: items.category has values longer than 80';
  end if;
  if exists (select 1 from items where condition is not null and char_length(condition) > 80) then
    raise exception 'Cannot add items condition length constraint: items.condition has values longer than 80';
  end if;
  if exists (select 1 from items where location_area is not null and char_length(location_area) > 120) then
    raise exception 'Cannot add items location_area length constraint: items.location_area has values longer than 120';
  end if;
  if exists (select 1 from items where status not in ('available', 'reserved', 'sold')) then
    raise exception 'Cannot add items status constraint: items.status contains invalid values';
  end if;

  if exists (select 1 from item_images where id is null) then
    raise exception 'Cannot add item_images primary key: item_images.id contains null values';
  end if;
  if exists (select 1 from item_images group by id having count(*) > 1) then
    raise exception 'Cannot add item_images primary key: item_images.id contains duplicate values';
  end if;
  if exists (
    select 1
    from item_images ii
    left join items i on i.id = ii.item_id
    where ii.item_id is null or i.id is null
  ) then
    raise exception 'Cannot add item_images foreign key: item_images.item_id contains missing item references';
  end if;
  if exists (select 1 from item_images where char_length(image_url) > 500) then
    raise exception 'Cannot add item_images image_url constraint: item_images.image_url has values longer than 500';
  end if;

  if exists (select 1 from leads where id is null) then
    raise exception 'Cannot add leads primary key: leads.id contains null values';
  end if;
  if exists (select 1 from leads group by id having count(*) > 1) then
    raise exception 'Cannot add leads primary key: leads.id contains duplicate values';
  end if;
  if exists (
    select 1
    from leads l
    left join items i on i.id = l.item_id
    where l.item_id is null or i.id is null
  ) then
    raise exception 'Cannot add leads foreign key: leads.item_id contains missing item references';
  end if;
  if exists (select 1 from leads where char_length(buyer_name) not between 2 and 80) then
    raise exception 'Cannot add leads buyer_name constraint: leads.buyer_name has values outside 2..80';
  end if;
  if exists (select 1 from leads where phone is not null and char_length(phone) <> 10) then
    raise exception 'Cannot add leads phone constraint: leads.phone has values that are not 10 characters';
  end if;
  if exists (select 1 from leads where email is not null and char_length(email) > 160) then
    raise exception 'Cannot add leads email constraint: leads.email has values longer than 160';
  end if;
  if exists (select 1 from leads where message is not null and char_length(message) > 1000) then
    raise exception 'Cannot add leads message constraint: leads.message has values longer than 1000';
  end if;

  if exists (select 1 from contact_submissions where id is null) then
    raise exception 'Cannot add contact_submissions primary key: contact_submissions.id contains null values';
  end if;
  if exists (select 1 from contact_submissions group by id having count(*) > 1) then
    raise exception 'Cannot add contact_submissions primary key: contact_submissions.id contains duplicate values';
  end if;
  if exists (select 1 from contact_submissions where char_length(buyer_name) not between 2 and 80) then
    raise exception 'Cannot add contact_submissions buyer_name constraint: contact_submissions.buyer_name has values outside 2..80';
  end if;
  if exists (select 1 from contact_submissions where phone is not null and char_length(phone) <> 10) then
    raise exception 'Cannot add contact_submissions phone constraint: contact_submissions.phone has values that are not 10 characters';
  end if;
  if exists (select 1 from contact_submissions where email is not null and char_length(email) > 160) then
    raise exception 'Cannot add contact_submissions email constraint: contact_submissions.email has values longer than 160';
  end if;
  if exists (select 1 from contact_submissions where location is not null and char_length(location) > 100) then
    raise exception 'Cannot add contact_submissions location constraint: contact_submissions.location has values longer than 100';
  end if;
  if exists (select 1 from contact_submissions where char_length(message) not between 10 and 1200) then
    raise exception 'Cannot add contact_submissions message constraint: contact_submissions.message has values outside 10..1200';
  end if;
  if exists (select 1 from contact_submissions where char_length(captcha_prompt) > 160) then
    raise exception 'Cannot add contact_submissions captcha_prompt constraint: contact_submissions.captcha_prompt has values longer than 160';
  end if;

  if not exists (select 1 from pg_constraint where conname = 'items_pkey') then
    alter table items add constraint items_pkey primary key (id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'items_slug_key') then
    alter table items add constraint items_slug_key unique (slug);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'items_slug_length_check') then
    alter table items add constraint items_slug_length_check check (char_length(slug) <= 220);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'items_title_length_check') then
    alter table items add constraint items_title_length_check check (char_length(title) between 3 and 200);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'items_description_length_check') then
    alter table items add constraint items_description_length_check check (description is null or char_length(description) <= 5000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'items_category_length_check') then
    alter table items add constraint items_category_length_check check (category is null or char_length(category) <= 80);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'items_condition_length_check') then
    alter table items add constraint items_condition_length_check check (condition is null or char_length(condition) <= 80);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'items_location_area_length_check') then
    alter table items add constraint items_location_area_length_check check (location_area is null or char_length(location_area) <= 120);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'items_status_check') then
    alter table items add constraint items_status_check check (status in ('available', 'reserved', 'sold'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'item_images_pkey') then
    alter table item_images add constraint item_images_pkey primary key (id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'item_images_item_id_fkey') then
    alter table item_images add constraint item_images_item_id_fkey foreign key (item_id) references items(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'item_images_image_url_length_check') then
    alter table item_images add constraint item_images_image_url_length_check check (char_length(image_url) <= 500);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'leads_pkey') then
    alter table leads add constraint leads_pkey primary key (id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'leads_item_id_fkey') then
    alter table leads add constraint leads_item_id_fkey foreign key (item_id) references items(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'leads_buyer_name_length_check') then
    alter table leads add constraint leads_buyer_name_length_check check (char_length(buyer_name) between 2 and 80);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'leads_phone_length_check') then
    alter table leads add constraint leads_phone_length_check check (phone is null or char_length(phone) = 10);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'leads_email_length_check') then
    alter table leads add constraint leads_email_length_check check (email is null or char_length(email) <= 160);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'leads_message_length_check') then
    alter table leads add constraint leads_message_length_check check (message is null or char_length(message) <= 1000);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'contact_submissions_pkey') then
    alter table contact_submissions add constraint contact_submissions_pkey primary key (id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'contact_submissions_buyer_name_length_check') then
    alter table contact_submissions add constraint contact_submissions_buyer_name_length_check check (char_length(buyer_name) between 2 and 80);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'contact_submissions_phone_length_check') then
    alter table contact_submissions add constraint contact_submissions_phone_length_check check (phone is null or char_length(phone) = 10);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'contact_submissions_email_length_check') then
    alter table contact_submissions add constraint contact_submissions_email_length_check check (email is null or char_length(email) <= 160);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'contact_submissions_location_length_check') then
    alter table contact_submissions add constraint contact_submissions_location_length_check check (location is null or char_length(location) <= 100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'contact_submissions_message_length_check') then
    alter table contact_submissions add constraint contact_submissions_message_length_check check (char_length(message) between 10 and 1200);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'contact_submissions_captcha_prompt_length_check') then
    alter table contact_submissions add constraint contact_submissions_captcha_prompt_length_check check (char_length(captcha_prompt) <= 160);
  end if;
end $$;

commit;
