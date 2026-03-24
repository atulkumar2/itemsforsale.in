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
 * End-to-end admin leads view flow.
 *
 * Coverage:
 * - seed multiple items and leads with different timestamps and bid/expected prices
 * - verify admin leads page renders expected and bid prices
 * - verify default sort order is newest-first
 * - verify search and item filter behavior on admin leads page
 */

const config = getPostgresE2EConfig();
const { appBaseUrl, appPort, containerName, databaseUrl, rootDir } = config;

let appProcess = null;

async function seedItemsAndLeads() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const now = Date.now();

    const itemA = {
      id: randomUUID(),
      slug: "admin-leads-view-item-a",
      title: "Admin Leads Item A",
      expectedPrice: 4500,
    };

    const itemB = {
      id: randomUUID(),
      slug: "admin-leads-view-item-b",
      title: "Admin Leads Item B",
      expectedPrice: 9200,
    };

    const items = [itemA, itemB];
    for (const item of items) {
      const ts = new Date(now - 500_000).toISOString();
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
          "Seeded for admin leads view flow.",
          "Reporting",
          "Great",
          "2024-01-01",
          item.expectedPrice + 2000,
          item.expectedPrice,
          "2026-05-01",
          "JP Nagar",
          "available",
          ts,
          ts,
        ],
      );
    }

    const leads = [
      {
        id: randomUUID(),
        itemId: itemA.id,
        buyerName: "Leads View Buyer Old",
        bidPrice: 4000,
        createdAt: new Date(now - 120_000).toISOString(),
      },
      {
        id: randomUUID(),
        itemId: itemB.id,
        buyerName: "Leads View Buyer New",
        bidPrice: 8700,
        createdAt: new Date(now - 10_000).toISOString(),
      },
    ];

    for (const lead of leads) {
      await client.query(
        `insert into leads (id, item_id, buyer_name, phone, email, message, bid_price, created_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          lead.id,
          lead.itemId,
          lead.buyerName,
          "9000012345",
          `${lead.id}@example.com`,
          "Seeded lead for admin list checks.",
          lead.bidPrice,
          lead.createdAt,
        ],
      );
    }

    return { itemA, itemB, leads };
  } finally {
    await client.end();
  }
}

async function fetchAdminLeadsPage(cookieHeader, search = "") {
  const response = await fetch(`${appBaseUrl}/admin/leads${search}`, {
    headers: { Cookie: cookieHeader },
    redirect: "manual",
  });

  assert.equal(response.status, 200, `admin leads page should return 200, got ${response.status}`);
  return response.text();
}

async function assertDefaultSortAndPrices(cookieHeader) {
  const html = await fetchAdminLeadsPage(cookieHeader);

  assert.ok(html.includes("Buyer enquiries"), "admin leads heading should render");
  assert.ok(html.includes("Leads View Buyer New"), "newer lead should render");
  assert.ok(html.includes("Leads View Buyer Old"), "older lead should render");
  assert.ok(html.includes("Admin Leads Item A"), "item A title should render");
  assert.ok(html.includes("Admin Leads Item B"), "item B title should render");

  const indexNew = html.indexOf("Leads View Buyer New");
  const indexOld = html.indexOf("Leads View Buyer Old");
  assert.ok(indexNew >= 0 && indexOld >= 0 && indexNew < indexOld, "newer lead should appear before older lead");

  assert.ok(html.includes("₹4,500"), "expected price for item A should render");
  assert.ok(html.includes("₹9,200"), "expected price for item B should render");
  assert.ok(html.includes("₹4,000"), "bid price for older lead should render");
  assert.ok(html.includes("₹8,700"), "bid price for newer lead should render");

  assert.ok(html.includes("Export leads CSV"), "export CTA should render");
  assert.ok(html.includes("/api/admin/leads/export"), "leads export href should render");
}

async function assertSearchFilter(cookieHeader) {
  const html = await fetchAdminLeadsPage(cookieHeader, `?q=${encodeURIComponent("Buyer New")}`);

  assert.ok(html.includes("Leads View Buyer New"), "search should keep matching buyer");
  assert.ok(!html.includes("Leads View Buyer Old"), "search should hide non-matching buyer");
}

async function assertItemFilter(cookieHeader, itemId) {
  const html = await fetchAdminLeadsPage(cookieHeader, `?itemId=${encodeURIComponent(itemId)}`);

  assert.ok(html.includes("Leads View Buyer Old"), "item filter should keep matching lead");
  assert.ok(!html.includes("Leads View Buyer New"), "item filter should hide non-matching lead");
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
      seedDescription: "Disposable row inserted by admin leads view flow.",
    });

    appProcess = await startApp(config);
    await waitForApp(appBaseUrl);

    log("Seeding items and timestamped leads for admin list checks");
    const seeded = await seedItemsAndLeads();

    log("Logging in and verifying default sort plus expected/bid price columns");
    const cookieHeader = await loginAsAdmin(config);
    await assertDefaultSortAndPrices(cookieHeader);

    log("Verifying admin leads query and item filters");
    await assertSearchFilter(cookieHeader);
    await assertItemFilter(cookieHeader, seeded.itemA.id);

    log("E2E admin leads view flow completed successfully");
  } finally {
    await cleanupRun({ appProcess, rootDir, appPort, containerName });
  }
}

main().catch((error) => {
  process.stderr.write(`\n[e2e] ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
