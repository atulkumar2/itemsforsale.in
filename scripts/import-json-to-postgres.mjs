import { readFile } from "node:fs/promises";
import path from "node:path";

import { Client } from "pg";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/itemsforsale";
const databaseFilePath = path.join(process.cwd(), "data", "local-db.json");
const schemaFilePath = path.join(process.cwd(), "data", "postgres.local.sql");

function optionalString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

async function main() {
  const client = new Client({ connectionString: databaseUrl });

  await client.connect();

  try {
    const schemaSql = await readFile(schemaFilePath, "utf8");
    await client.query(schemaSql);

    const raw = await readFile(databaseFilePath, "utf8");
    const database = JSON.parse(raw);

    await client.query("begin");

    for (const item of database.items ?? []) {
      await client.query(
        `insert into items (
          id, slug, title, description, category, condition, purchase_date,
          purchase_price, expected_price, available_from, location_area,
          status, created_at, updated_at
        ) values (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11,
          $12, $13, $14
        )
        on conflict (id) do update set
          slug = excluded.slug,
          title = excluded.title,
          description = excluded.description,
          category = excluded.category,
          condition = excluded.condition,
          purchase_date = excluded.purchase_date,
          purchase_price = excluded.purchase_price,
          expected_price = excluded.expected_price,
          available_from = excluded.available_from,
          location_area = excluded.location_area,
          status = excluded.status,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at`,
        [
          item.id,
          item.slug,
          item.title,
          optionalString(item.description),
          optionalString(item.category),
          optionalString(item.condition),
          optionalString(item.purchaseDate),
          item.purchasePrice ?? null,
          item.expectedPrice ?? null,
          optionalString(item.availableFrom),
          optionalString(item.locationArea),
          item.status,
          item.createdAt,
          item.updatedAt,
        ],
      );
    }

    for (const image of database.itemImages ?? []) {
      await client.query(
        `insert into item_images (id, item_id, image_url, sort_order, created_at)
         values ($1, $2, $3, $4, $5)
         on conflict (id) do update set
           item_id = excluded.item_id,
           image_url = excluded.image_url,
           sort_order = excluded.sort_order,
           created_at = excluded.created_at`,
        [image.id, image.itemId, image.imageUrl, image.sortOrder, image.createdAt],
      );
    }

    for (const lead of database.leads ?? []) {
      await client.query(
        `insert into leads (id, item_id, buyer_name, phone, email, message, bid_price, created_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8)
         on conflict (id) do update set
           item_id = excluded.item_id,
           buyer_name = excluded.buyer_name,
           phone = excluded.phone,
           email = excluded.email,
           message = excluded.message,
           bid_price = excluded.bid_price,
           created_at = excluded.created_at`,
        [
          lead.id,
          lead.itemId,
          lead.buyerName,
          optionalString(lead.phone),
          optionalString(lead.email),
          optionalString(lead.message),
          lead.bidPrice ?? null,
          lead.createdAt,
        ],
      );
    }

    for (const submission of database.contactSubmissions ?? []) {
      await client.query(
        `insert into contact_submissions (
          id, buyer_name, phone, email, location, message, captcha_prompt, created_at
        ) values ($1, $2, $3, $4, $5, $6, $7, $8)
        on conflict (id) do update set
          buyer_name = excluded.buyer_name,
          phone = excluded.phone,
          email = excluded.email,
          location = excluded.location,
          message = excluded.message,
          captcha_prompt = excluded.captcha_prompt,
          created_at = excluded.created_at`,
        [
          submission.id,
          submission.buyerName,
          optionalString(submission.phone),
          optionalString(submission.email),
          optionalString(submission.location),
          submission.message,
          submission.captchaPrompt,
          submission.createdAt,
        ],
      );
    }

    await client.query("commit");
    console.log("Imported local JSON data into PostgreSQL successfully.");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
