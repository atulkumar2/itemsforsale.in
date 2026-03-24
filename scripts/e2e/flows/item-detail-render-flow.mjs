import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";

import { Client } from "pg";

import { log } from "../helpers.mjs";
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
} from "../flow-common.mjs";

/**
 * End-to-end item detail render flow.
 *
 * Coverage:
 * - seed one public item with multiple photos
 * - verify item detail metadata and gallery thumbnails render
 * - verify enquiry form defaults and captcha selector render
 */

const config = getPostgresE2EConfig();
const { appBaseUrl, appPort, containerName, databaseUrl, rootDir } = config;

let appProcess = null;

async function seedItemWithImages() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const itemId = randomUUID();
    const now = new Date().toISOString();
    const slug = "item-detail-render-item";
    const title = "Item Detail Render Item";

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
        slug,
        title,
        "Seeded for item detail render E2E flow.",
        "Rendering",
        "Very good",
        "2024-02-01",
        12500,
        7900,
        "2026-05-12",
        "Koramangala",
        "available",
        now,
        now,
      ],
    );

    const images = [
      {
        id: randomUUID(),
        imageUrl: "/uploads/e2e/item-detail-render/photo-1.webp",
        sortOrder: 0,
      },
      {
        id: randomUUID(),
        imageUrl: "/uploads/e2e/item-detail-render/photo-2.webp",
        sortOrder: 1,
      },
      {
        id: randomUUID(),
        imageUrl: "/uploads/e2e/item-detail-render/photo-3.webp",
        sortOrder: 2,
      },
    ];

    for (const image of images) {
      await client.query(
        `insert into item_images (id, item_id, image_url, sort_order, created_at)
         values ($1, $2, $3, $4, $5)`,
        [image.id, itemId, image.imageUrl, image.sortOrder, now],
      );
    }

    return { slug, title };
  } finally {
    await client.end();
  }
}

async function assertItemDetailHtml(slug, title) {
  const response = await fetch(`${appBaseUrl}/items/${slug}`);
  assert.equal(response.status, 200, `item detail page should return 200, got ${response.status}`);

  const html = await response.text();

  assert.ok(html.includes(title), "item title should render on detail page");
  assert.ok(html.includes("Seeded for item detail render E2E flow."), "item description should render");

  assert.ok(html.includes("Item detail"), "item detail section heading should render");
  assert.ok(html.includes("Expected price"), "expected price label should render");
  assert.ok(html.includes("Purchase price"), "purchase price label should render");
  assert.ok(html.includes("Purchase date"), "purchase date label should render");
  assert.ok(html.includes("Available from"), "available from label should render");
  assert.ok(html.includes("Koramangala"), "location text should render for populated locationArea");
  assert.ok(!html.includes("See seller location and contact details"), "location fallback link should not render");

  assert.ok(html.includes(`${title} thumbnail`), "gallery thumbnail alt text should render");
  assert.ok(html.includes("/uploads/e2e/item-detail-render/photo-"), "gallery image URLs should render");

  assert.ok(html.includes("Ask about this item"), "interest section title should render");
  assert.ok(html.includes("Submit interest"), "interest submit button should render");
  assert.ok(html.includes("Select the correct answer"), "captcha answer selector should render");
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
      seedDescription: "Disposable row inserted by item detail render flow.",
    });

    appProcess = await startApp(config);
    await waitForApp(appBaseUrl);

    log("Seeding one item with multiple photos for item detail rendering");
    const { slug, title } = await seedItemWithImages();

    log("Verifying item detail metadata, gallery, and enquiry form rendering");
    await assertItemDetailHtml(slug, title);

    log("E2E item detail render flow completed successfully");
  } finally {
    await cleanupRun({ appProcess, rootDir, appPort, containerName });
  }
}

main().catch((error) => {
  process.stderr.write(`\n[e2e] ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
