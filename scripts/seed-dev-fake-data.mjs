import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { Client } from "pg";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/itemsforsale";
const dataMode = (process.env.DATA_MODE ?? "local").toLowerCase();
const databaseFilePath = path.join(process.cwd(), "data", "local-db.json");
const devSeedMarker = "[DEV_SEED]";

const leadNames = [
  "Arjun",
  "Rohan",
  "Meera",
  "Priya",
  "Nikhil",
  "Asha",
  "Rahul",
  "Sneha",
  "Karthik",
  "Ananya",
  "Vivek",
  "Pooja",
];

const contactNames = [
  "Deepak",
  "Divya",
  "Manoj",
  "Neha",
  "Suresh",
  "Kavya",
  "Harish",
  "Shreya",
  "Ganesh",
  "Ritu",
];

const leadMessages = [
  "Interested in this item. Is the price negotiable?",
  "Can I visit tomorrow evening to check condition?",
  "Please share final pickup timeline and best price.",
  "I can arrange transport this weekend if available.",
  "Is there any warranty bill available with this item?",
  "Looks good, I want to place a serious offer.",
];

const contactMessages = [
  "I am interested in multiple items. Please share a suitable time to discuss.",
  "Can you confirm pickup slot availability this weekend?",
  "Please let me know if bundled pricing is possible for 2 or more items.",
  "I can travel from nearby location and inspect items in person.",
  "Kindly share preferred contact timing for a quick call.",
];

const captchaPrompts = [
  "What is 7 + 5?",
  "Which city is known as the Silicon Valley of India?",
  "What is 9 - 3?",
  "Name the capital of Karnataka.",
  "What is 6 + 8?",
];

function randomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function fakePhone() {
  const first = String(6 + Math.floor(Math.random() * 4));
  let rest = "";
  for (let index = 0; index < 9; index += 1) {
    rest += String(Math.floor(Math.random() * 10));
  }
  return `${first}${rest}`;
}

function fakeEmail(name, index) {
  const base = name.toLowerCase().replace(/\s+/g, "");
  return `${base}${index}@example.com`;
}

function fakeBidPrice(index) {
  return 1500 + index * 350;
}

function fakeTimestamp(index) {
  const now = Date.now();
  const offsetHours = index * 6;
  return new Date(now - offsetHours * 60 * 60 * 1000).toISOString();
}

function fakeLead(itemId, index) {
  const name = `${randomItem(leadNames)} ${index + 1}`;

  return {
    id: crypto.randomUUID(),
    itemId,
    buyerName: name,
    phone: fakePhone(),
    email: fakeEmail(name, index + 1),
    message: `${devSeedMarker} ${randomItem(leadMessages)}`,
    bidPrice: fakeBidPrice(index),
    createdAt: fakeTimestamp(index),
  };
}

function fakeSubmission(index) {
  const name = `${randomItem(contactNames)} ${index + 1}`;

  return {
    id: crypto.randomUUID(),
    buyerName: name,
    phone: fakePhone(),
    email: fakeEmail(name, index + 1),
    location: "BTM Layout, Bengaluru",
    message: `${devSeedMarker} ${randomItem(contactMessages)}`,
    captchaPrompt: randomItem(captchaPrompts),
    createdAt: fakeTimestamp(index),
  };
}

async function seedLocalJson() {
  const raw = await readFile(databaseFilePath, "utf8");
  const database = JSON.parse(raw);
  const items = database.items ?? [];

  if (items.length === 0) {
    throw new Error("No items found in local-db.json. Add/import items first.");
  }

  const leadsToInsert = [];
  for (let index = 0; index < 24; index += 1) {
    const item = items[index % items.length];
    leadsToInsert.push(fakeLead(item.id, index));
  }

  const submissionsToInsert = [];
  for (let index = 0; index < 12; index += 1) {
    submissionsToInsert.push(fakeSubmission(index));
  }

  database.leads = [...leadsToInsert, ...(database.leads ?? [])];
  database.contactSubmissions = [...submissionsToInsert, ...(database.contactSubmissions ?? [])];

  await writeFile(databaseFilePath, JSON.stringify(database, null, 2));

  console.log(
    `Seeded ${leadsToInsert.length} fake leads and ${submissionsToInsert.length} fake contact submissions into local JSON.`,
  );
}

async function seedPostgres() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const itemsResult = await client.query("select id from items order by created_at asc");
    const itemIds = itemsResult.rows.map((row) => row.id);

    if (itemIds.length === 0) {
      throw new Error("No items found in PostgreSQL. Run npm run db:import first.");
    }

    await client.query("begin");

    for (let index = 0; index < 24; index += 1) {
      const lead = fakeLead(itemIds[index % itemIds.length], index);
      await client.query(
        `insert into leads (id, item_id, buyer_name, phone, email, message, bid_price, created_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          lead.id,
          lead.itemId,
          lead.buyerName,
          lead.phone,
          lead.email,
          lead.message,
          lead.bidPrice,
          lead.createdAt,
        ],
      );
    }

    for (let index = 0; index < 12; index += 1) {
      const submission = fakeSubmission(index);
      await client.query(
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
    }

    await client.query("commit");
    console.log("Seeded 24 fake leads and 12 fake contact submissions into PostgreSQL.");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

async function main() {
  if (dataMode === "postgres") {
    await seedPostgres();
    return;
  }

  await seedLocalJson();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
