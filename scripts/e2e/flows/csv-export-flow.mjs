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
 * End-to-end CSV export flow.
 *
 * Coverage:
 * - seed representative catalogue and lead data
 * - verify public catalogue CSV export headers and data rows
 * - verify admin leads CSV export headers and data rows
 * - verify CSV escaping for commas, quotes, formulas, and newlines
 */

const config = getPostgresE2EConfig();
const { appBaseUrl, appPort, containerName, databaseUrl, rootDir } = config;

let appProcess = null;

async function seedExportData() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const now = new Date().toISOString();

    const item = {
      id: randomUUID(),
      slug: "csv-export-special-item",
      title: "CSV \"Special\", Item",
      category: "CSV,Category",
      condition: "Great",
      expectedPrice: 12345,
      locationArea: "HSR, Layout",
      status: "available",
    };

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
        "Seeded for CSV export E2E flow.",
        item.category,
        item.condition,
        "2024-01-01",
        15555,
        item.expectedPrice,
        "2026-05-01",
        item.locationArea,
        item.status,
        now,
        now,
      ],
    );

    const lead = {
      id: randomUUID(),
      buyerName: 'CSV Buyer, "Quoted"',
      phone: "9988776655",
      email: "csv-export@example.com",
      bidPrice: 11111,
      message: '=SUM(1,2), "quoted"\nLine2 with comma, and text',
      createdAt: new Date(Date.now() - 30_000).toISOString(),
    };

    await client.query(
      `insert into leads (id, item_id, buyer_name, phone, email, message, bid_price, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        lead.id,
        item.id,
        lead.buyerName,
        lead.phone,
        lead.email,
        lead.message,
        lead.bidPrice,
        lead.createdAt,
      ],
    );

    return { item, lead };
  } finally {
    await client.end();
  }
}

function assertCsvHeaders(response, expectedFileName) {
  const contentType = response.headers.get("Content-Type") ?? "";
  const contentDisposition = response.headers.get("Content-Disposition") ?? "";

  assert.ok(contentType.includes("text/csv"), `expected CSV content type, got ${contentType}`);
  assert.ok(
    contentDisposition.includes(`filename=\"${expectedFileName}\"`),
    `expected CSV filename ${expectedFileName}, got ${contentDisposition}`,
  );
}

async function assertPublicCsvExport(item) {
  const response = await fetch(`${appBaseUrl}/api/catalogue/export`);
  assert.equal(response.status, 200, `public CSV export should return 200, got ${response.status}`);
  assertCsvHeaders(response, "catalogue-export.csv");

  const csv = await response.text();

  assert.ok(
    csv.startsWith("id,title,status,category,condition,expectedPrice,locationArea,updatedAt,itemLink"),
    "public CSV header should match expected columns",
  );

  assert.ok(csv.includes('"CSV ""Special"", Item"'), "public CSV should escape quotes and commas in title");
  assert.ok(csv.includes('"CSV,Category"'), "public CSV should quote category with comma");
  assert.ok(csv.includes('"HSR, Layout"'), "public CSV should quote location with comma");
  assert.ok(csv.includes(`"${item.slug}"`) || csv.includes(item.slug), "public CSV should include seeded item slug");
  assert.ok(csv.includes(`/items/${item.slug}`), "public CSV should include item link path for seeded item");
}

async function assertAdminLeadsCsvExport(item, lead) {
  const cookieHeader = await loginAsAdmin(config);

  const response = await fetch(`${appBaseUrl}/api/admin/leads/export?itemId=${encodeURIComponent(item.id)}`, {
    headers: { Cookie: cookieHeader },
  });

  assert.equal(response.status, 200, `admin leads CSV export should return 200, got ${response.status}`);
  assertCsvHeaders(response, "leads-export.csv");

  const csv = await response.text();

  assert.ok(
    csv.startsWith("id,buyerName,phone,email,location,itemTitle,itemSlug,bidPrice,message,createdAt"),
    "admin CSV header should match expected columns",
  );

  assert.ok(csv.includes(`"${lead.id}"`), "admin CSV should include seeded lead id");
  assert.ok(csv.includes('"CSV Buyer, ""Quoted"""'), "admin CSV should escape buyerName quotes and commas");
  assert.ok(csv.includes('""'), "admin CSV should render empty location column when not provided");
  assert.ok(
    csv.includes('"\'=SUM(1,2), ""quoted""\nLine2 with comma, and text"') ||
      csv.includes('"\'=SUM(1,2), ""quoted""\r\nLine2 with comma, and text"'),
    "admin CSV should neutralize formula-like message and preserve multiline escaping",
  );
  assert.ok(csv.includes(`"${item.slug}"`), "admin CSV should include seeded item slug");
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
      seedDescription: "Disposable row inserted by CSV export flow.",
    });

    appProcess = await startApp(config);
    await waitForApp(appBaseUrl);

    log("Seeding representative item and lead rows for CSV export checks");
    const { item, lead } = await seedExportData();

    log("Verifying public catalogue CSV export headers and escaping");
    await assertPublicCsvExport(item);

    log("Verifying admin leads CSV export headers and escaping");
    await assertAdminLeadsCsvExport(item, lead);

    log("E2E CSV export flow completed successfully");
  } finally {
    await cleanupRun({ appProcess, rootDir, appPort, containerName });
  }
}

main().catch((error) => {
  process.stderr.write(`\n[e2e] ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
