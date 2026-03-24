import { strict as assert } from "node:assert";

import { Client, types } from "pg";
import { log } from "./helpers.mjs";
import {
  applySchemaAndSeedData,
  assertFileExists,
  assertFileMissing,
  cleanupRun,
  createImageFile,
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
 * End-to-end admin CRUD flow against disposable PostgreSQL.
 *
 * Coverage:
 * - app boot with DATA_MODE=postgres
 * - admin login with captcha
 * - item create/edit with image upload/delete
 * - public item page rendering checks
 * - deterministic teardown of app/container/files
 */

// Configure pg to return DATE columns as strings instead of Date objects
// Type OID 1082 is DATE type in PostgreSQL
types.setTypeParser(1082, (value) => value);

const config = getPostgresE2EConfig();
const { appBaseUrl, appPort, containerName, databaseUrl, rootDir } = config;

let appProcess = null;
let createdItemId = null;

async function createItem(cookieHeader) {
  log("Creating a new admin item with three uploaded photos");
  const form = new FormData();
  form.set("title", "E2E Postgres Test Chair");
  form.set("description", "Created by the disposable end-to-end PostgreSQL flow.");
  form.set("category", "Testing");
  form.set("condition", "Great");
  form.set("purchaseDate", "2024-02-15");
  form.set("purchasePrice", "12000");
  form.set("expectedPrice", "8000");
  form.set("availableFrom", "2026-05-01");
  form.set("locationArea", "");
  form.set("status", "available");
  form.append("images", await createImageFile("chair-red.png", { r: 210, g: 90, b: 90 }));
  form.append("images", await createImageFile("chair-green.png", { r: 90, g: 180, b: 120 }));
  form.append("images", await createImageFile("chair-blue.png", { r: 80, g: 120, b: 220 }));

  const response = await fetch(`${appBaseUrl}/api/admin/items`, {
    method: "POST",
    headers: {
      Cookie: cookieHeader,
    },
    body: form,
  });

  assert.equal(response.status, 200, "item create should succeed");
  const payload = await response.json();
  assert.ok(payload.itemId, "create route should return itemId");
  createdItemId = payload.itemId;
  return payload.itemId;
}

async function getItemState(itemId) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const itemResult = await client.query(
      `select id, slug, title, description, category, condition, purchase_date, purchase_price,
              expected_price, available_from, location_area, status
         from items
         where id = $1`,
      [itemId],
    );
    const imageResult = await client.query(
      `select id, image_url, thumbnail_url, sort_order
         from item_images
         where item_id = $1
         order by sort_order asc, created_at asc`,
      [itemId],
    );
    const item = itemResult.rows[0] ?? null;
    if (item) {
      log(`DEBUG: available_from from DB: "${item.available_from}" (type: ${typeof item.available_from})`);
      log(`DEBUG: full item: ${JSON.stringify(item, null, 2)}`);
    }
    return {
      item,
      images: imageResult.rows,
    };
  } finally {
    await client.end();
  }
}

async function editItem(cookieHeader, itemId, existingImages) {
  log("Editing the item, removing one image, and adding a replacement image");
  const [removedImage] = existingImages;
  assert.ok(removedImage, "expected an image to remove during edit");

  const form = new FormData();
  form.set("id", itemId);
  form.set("title", "E2E Postgres Test Chair Updated");
  form.set("description", "Updated by the disposable end-to-end PostgreSQL flow.");
  form.set("category", "Testing Updated");
  form.set("condition", "Very good");
  form.set("purchaseDate", "2024-03-01");
  form.set("purchasePrice", "12500");
  form.set("expectedPrice", "7600");
  form.set("availableFrom", "2026-05-12");
  form.set("locationArea", "Seller fallback page expected");
  form.set("status", "reserved");
  form.append("removeImageIds", removedImage.id);
  form.append("images", await createImageFile("chair-yellow.png", { r: 230, g: 190, b: 70 }));

  const response = await fetch(`${appBaseUrl}/api/admin/items`, {
    method: "POST",
    headers: {
      Cookie: cookieHeader,
    },
    body: form,
  });

  assert.equal(response.status, 200, "item edit should succeed");
  await response.json();
  return removedImage;
}

async function verifyScenario(itemId, removedImage) {
  log("Verifying item updates, image mutations, and public item page rendering");
  const afterEdit = await getItemState(itemId);
  assert.ok(afterEdit.item, "edited item should still exist");
  assert.equal(afterEdit.item.title, "E2E Postgres Test Chair Updated");
  assert.equal(afterEdit.item.category, "Testing Updated");
  assert.equal(afterEdit.item.condition, "Very good");
  assert.equal(afterEdit.item.status, "reserved");
  assert.equal(String(afterEdit.item.expected_price), "7600.00");
  assert.equal(afterEdit.item.available_from.toISOString?.()?.slice?.(0, 10) ?? String(afterEdit.item.available_from).slice(0, 10), "2026-05-12");
  assert.equal(afterEdit.images.length, 3, "three images should remain after one delete and one add");
  assert.ok(!afterEdit.images.some((image) => image.id === removedImage.id), "removed image row should be gone");
  assert.deepEqual(
    afterEdit.images.map((image) => image.sort_order),
    [0, 1, 2],
    "sort order should be compact after removal and insert",
  );

  for (const image of afterEdit.images) {
    await assertFileExists(rootDir, image.image_url);
    await assertFileExists(rootDir, image.thumbnail_url);
  }
  await assertFileMissing(rootDir, removedImage.image_url);
  await assertFileMissing(rootDir, removedImage.thumbnail_url);

  const publicItemResponse = await fetch(`${appBaseUrl}/items/${afterEdit.item.slug}`);
  assert.equal(publicItemResponse.status, 200, "public item page should render");
  const publicItemHtml = await publicItemResponse.text();
  assert.match(publicItemHtml, /E2E Postgres Test Chair Updated/);
  assert.match(publicItemHtml, /Seller fallback page expected/);
}

/**
 * Runs the full E2E flow and always performs teardown.
 */
async function main() {
  try {
    await preflightCleanup(config);
    await ensureDockerAvailable(rootDir);
    await startPostgresContainer(config);
    await waitForPostgres(databaseUrl);
    await applySchemaAndSeedData({
      databaseUrl,
      rootDir,
      seedDescription: "Disposable row inserted by the end-to-end admin flow test.",
    });
    appProcess = await startApp(config);
    await waitForApp(appBaseUrl);

    const cookieHeader = await loginAsAdmin(config);
    const itemId = await createItem(cookieHeader);
    const afterCreate = await getItemState(itemId);
    assert.ok(afterCreate.item, "created item should exist");
    assert.equal(afterCreate.item.title, "E2E Postgres Test Chair");
    assert.equal(afterCreate.images.length, 3, "create flow should persist three images");

    for (const image of afterCreate.images) {
      await assertFileExists(rootDir, image.image_url);
      await assertFileExists(rootDir, image.thumbnail_url);
    }

    const removedImage = await editItem(cookieHeader, itemId, afterCreate.images);
    await verifyScenario(itemId, removedImage);

    log("E2E PostgreSQL admin flow completed successfully");
  } finally {
    await cleanupRun({ appProcess, createdItemId, rootDir, appPort, containerName });
  }
}

main().catch((error) => {
  process.stderr.write(`\n[e2e] ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
