import "server-only";

import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { Pool, type PoolClient, type QueryResultRow } from "pg";

import { getDatabaseUrl } from "@/lib/env";
import { contactFormLimits, interestFormLimits, itemFormLimits } from "@/lib/constants";
import { localSeedDatabase } from "@/lib/data/local-seed";
import type {
  ContactSubmission,
  Item,
  ItemFilters,
  ItemImage,
  ItemStatus,
  ItemWithImages,
  Lead,
  LeadFilters,
  LeadWithItem,
  SaveContactSubmissionInput,
  SaveItemInput,
  SaveLeadInput,
} from "@/lib/types";
import { normaliseOptionalString, slugify, toDateOnlyString } from "@/lib/utils";
import { processUploadedImage } from "@/lib/upload-security";

const uploadsRootPath = path.join(process.cwd(), "public", "uploads");

let pool: Pool | null = null;
let bootstrapPromise: Promise<void> | null = null;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: getDatabaseUrl(),
    });
  }

  return pool;
}

async function query<T extends QueryResultRow>(text: string, values: unknown[] = []) {
  return getPool().query<T>(text, values);
}

async function withTransaction<T>(run: (client: PoolClient) => Promise<T>) {
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const result = await run(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function ensureSchema() {
  await query(`
    create table if not exists items (
      id uuid primary key,
      slug varchar(${itemFormLimits.slugMax}) not null unique check (char_length(slug) <= ${itemFormLimits.slugMax}),
      title varchar(${itemFormLimits.titleMax}) not null check (char_length(title) between ${itemFormLimits.titleMin} and ${itemFormLimits.titleMax}),
      description varchar(${itemFormLimits.descriptionMax}) check (description is null or char_length(description) <= ${itemFormLimits.descriptionMax}),
      category varchar(${itemFormLimits.categoryMax}) check (category is null or char_length(category) <= ${itemFormLimits.categoryMax}),
      condition varchar(${itemFormLimits.conditionMax}) check (condition is null or char_length(condition) <= ${itemFormLimits.conditionMax}),
      purchase_date date,
      purchase_price numeric(12,2),
      expected_price numeric(12,2),
      available_from date,
      location_area varchar(${itemFormLimits.locationAreaMax}) check (location_area is null or char_length(location_area) <= ${itemFormLimits.locationAreaMax}),
      status varchar(20) not null check (status in ('available', 'reserved', 'sold')),
      created_at timestamptz not null,
      updated_at timestamptz not null
    );

    create table if not exists item_images (
      id uuid primary key,
      item_id uuid not null references items(id) on delete cascade,
      image_url varchar(${itemFormLimits.imageUrlMax}) not null check (char_length(image_url) <= ${itemFormLimits.imageUrlMax}),
      thumbnail_url varchar(${itemFormLimits.thumbnailUrlMax}) check (thumbnail_url is null or char_length(thumbnail_url) <= ${itemFormLimits.thumbnailUrlMax}),
      sort_order int not null default 0,
      created_at timestamptz not null
    );

    create table if not exists leads (
      id uuid primary key,
      item_id uuid not null references items(id) on delete cascade,
      buyer_name varchar(${interestFormLimits.buyerNameMax}) not null check (char_length(buyer_name) between 2 and ${interestFormLimits.buyerNameMax}),
      phone varchar(${interestFormLimits.phoneLength}) check (phone is null or char_length(phone) = ${interestFormLimits.phoneLength}),
      email varchar(${interestFormLimits.emailMax}) check (email is null or char_length(email) <= ${interestFormLimits.emailMax}),
      location varchar(${contactFormLimits.locationMax}) check (location is null or char_length(location) <= ${contactFormLimits.locationMax}),
      message varchar(${interestFormLimits.messageMax}) check (message is null or char_length(message) <= ${interestFormLimits.messageMax}),
      bid_price numeric(12,2),
      created_at timestamptz not null
    );

    create table if not exists contact_submissions (
      id uuid primary key,
      buyer_name varchar(${contactFormLimits.buyerNameMax}) not null check (char_length(buyer_name) between 2 and ${contactFormLimits.buyerNameMax}),
      phone varchar(${contactFormLimits.phoneLength}) check (phone is null or char_length(phone) = ${contactFormLimits.phoneLength}),
      email varchar(${contactFormLimits.emailMax}) check (email is null or char_length(email) <= ${contactFormLimits.emailMax}),
      location varchar(${contactFormLimits.locationMax}) check (location is null or char_length(location) <= ${contactFormLimits.locationMax}),
      message varchar(${contactFormLimits.messageMax}) not null check (char_length(message) between 10 and ${contactFormLimits.messageMax}),
      captcha_prompt varchar(160) not null check (char_length(captcha_prompt) <= 160),
      created_at timestamptz not null
    );

    create index if not exists idx_items_status on items(status);
    create index if not exists idx_items_category on items(category);
    create index if not exists idx_item_images_item_id on item_images(item_id);
    create index if not exists idx_leads_item_id on leads(item_id);
    create index if not exists idx_contact_submissions_created_at on contact_submissions(created_at desc);
  `);

  await query(`
    do $$
    begin
      if not exists (select 1 from pg_constraint where conname = 'items_pkey') then
        alter table items add constraint items_pkey primary key (id);
      end if;
      if not exists (select 1 from pg_constraint where conname = 'items_slug_key') then
        alter table items add constraint items_slug_key unique (slug);
      end if;
      if not exists (select 1 from pg_constraint where conname = 'items_slug_length_check') then
        alter table items add constraint items_slug_length_check check (char_length(slug) <= ${itemFormLimits.slugMax});
      end if;
      if not exists (select 1 from pg_constraint where conname = 'items_title_length_check') then
        alter table items add constraint items_title_length_check check (char_length(title) between ${itemFormLimits.titleMin} and ${itemFormLimits.titleMax});
      end if;
      if not exists (select 1 from pg_constraint where conname = 'items_description_length_check') then
        alter table items add constraint items_description_length_check check (description is null or char_length(description) <= ${itemFormLimits.descriptionMax});
      end if;
      if not exists (select 1 from pg_constraint where conname = 'items_category_length_check') then
        alter table items add constraint items_category_length_check check (category is null or char_length(category) <= ${itemFormLimits.categoryMax});
      end if;
      if not exists (select 1 from pg_constraint where conname = 'items_condition_length_check') then
        alter table items add constraint items_condition_length_check check (condition is null or char_length(condition) <= ${itemFormLimits.conditionMax});
      end if;
      if not exists (select 1 from pg_constraint where conname = 'items_location_area_length_check') then
        alter table items add constraint items_location_area_length_check check (location_area is null or char_length(location_area) <= ${itemFormLimits.locationAreaMax});
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
        alter table item_images add constraint item_images_image_url_length_check check (char_length(image_url) <= ${itemFormLimits.imageUrlMax});
      end if;
      if not exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'item_images' and column_name = 'thumbnail_url'
      ) then
        alter table item_images add column thumbnail_url varchar(${itemFormLimits.thumbnailUrlMax});
      end if;
      if not exists (select 1 from pg_constraint where conname = 'item_images_thumbnail_url_length_check') then
        alter table item_images add constraint item_images_thumbnail_url_length_check check (thumbnail_url is null or char_length(thumbnail_url) <= ${itemFormLimits.thumbnailUrlMax});
      end if;
      if not exists (select 1 from pg_constraint where conname = 'leads_pkey') then
        alter table leads add constraint leads_pkey primary key (id);
      end if;
      if not exists (select 1 from pg_constraint where conname = 'leads_item_id_fkey') then
        alter table leads add constraint leads_item_id_fkey foreign key (item_id) references items(id) on delete cascade;
      end if;
      if not exists (select 1 from pg_constraint where conname = 'leads_buyer_name_length_check') then
        alter table leads add constraint leads_buyer_name_length_check check (char_length(buyer_name) between 2 and ${interestFormLimits.buyerNameMax});
      end if;
      if not exists (select 1 from pg_constraint where conname = 'leads_phone_length_check') then
        alter table leads add constraint leads_phone_length_check check (phone is null or char_length(phone) = ${interestFormLimits.phoneLength});
      end if;
      if not exists (select 1 from pg_constraint where conname = 'leads_email_length_check') then
        alter table leads add constraint leads_email_length_check check (email is null or char_length(email) <= ${interestFormLimits.emailMax});
      end if;
      if not exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'leads' and column_name = 'location'
      ) then
        alter table leads add column location varchar(${contactFormLimits.locationMax});
      end if;
      if not exists (select 1 from pg_constraint where conname = 'leads_location_length_check') then
        alter table leads add constraint leads_location_length_check check (location is null or char_length(location) <= ${contactFormLimits.locationMax});
      end if;
      if not exists (select 1 from pg_constraint where conname = 'leads_message_length_check') then
        alter table leads add constraint leads_message_length_check check (message is null or char_length(message) <= ${interestFormLimits.messageMax});
      end if;
      if not exists (select 1 from pg_constraint where conname = 'contact_submissions_pkey') then
        alter table contact_submissions add constraint contact_submissions_pkey primary key (id);
      end if;
      if not exists (select 1 from pg_constraint where conname = 'contact_submissions_buyer_name_length_check') then
        alter table contact_submissions add constraint contact_submissions_buyer_name_length_check check (char_length(buyer_name) between 2 and ${contactFormLimits.buyerNameMax});
      end if;
      if not exists (select 1 from pg_constraint where conname = 'contact_submissions_phone_length_check') then
        alter table contact_submissions add constraint contact_submissions_phone_length_check check (phone is null or char_length(phone) = ${contactFormLimits.phoneLength});
      end if;
      if not exists (select 1 from pg_constraint where conname = 'contact_submissions_email_length_check') then
        alter table contact_submissions add constraint contact_submissions_email_length_check check (email is null or char_length(email) <= ${contactFormLimits.emailMax});
      end if;
      if not exists (select 1 from pg_constraint where conname = 'contact_submissions_location_length_check') then
        alter table contact_submissions add constraint contact_submissions_location_length_check check (location is null or char_length(location) <= ${contactFormLimits.locationMax});
      end if;
      if not exists (select 1 from pg_constraint where conname = 'contact_submissions_message_length_check') then
        alter table contact_submissions add constraint contact_submissions_message_length_check check (char_length(message) between 10 and ${contactFormLimits.messageMax});
      end if;
      if not exists (select 1 from pg_constraint where conname = 'contact_submissions_captcha_prompt_length_check') then
        alter table contact_submissions add constraint contact_submissions_captcha_prompt_length_check check (char_length(captcha_prompt) <= 160);
      end if;
    end $$;
  `);
}

async function seedIfEmpty() {
  const countResult = await query<{ count: string }>("select count(*)::text as count from items");
  const count = Number(countResult.rows[0]?.count ?? "0");

  if (count > 0) {
    return;
  }

  await withTransaction(async (client) => {
    for (const item of localSeedDatabase.items) {
      await client.query(
        `insert into items (
          id, slug, title, description, category, condition, purchase_date,
          purchase_price, expected_price, available_from, location_area,
          status, created_at, updated_at
        ) values (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11,
          $12, $13, $14
        )`,
        [
          item.id,
          item.slug,
          item.title,
          item.description,
          item.category,
          item.condition,
          item.purchaseDate,
          item.purchasePrice,
          item.expectedPrice,
          item.availableFrom,
          item.locationArea,
          item.status,
          item.createdAt,
          item.updatedAt,
        ],
      );
    }

    for (const image of localSeedDatabase.itemImages) {
      await client.query(
        `insert into item_images (id, item_id, image_url, thumbnail_url, sort_order, created_at)
         values ($1, $2, $3, $4, $5, $6)`,
        [image.id, image.itemId, image.imageUrl, image.thumbnailUrl ?? null, image.sortOrder, image.createdAt],
      );
    }
  });
}

async function ensurePostgresReady() {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      await ensureSchema();
      await seedIfEmpty();
    })();
  }

  return bootstrapPromise;
}

export async function checkPostgresConnection() {
  try {
    await ensurePostgresReady();
    await query<{ ok: number }>("select 1 as ok");

    return {
      reachable: true,
      error: null,
    };
  } catch (error) {
    return {
      reachable: false,
      error: error instanceof Error ? error.message : "Unknown PostgreSQL error.",
    };
  }
}

function parseDbNumber(value: number | string | null) {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIsoString(value: string | Date | null) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

type ItemRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  category: string | null;
  condition: string | null;
  purchase_date: string | null;
  purchase_price: number | string | null;
  expected_price: number | string | null;
  available_from: string | null;
  location_area: string | null;
  status: ItemStatus;
  created_at: string | Date;
  updated_at: string | Date;
};

type ItemImageRow = {
  id: string;
  item_id: string;
  image_url: string;
  thumbnail_url: string | null;
  sort_order: number;
  created_at: string | Date;
};

type LeadRow = {
  id: string;
  item_id: string;
  buyer_name: string;
  phone: string | null;
  email: string | null;
  location: string | null;
  message: string | null;
  bid_price: number | string | null;
  created_at: string | Date;
  item_expected_price: number | string | null;
  item_title: string | null;
  item_slug: string | null;
};

type ContactSubmissionRow = {
  id: string;
  buyer_name: string;
  phone: string | null;
  email: string | null;
  location: string | null;
  message: string;
  captcha_prompt: string;
  created_at: string | Date;
};

function mapItemRow(row: ItemRow): Item {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    category: row.category,
    condition: row.condition,
    purchaseDate: toDateOnlyString(row.purchase_date),
    purchasePrice: parseDbNumber(row.purchase_price),
    expectedPrice: parseDbNumber(row.expected_price),
    availableFrom: toDateOnlyString(row.available_from),
    locationArea: row.location_area,
    status: row.status,
    createdAt: toIsoString(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIsoString(row.updated_at) ?? new Date().toISOString(),
  };
}

function mapImageRow(row: ItemImageRow): ItemImage {
  return {
    id: row.id,
    itemId: row.item_id,
    imageUrl: row.image_url,
    thumbnailUrl: row.thumbnail_url,
    sortOrder: row.sort_order,
    createdAt: toIsoString(row.created_at) ?? new Date().toISOString(),
  };
}

function mapLeadRow(row: LeadRow): LeadWithItem {
  return {
    id: row.id,
    itemId: row.item_id,
    buyerName: row.buyer_name,
    phone: row.phone,
    email: row.email,
    location: row.location,
    message: row.message,
    bidPrice: parseDbNumber(row.bid_price),
    createdAt: toIsoString(row.created_at) ?? new Date().toISOString(),
    itemExpectedPrice: parseDbNumber(row.item_expected_price),
    itemTitle: row.item_title ?? "Deleted item",
    itemSlug: row.item_slug ?? "",
  };
}

function mapContactSubmissionRow(row: ContactSubmissionRow): ContactSubmission {
  return {
    id: row.id,
    buyerName: row.buyer_name,
    phone: row.phone,
    email: row.email,
    location: row.location,
    message: row.message,
    captchaPrompt: row.captcha_prompt,
    createdAt: toIsoString(row.created_at) ?? new Date().toISOString(),
  };
}

async function fetchImagesForItems(itemIds: string[]) {
  if (itemIds.length === 0) {
    return [] as ItemImage[];
  }

  const imageResult = await query<ItemImageRow>(
    `select id, item_id, image_url, thumbnail_url, sort_order, created_at
     from item_images
     where item_id = any($1::uuid[])
     order by sort_order asc, created_at asc`,
    [itemIds],
  );

  return imageResult.rows.map(mapImageRow);
}

function hydrateItems(items: Item[], images: ItemImage[]): ItemWithImages[] {
  return items.map((item) => ({
    ...item,
    images: images.filter((image) => image.itemId === item.id),
  }));
}

async function ensureUniqueSlug(title: string, currentItemId?: string) {
  const baseSlug = slugify(title) || "item";
  let candidate = baseSlug;
  let suffix = 2;

  while (true) {
    const result = await query<{ id: string }>(
      `select id from items where slug = $1 and ($2::uuid is null or id <> $2::uuid) limit 1`,
      [candidate, currentItemId ?? null],
    );

    if (result.rows.length === 0) {
      return candidate;
    }

    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

async function storeUploadedImages(itemId: string, files: File[]) {
  if (files.length === 0) {
    return [] as ItemImage[];
  }

  await mkdir(path.join(uploadsRootPath, itemId), { recursive: true });

  const uploadedImages = await Promise.all(
    files.map(async (file, index) => {
      const processedImage = await processUploadedImage(file);
      const fileName = `${Date.now()}-${index}.${processedImage.display.extension}`;
      const thumbnailFileName = `${Date.now()}-${index}-thumb.${processedImage.thumbnail.extension}`;
      const relativePath = path.posix.join("/uploads", itemId, fileName);
      const thumbnailRelativePath = path.posix.join("/uploads", itemId, thumbnailFileName);
      const outputPath = path.join(uploadsRootPath, itemId, fileName);
      const thumbnailOutputPath = path.join(uploadsRootPath, itemId, thumbnailFileName);
      const createdAt = new Date().toISOString();

      await writeFile(outputPath, processedImage.display.bytes);
      await writeFile(thumbnailOutputPath, processedImage.thumbnail.bytes);

      return {
        id: crypto.randomUUID(),
        itemId,
        imageUrl: relativePath,
        thumbnailUrl: thumbnailRelativePath,
        sortOrder: index,
        createdAt,
      } satisfies ItemImage;
    }),
  );

  return uploadedImages;
}

async function deleteStoredImageFiles(images: ItemImage[]) {
  await Promise.all(
    images.flatMap((image) =>
      [image.imageUrl, image.thumbnailUrl]
        .filter((filePath): filePath is string => Boolean(filePath))
        .map(async (filePath) => {
          const normalizedPath = filePath.replace(/^\/+/, "").replace(/\//g, path.sep);
          const absolutePath = path.join(process.cwd(), "public", normalizedPath);

          try {
            await unlink(absolutePath);
          } catch {
            // Ignore missing files so metadata cleanup can still succeed.
          }
        }),
    ),
  );
}

export async function listItems(filters: ItemFilters = {}) {
  await ensurePostgresReady();

  const clauses: string[] = [];
  const values: unknown[] = [];

  if (filters.query) {
    values.push(`%${filters.query.toLowerCase()}%`);
    clauses.push(`lower(title) like $${values.length}`);
  }

  if (filters.status) {
    values.push(filters.status);
    clauses.push(`status = $${values.length}`);
  }

  if (filters.category) {
    values.push(filters.category.toLowerCase());
    clauses.push(`lower(category) = $${values.length}`);
  }

  const where = clauses.length > 0 ? `where ${clauses.join(" and ")}` : "";

  const itemResult = await query<ItemRow>(
    `select id, slug, title, description, category, condition, purchase_date::text,
            purchase_price, expected_price, available_from::text, location_area,
            status, created_at, updated_at
     from items
     ${where}
     order by created_at desc`,
    values,
  );

  const items = itemResult.rows.map(mapItemRow);
  const images = await fetchImagesForItems(items.map((item) => item.id));

  return hydrateItems(items, images);
}

export async function getItemBySlug(slug: string) {
  await ensurePostgresReady();
  const itemResult = await query<ItemRow>(
    `select id, slug, title, description, category, condition, purchase_date::text,
            purchase_price, expected_price, available_from::text, location_area,
            status, created_at, updated_at
     from items where slug = $1 limit 1`,
    [slug],
  );

  const row = itemResult.rows[0];
  if (!row) {
    return null;
  }

  const item = mapItemRow(row);
  const images = await fetchImagesForItems([item.id]);
  return hydrateItems([item], images)[0] ?? null;
}

export async function getItemById(id: string) {
  await ensurePostgresReady();
  const itemResult = await query<ItemRow>(
    `select id, slug, title, description, category, condition, purchase_date::text,
            purchase_price, expected_price, available_from::text, location_area,
            status, created_at, updated_at
     from items where id = $1 limit 1`,
    [id],
  );

  const row = itemResult.rows[0];
  if (!row) {
    return null;
  }

  const item = mapItemRow(row);
  const images = await fetchImagesForItems([item.id]);
  return hydrateItems([item], images)[0] ?? null;
}

export async function listCategories() {
  await ensurePostgresReady();
  const result = await query<{ category: string | null }>(
    `select distinct category from items where category is not null order by category asc`,
  );

  return result.rows
    .map((row) => row.category)
    .filter((value): value is string => Boolean(value));
}

export async function createLead(input: SaveLeadInput) {
  await ensurePostgresReady();
  const lead: Lead = {
    id: crypto.randomUUID(),
    itemId: input.itemId,
    buyerName: input.buyerName,
    phone: normaliseOptionalString(input.phone) ?? null,
    email: normaliseOptionalString(input.email) ?? null,
    location: normaliseOptionalString(input.location) ?? null,
    message: normaliseOptionalString(input.message) ?? null,
    bidPrice: input.bidPrice ?? null,
    createdAt: new Date().toISOString(),
  };

  await query(
    `insert into leads (id, item_id, buyer_name, phone, email, location, message, bid_price, created_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      lead.id,
      lead.itemId,
      lead.buyerName,
      lead.phone,
      lead.email,
      lead.location,
      lead.message,
      lead.bidPrice,
      lead.createdAt,
    ],
  );

  return lead;
}

export async function listLeads(filters: LeadFilters = {}) {
  await ensurePostgresReady();
  const clauses: string[] = [];
  const values: unknown[] = [];

  if (filters.itemId) {
    values.push(filters.itemId);
    clauses.push(`l.item_id = $${values.length}`);
  }

  if (filters.query) {
    values.push(`%${filters.query.toLowerCase()}%`);
    clauses.push(`(
      lower(l.buyer_name) like $${values.length}
      or coalesce(lower(l.phone), '') like $${values.length}
      or coalesce(lower(l.email), '') like $${values.length}
      or coalesce(lower(l.location), '') like $${values.length}
      or coalesce(lower(l.message), '') like $${values.length}
      or coalesce(lower(i.title), '') like $${values.length}
    )`);
  }

  const where = clauses.length > 0 ? `where ${clauses.join(" and ")}` : "";
  const result = await query<LeadRow>(
    `select
        l.id,
        l.item_id,
        l.buyer_name,
        l.phone,
        l.email,
        l.location,
        l.message,
        l.bid_price,
        l.created_at,
        i.expected_price as item_expected_price,
        i.title as item_title,
        i.slug as item_slug
      from leads l
      left join items i on i.id = l.item_id
      ${where}
      order by l.created_at desc`,
    values,
  );

  return result.rows.map(mapLeadRow);
}

export async function createContactSubmission(input: SaveContactSubmissionInput) {
  await ensurePostgresReady();
  const submission: ContactSubmission = {
    id: crypto.randomUUID(),
    buyerName: input.buyerName,
    phone: normaliseOptionalString(input.phone) ?? null,
    email: normaliseOptionalString(input.email) ?? null,
    location: normaliseOptionalString(input.location) ?? null,
    message: normaliseOptionalString(input.message) ?? "",
    captchaPrompt: input.captchaPrompt,
    createdAt: new Date().toISOString(),
  };

  await query(
    `insert into contact_submissions (
        id, buyer_name, phone, email, location, message, captcha_prompt, created_at
      ) values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      submission.id,
      submission.buyerName,
      submission.phone,
      submission.email,
      submission.location,
      submission.message,
      submission.captchaPrompt,
      submission.createdAt,
    ],
  );

  return submission;
}

export async function listContactSubmissions() {
  await ensurePostgresReady();
  const result = await query<ContactSubmissionRow>(
    `select id, buyer_name, phone, email, location, message, captcha_prompt, created_at
     from contact_submissions
     order by created_at desc`,
  );

  return result.rows.map(mapContactSubmissionRow);
}

export async function saveItem(input: SaveItemInput, files: File[]) {
  await ensurePostgresReady();
  const existingItem = input.id ? await getItemById(input.id) : null;
  const itemId = existingItem?.id ?? crypto.randomUUID();
  const now = new Date().toISOString();
  const slug = await ensureUniqueSlug(input.title, existingItem?.id);

  const nextItem: Item = {
    id: itemId,
    slug,
    title: input.title,
    description: normaliseOptionalString(input.description) ?? null,
    category: normaliseOptionalString(input.category) ?? null,
    condition: normaliseOptionalString(input.condition) ?? null,
    purchaseDate: normaliseOptionalString(input.purchaseDate) ?? null,
    purchasePrice: input.purchasePrice ?? null,
    expectedPrice: input.expectedPrice ?? null,
    availableFrom: normaliseOptionalString(input.availableFrom) ?? null,
    locationArea: normaliseOptionalString(input.locationArea) ?? null,
    status: input.status,
    createdAt: existingItem?.createdAt ?? now,
    updatedAt: now,
  };

  const uploadedImages = await storeUploadedImages(itemId, files);
  const removeImageIds = new Set(input.removeImageIds ?? []);
  const removedImages = existingItem?.images.filter((image) => removeImageIds.has(image.id)) ?? [];
  const retainedImages = (existingItem?.images ?? [])
    .filter((image) => !removeImageIds.has(image.id))
    .sort((left, right) => left.sortOrder - right.sortOrder);

  await withTransaction(async (client) => {
    if (existingItem) {
      await client.query(
        `update items set
          slug = $2,
          title = $3,
          description = $4,
          category = $5,
          condition = $6,
          purchase_date = $7,
          purchase_price = $8,
          expected_price = $9,
          available_from = $10,
          location_area = $11,
          status = $12,
          updated_at = $13
         where id = $1`,
        [
          nextItem.id,
          nextItem.slug,
          nextItem.title,
          nextItem.description,
          nextItem.category,
          nextItem.condition,
          nextItem.purchaseDate,
          nextItem.purchasePrice,
          nextItem.expectedPrice,
          nextItem.availableFrom,
          nextItem.locationArea,
          nextItem.status,
          nextItem.updatedAt,
        ],
      );
    } else {
      await client.query(
        `insert into items (
          id, slug, title, description, category, condition, purchase_date,
          purchase_price, expected_price, available_from, location_area,
          status, created_at, updated_at
        ) values (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11,
          $12, $13, $14
        )`,
        [
          nextItem.id,
          nextItem.slug,
          nextItem.title,
          nextItem.description,
          nextItem.category,
          nextItem.condition,
          nextItem.purchaseDate,
          nextItem.purchasePrice,
          nextItem.expectedPrice,
          nextItem.availableFrom,
          nextItem.locationArea,
          nextItem.status,
          nextItem.createdAt,
          nextItem.updatedAt,
        ],
      );
    }

    if (removeImageIds.size > 0) {
      await client.query(
        `delete from item_images
         where item_id = $1 and id = any($2::uuid[])`,
        [itemId, Array.from(removeImageIds)],
      );

      for (const [index, image] of retainedImages.entries()) {
        await client.query(
          `update item_images set sort_order = $2 where id = $1`,
          [image.id, index],
        );
      }
    }

    if (uploadedImages.length > 0) {
      const offset = retainedImages.length;

      for (const [index, image] of uploadedImages.entries()) {
        await client.query(
          `insert into item_images (id, item_id, image_url, thumbnail_url, sort_order, created_at)
           values ($1, $2, $3, $4, $5, $6)`,
          [
            image.id,
            image.itemId,
            image.imageUrl,
            image.thumbnailUrl ?? null,
            offset + index,
            image.createdAt,
          ],
        );
      }
    }
  });

  await deleteStoredImageFiles(removedImages);
  return getItemById(itemId);
}

export async function deleteItem(itemId: string) {
  await ensurePostgresReady();

  const imageResult = await query<ItemImageRow>(
    `select id, item_id, image_url, thumbnail_url, sort_order, created_at
     from item_images
     where item_id = $1
     order by sort_order asc, created_at asc`,
    [itemId],
  );

  await query(`delete from items where id = $1`, [itemId]);
  await deleteStoredImageFiles(imageResult.rows.map(mapImageRow));
}
