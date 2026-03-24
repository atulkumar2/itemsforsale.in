import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";

import { Client } from "pg";

import { log } from "./helpers.mjs";
import {
  applySchemaAndSeedData,
  cleanupRun,
  ensureDockerAvailable,
  getPostgresE2EConfig,
  preflightCleanup,
  startApp,
  startPostgresContainer,
  waitForApp,
  waitForPostgres,
} from "./flow-common.mjs";

/**
 * End-to-end catalogue render flow.
 *
 * Coverage:
 * - seed items in available, reserved, and sold states
 * - verify public catalogue renders seeded items and status badges
 * - verify catalogue controls and export entrypoint render
 */

const config = getPostgresE2EConfig();
const { appBaseUrl, appPort, containerName, databaseUrl, rootDir } = config;

let appProcess = null;

async function seedCatalogueItems() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const now = new Date().toISOString();
    const items = [
      {
        id: randomUUID(),
        slug: "catalogue-render-available-item",
        title: "Catalogue Render Available Item",
        status: "available",
      },
      {
        id: randomUUID(),
        slug: "catalogue-render-reserved-item",
        title: "Catalogue Render Reserved Item",
        status: "reserved",
      },
      {
        id: randomUUID(),
        slug: "catalogue-render-sold-item",
        title: "Catalogue Render Sold Item",
        status: "sold",
      },
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
          "Seeded for catalogue render E2E flow.",
          "Rendering",
          "Great",
          "2024-01-10",
          11000,
          7800,
          "2026-05-01",
          "BTM Layout",
          item.status,
          now,
          now,
        ],
      );
    }
  } finally {
    await client.end();
  }
}

async function assertCatalogueHtml() {
  const response = await fetch(`${appBaseUrl}/`);
  assert.equal(response.status, 200, `catalogue page should return 200, got ${response.status}`);

  const html = await response.text();

  assert.ok(html.includes("Active catalogue"), "catalogue heading should render");
  assert.ok(html.includes("Catalogue Render Available Item"), "available seeded item should render");
  assert.ok(html.includes("Catalogue Render Reserved Item"), "reserved seeded item should render");
  assert.ok(html.includes("Catalogue Render Sold Item"), "sold seeded item should render");

  assert.ok(html.includes(">available<"), "available status badge should render");
  assert.ok(html.includes(">reserved<"), "reserved status badge should render");
  assert.ok(html.includes(">sold<"), "sold status badge should render");

  assert.ok(html.includes("aria-label=\"Grid view\""), "grid view control should render");
  assert.ok(html.includes("aria-label=\"Table view\""), "table view control should render");
  assert.ok(html.includes("/api/catalogue/export"), "catalogue export link should render");
  assert.ok(
    html.includes("select multiple items") || html.includes("selected items"),
    "selection guidance text should render",
  );
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
      seedDescription: "Disposable row inserted by catalogue render flow.",
    });

    appProcess = await startApp(config);
    await waitForApp(appBaseUrl);

    log("Seeding available/reserved/sold items for catalogue render checks");
    await seedCatalogueItems();

    log("Verifying catalogue rendering and read-only controls");
    await assertCatalogueHtml();

    log("E2E catalogue render flow completed successfully");
  } finally {
    await cleanupRun({ appProcess, rootDir, appPort, containerName });
  }
}

main().catch((error) => {
  process.stderr.write(`\n[e2e] ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
