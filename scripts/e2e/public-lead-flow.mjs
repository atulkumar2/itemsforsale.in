import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";

import { Client } from "pg";

import { log } from "./helpers.mjs";
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
} from "./flow-common.mjs";

/**
 * End-to-end public lead flow.
 *
 * Coverage:
 * - seed one public item
 * - submit single-item interest via public leads route
 * - verify lead row values and expected price context linkage
 * - verify admin leads page shows the submitted enquiry
 */

const config = getPostgresE2EConfig();
const { appBaseUrl, appPort, containerName, databaseUrl, rootDir } = config;

let appProcess = null;

async function seedPublicItem() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const itemId = randomUUID();
    const now = new Date().toISOString();
    const title = "Public Lead Flow Chair";

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
        itemId,
        "public-lead-flow-chair",
        title,
        "Seeded by public lead E2E flow.",
        "Testing",
        "Great",
        "2024-01-10",
        12000,
        8000,
        "2026-05-01",
        "Koramangala",
        "available",
        now,
        now,
      ],
    );

    return { itemId, title };
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

async function submitLeadWithCaptcha(itemId) {
  const challenge = await fetchCaptchaChallenge();
  const buyerName = "Public Lead Buyer";

  for (const option of challenge.options) {
    const response = await fetch(`${appBaseUrl}/api/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemId,
        buyerName,
        phone: "9876543210",
        email: "public-lead@example.com",
        location: "HSR Layout",
        message: "I want to inspect this item this weekend.",
        bidPrice: "7600",
        captchaToken: challenge.token,
        captchaAnswer: option,
      }),
    });

    if (response.status === 201) {
      const payload = await response.json();
      assert.equal(payload.message, "Interest submitted successfully.");
      return { buyerName };
    }
  }

  throw new Error("Unable to submit lead: captcha options did not validate.");
}

async function assertLeadRow(itemId, buyerName) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const result = await client.query(
      `select l.item_id, l.buyer_name, l.phone, l.email, l.location, l.message, l.bid_price::text,
              i.expected_price::text as expected_price
       from leads l
       join items i on i.id = l.item_id
       where l.item_id = $1 and l.buyer_name = $2
       order by l.created_at desc
       limit 1`,
      [itemId, buyerName],
    );

    assert.equal(result.rows.length, 1, "lead row should exist for submitted item");
    assert.equal(result.rows[0].phone, "9876543210");
    assert.equal(result.rows[0].email, "public-lead@example.com");
    assert.equal(result.rows[0].location, "HSR Layout");
    assert.equal(result.rows[0].expected_price, "8000.00");
    assert.equal(result.rows[0].bid_price, "7600.00");
  } finally {
    await client.end();
  }
}

async function assertAdminVisibility(buyerName, itemTitle) {
  const cookieHeader = await loginAsAdmin(config);

  const response = await fetch(`${appBaseUrl}/admin/leads`, {
    headers: { Cookie: cookieHeader },
    redirect: "manual",
  });

  assert.equal(response.status, 200, "admin leads page should be accessible after login");
  const html = await response.text();
  assert.ok(html.includes(buyerName), "admin leads page should show buyer name");
  assert.ok(html.includes(itemTitle), "admin leads page should show item title");
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
      seedDescription: "Disposable row inserted by public lead flow.",
    });

    appProcess = await startApp(config);
    await waitForApp(appBaseUrl);

    log("Seeding one public item and submitting single-item interest");
    const { itemId, title } = await seedPublicItem();
    const { buyerName } = await submitLeadWithCaptcha(itemId);

    log("Verifying lead row and admin visibility");
    await assertLeadRow(itemId, buyerName);
    await assertAdminVisibility(buyerName, title);

    log("E2E public lead flow completed successfully");
  } finally {
    await cleanupRun({ appProcess, rootDir, appPort, containerName });
  }
}

main().catch((error) => {
  process.stderr.write(`\n[e2e] ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
