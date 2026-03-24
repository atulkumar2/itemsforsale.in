import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";

import { Client } from "pg";

import { log } from "../helpers.mjs";
import {
  applySchemaAndSeedData,
  cleanupRun,
  ensureDockerAvailable,
  getPostgresE2EConfig,
  loginAsAdmin,
  preflightCleanup,
  startApp,
  startPostgresContainer,
  waitForApp,
  waitForPostgres,
} from "../flow-common.mjs";

/**
 * End-to-end public bulk-interest flow.
 *
 * Coverage:
 * - seed multiple public items
 * - submit one bulk enquiry via public bulk leads route
 * - verify one lead row per selected item and correct mapping
 * - verify admin leads page shows the enquiry
 */

const config = getPostgresE2EConfig();
const { appBaseUrl, appPort, containerName, databaseUrl, rootDir } = config;

let appProcess = null;

async function seedPublicItems() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const now = new Date().toISOString();
    const items = [
      { id: randomUUID(), slug: "public-bulk-flow-chair", title: "Public Bulk Flow Chair", expected: 7000 },
      { id: randomUUID(), slug: "public-bulk-flow-table", title: "Public Bulk Flow Table", expected: 9200 },
      { id: randomUUID(), slug: "public-bulk-flow-lamp", title: "Public Bulk Flow Lamp", expected: 2500 },
    ];

    for (const item of items) {
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
          "Seeded by public bulk-interest E2E flow.",
          "Testing",
          "Great",
          "2024-01-10",
          item.expected + 1000,
          item.expected,
          "2026-05-01",
          "Indiranagar",
          "available",
          now,
          now,
        ],
      );
    }

    return items;
  } finally {
    await client.end();
  }
}

async function fetchCaptchaChallenge() {
  const response = await fetch(`${appBaseUrl}/api/human-check`, {
    headers: { "Cache-Control": "no-store" },
  });

  assert.equal(response.status, 200, "captcha endpoint should return 200");
  return response.json();
}

async function submitBulkInterest(itemIds) {
  const challenge = await fetchCaptchaChallenge();
  const buyerName = "Public Bulk Buyer";

  for (const option of challenge.options) {
    const response = await fetch(`${appBaseUrl}/api/bulk-leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemIds,
        buyerName,
        phone: "9123456789",
        email: "public-bulk@example.com",
        location: "BTM Layout",
        message: "Interested in multiple items; please share visit slot.",
        captchaToken: challenge.token,
        captchaAnswer: option,
      }),
    });

    if (response.status === 201) {
      const payload = await response.json();
      assert.match(payload.message, /Interest submitted for 2 items\./);
      return { buyerName };
    }
  }

  throw new Error("Unable to submit bulk interest: captcha options did not validate.");
}

async function assertBulkLeadRows(itemIds, buyerName) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const result = await client.query(
      `select item_id, buyer_name, phone, email, location, message
       from leads
       where buyer_name = $1
       order by created_at asc`,
      [buyerName],
    );

    assert.equal(result.rows.length, 2, "bulk submit should create exactly one lead per selected item");

    const mappedItemIds = result.rows.map((row) => row.item_id).sort();
    const expectedItemIds = [...itemIds].sort();
    assert.deepEqual(mappedItemIds, expectedItemIds, "lead rows should map to selected item ids");
    assert.equal(result.rows[0].phone, "9123456789");
    assert.equal(result.rows[0].email, "public-bulk@example.com");
    assert.equal(result.rows[0].location, "BTM Layout");
  } finally {
    await client.end();
  }
}

async function assertAdminVisibility(buyerName) {
  const cookieHeader = await loginAsAdmin(config);

  const response = await fetch(`${appBaseUrl}/admin/leads?q=${encodeURIComponent(buyerName)}`, {
    headers: { Cookie: cookieHeader },
    redirect: "manual",
  });

  assert.equal(response.status, 200, "admin leads page should be accessible after login");
  const html = await response.text();
  assert.ok(html.includes(buyerName), "admin leads page should show bulk enquiry buyer");
}

async function main() {
  try {
    await preflightCleanup(config);
    await ensureDockerAvailable(rootDir);
    await startPostgresContainer(config);
    await waitForPostgres(databaseUrl);
    await applySchemaAndSeedData({
      databaseUrl,
      rootDir,
      seedDescription: "Disposable row inserted by public bulk-interest flow.",
    });

    appProcess = await startApp(config);
    await waitForApp(appBaseUrl);

    log("Seeding multiple public items and submitting one bulk enquiry");
    const items = await seedPublicItems();
    const selectedItemIds = [items[0].id, items[1].id];
    const { buyerName } = await submitBulkInterest(selectedItemIds);

    log("Verifying one lead row per selected item and admin visibility");
    await assertBulkLeadRows(selectedItemIds, buyerName);
    await assertAdminVisibility(buyerName);

    log("E2E public bulk-interest flow completed successfully");
  } finally {
    await cleanupRun({ appProcess, rootDir, appPort, containerName });
  }
}

main().catch((error) => {
  process.stderr.write(`\n[e2e] ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
