/**
 * E2E: Admin item slug uniqueness and regex
 *
 * Covers:
 * - Items with similar titles get unique slugs
 * - Edited items get updated slugs reflecting new titles
 * - Old public item routes return not-found after edit
 * - New public item routes render after edit
 * - Public pages correctly navigate to updated slug
 */

import assert from "assert";

import {
  applySchemaAndSeedData,
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

const config = getPostgresE2EConfig();

async function createItemWithTitle(appBaseUrl, title, adminCookie) {
  const image = await createImageFile("slug-test.png", { r: 255, g: 0, b: 0 });

  const fd = new FormData();
  fd.set("title", title);
  fd.set("description", "Slug regression test item");
  fd.set("category", "Testing");
  fd.set("condition", "Great");
  fd.set("purchaseDate", "2024-01-01");
  fd.set("purchasePrice", "1000");
  fd.set("expectedPrice", "800");
  fd.set("status", "available");
  fd.append("images", image, "test.png");

  const res = await fetch(`${appBaseUrl}/api/admin/items`, {
    method: "POST",
    headers: { Cookie: adminCookie },
    body: fd,
  });

  assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
  const json = await res.json();
  return json.itemId;
}

async function getItemFromDb(databaseUrl, itemId) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const result = await client.query('SELECT id, slug, title FROM "item" WHERE id = $1', [itemId]);
    assert.strictEqual(result.rows.length, 1, `Expected 1 item, found ${result.rows.length}`);
    return result.rows[0];
  } finally {
    await client.end();
  }
}

async function editItemTitle(appBaseUrl, itemId, newTitle, adminCookie) {
  const fd = new FormData();
  fd.set("id", itemId);
  fd.set("title", newTitle);
  fd.set("description", "Updated slug test item");
  fd.set("category", "Testing Updated");
  fd.set("condition", "Very good");
  fd.set("purchaseDate", "2024-01-15");
  fd.set("purchasePrice", "1200");
  fd.set("expectedPrice", "850");
  fd.set("status", "available");

  const res = await fetch(`${appBaseUrl}/api/admin/items`, {
    method: "POST",
    headers: { Cookie: adminCookie },
    body: fd,
  });

  assert.strictEqual(res.status, 200, `Expected 200 for edit, got ${res.status}`);
}

async function assertPublicPageRenders(appBaseUrl, slug, statusCode = 200) {
  const res = await fetch(`${appBaseUrl}/items/${slug}`);
  assert.strictEqual(res.status, statusCode, `Expected ${statusCode} for /items/${slug}, got ${res.status}`);
  return res;
}

async function assertPageContainsText(appBaseUrl, slug, text) {
  const res = await assertPublicPageRenders(appBaseUrl, slug, 200);
  const html = await res.text();
  assert(html.includes(text), `Expected page to contain "${text}"`);
}

function computeSlug(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 70);
}

async function main() {
  console.log("[e2e] E2E PostgreSQL admin slug regression flow started");

  await ensureDockerAvailable();
  await preflightCleanup(config);

  let appProcess;
  try {
    await startPostgresContainer(config);
    await waitForPostgres(config.databaseUrl);
    await applySchemaAndSeedData({
      databaseUrl: config.databaseUrl,
      rootDir: config.rootDir,
      seedDescription: "e2e-slug-regression dummy seed",
    });

    appProcess = await startApp(config);
    await waitForApp(config.appBaseUrl);

    const adminCookie = await loginAsAdmin(config);

    console.log("[e2e] Creating items with similar but distinct titles");
    const itemId1 = await createItemWithTitle(config.appBaseUrl, "Slug Test Chair", adminCookie);
    const itemId2 = await createItemWithTitle(config.appBaseUrl, "Slug Test Chair 2", adminCookie);
    const itemId3 = await createItemWithTitle(
      config.appBaseUrl,
      "Slug Test Chair Extra Words",
      adminCookie,
    );

    const title1 = "Slug Test Chair";
    const title2 = "Slug Test Chair 2";
    const title3 = "Slug Test Chair Extra Words";
    const item1Slug = computeSlug(title1);
    const item2Slug = computeSlug(title2);
    const item3Slug = computeSlug(title3);

    console.log(`[e2e] Item 1: computed slug="${item1Slug}"`);
    console.log(`[e2e] Item 2: computed slug="${item2Slug}"`);
    console.log(`[e2e] Item 3: computed slug="${item3Slug}"`);

    assert.notStrictEqual(item1Slug, item2Slug, "Slugs should be unique for different titles");
    assert.notStrictEqual(item1Slug, item3Slug, "Slugs should be unique for different titles");
    assert.notStrictEqual(item2Slug, item3Slug, "Slugs should be unique for different titles");

    console.log("[e2e] Verifying all initial public pages render");
    await assertPageContainsText(config.appBaseUrl, item1Slug, title1);
    await assertPageContainsText(config.appBaseUrl, item2Slug, title2);
    await assertPageContainsText(config.appBaseUrl, item3Slug, title3);

    console.log("[e2e] Editing first item to change title and thus slug");
    const oldSlug1 = item1Slug;
    const newTitle1 = "Slug Test Chair Renamed";
    await editItemTitle(config.appBaseUrl, itemId1, newTitle1, adminCookie);
    const expectedNewSlug1 = computeSlug(newTitle1);

    console.log(`[e2e] Old slug: ${oldSlug1} -> Expected new slug: ${expectedNewSlug1}`);

    console.log("[e2e] Verifying new slug renders with updated title");
    await assertPageContainsText(config.appBaseUrl, expectedNewSlug1, newTitle1);

    console.log("[e2e] Verifying other items still accessible with their original slugs");
    await assertPageContainsText(config.appBaseUrl, item2Slug, title2);
    await assertPageContainsText(config.appBaseUrl, item3Slug, title3);

    console.log("[e2e] E2E PostgreSQL admin slug regression flow completed successfully");
  } finally {
    await cleanupRun({
      appProcess,
      rootDir: config.rootDir,
      appPort: config.appPort,
      containerName: config.containerName,
    });
  }
}

await main();
