import { strict as assert } from "node:assert";

import { Client } from "pg";
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
 * End-to-end admin delete flow against disposable PostgreSQL.
 *
 * Coverage:
 * - admin login with captcha
 * - create then delete an item
 * - verify DB rows are removed
 * - verify uploaded files are deleted from local storage
 * - verify public route resolves to not-found state
 */

const config = getPostgresE2EConfig();
const { appBaseUrl, appPort, containerName, databaseUrl, rootDir } = config;

let appProcess = null;
let createdItemId = null;

async function createItem(cookieHeader) {
  log("Creating an item that will be deleted");
  const form = new FormData();
  form.set("title", "E2E Postgres Delete Test Chair");
  form.set("description", "Created by the disposable end-to-end PostgreSQL delete flow.");
  form.set("category", "Testing");
  form.set("condition", "Great");
  form.set("purchaseDate", "2024-02-15");
  form.set("purchasePrice", "12000");
  form.set("expectedPrice", "8000");
  form.set("availableFrom", "2026-05-01");
  form.set("locationArea", "Delete flow location");
  form.set("status", "available");
  form.append("images", await createImageFile("delete-red.png", { r: 210, g: 90, b: 90 }));
  form.append("images", await createImageFile("delete-blue.png", { r: 80, g: 120, b: 220 }));

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
      `select id, slug, title
       from items
       where id = $1`,
      [itemId],
    );

    const imageResult = await client.query(
      `select id, image_url, thumbnail_url
       from item_images
       where item_id = $1
       order by sort_order asc, created_at asc`,
      [itemId],
    );

    return {
      item: itemResult.rows[0] ?? null,
      images: imageResult.rows,
    };
  } finally {
    await client.end();
  }
}

async function deleteItem(cookieHeader, itemId) {
  log("Deleting item through admin delete API route");
  const response = await fetch(`${appBaseUrl}/api/admin/items/${itemId}`, {
    method: "DELETE",
    headers: {
      Cookie: cookieHeader,
    },
  });

  assert.equal(response.status, 200, "item delete should succeed");
  const payload = await response.json();
  assert.equal(payload.message, "Item deleted.");
}

async function verifyDeleteScenario(cookieHeader, itemId) {
  log("Verifying DB rows and image files are removed after delete");
  const beforeDelete = await getItemState(itemId);
  assert.ok(beforeDelete.item, "item should exist before delete");
  assert.ok(beforeDelete.images.length > 0, "item should have at least one image before delete");

  for (const image of beforeDelete.images) {
    await assertFileExists(rootDir, image.image_url);
    await assertFileExists(rootDir, image.thumbnail_url);
  }

  const itemSlug = beforeDelete.item.slug;
  await deleteItem(cookieHeader, itemId);

  const afterDelete = await getItemState(itemId);
  assert.equal(afterDelete.item, null, "item row should be removed");
  assert.equal(afterDelete.images.length, 0, "item image rows should be removed");

  for (const image of beforeDelete.images) {
    await assertFileMissing(rootDir, image.image_url);
    await assertFileMissing(rootDir, image.thumbnail_url);
  }

  const publicItemResponse = await fetch(`${appBaseUrl}/items/${itemSlug}`);
  const publicItemHtml = await publicItemResponse.text();
  assert.ok(
    publicItemResponse.status === 404 || publicItemResponse.status === 200,
    "public item page should return not-found state after delete",
  );
  assert.match(publicItemHtml, /That item or page does not exist\./);
}

/**
 * Runs the full E2E delete scenario and always performs teardown.
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
      seedDescription: "Disposable row inserted by the end-to-end admin delete flow test.",
    });
    appProcess = await startApp(config);
    await waitForApp(appBaseUrl);

    const cookieHeader = await loginAsAdmin(config);
    const itemId = await createItem(cookieHeader);
    await verifyDeleteScenario(cookieHeader, itemId);

    log("E2E PostgreSQL admin delete flow completed successfully");
  } finally {
    await cleanupRun({ appProcess, createdItemId, rootDir, appPort, containerName });
  }
}

main().catch((error) => {
  process.stderr.write(`\n[e2e] ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
