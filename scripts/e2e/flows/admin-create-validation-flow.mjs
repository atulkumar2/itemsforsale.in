/**
 * E2E: Admin item create validation
 *
 * Covers:
 * - Missing title rejected (400)
 * - Invalid date format rejected (400)
 * - Invalid status rejected (400)
 * - Oversized number fields rejected (400)
 * - Title too long rejected (400)
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
} from "../flow-common.mjs";

const config = getPostgresE2EConfig();

async function assertMissingTitleRejected(appBaseUrl, adminCookie) {
  const fd = new FormData();
  fd.set("title", "");
  fd.set("description", "Test description");
  fd.set("category", "Testing");
  fd.set("condition", "Great");
  fd.set("purchaseDate", "2024-01-01");
  fd.set("purchasePrice", "1000");
  fd.set("expectedPrice", "800");
  fd.set("availableFrom", "2026-01-01");
  fd.set("status", "available");

  const res = await fetch(`${appBaseUrl}/api/admin/items`, {
    method: "POST",
    headers: { Cookie: adminCookie },
    body: fd,
  });

  assert.strictEqual(res.status, 400, `Expected 400 for empty title, got ${res.status}`);
  const json = await res.json();
  assert(json.error.includes("Title is required"), `Expected title error, got: ${json.error}`);
  console.log("[e2e] Verified missing title rejected with 400");
}

async function assertInvalidDateRejected(appBaseUrl, adminCookie) {
  const fd = new FormData();
  fd.set("title", "Test Item");
  fd.set("description", "Test description");
  fd.set("category", "Testing");
  fd.set("condition", "Great");
  fd.set("purchaseDate", "01/01/2024");
  fd.set("expectedPrice", "800");
  fd.set("availableFrom", "2026-01-01");
  fd.set("status", "available");

  const res = await fetch(`${appBaseUrl}/api/admin/items`, {
    method: "POST",
    headers: { Cookie: adminCookie },
    body: fd,
  });

  assert.strictEqual(res.status, 400, `Expected 400 for invalid date, got ${res.status}`);
  const json = await res.json();
  assert(
    json.error.includes("Use YYYY-MM-DD format"),
    `Expected date format error, got: ${json.error}`,
  );
  console.log("[e2e] Verified invalid date format rejected with 400");
}

async function assertInvalidStatusRejected(appBaseUrl, adminCookie) {
  const fd = new FormData();
  fd.set("title", "Test Item");
  fd.set("description", "Test description");
  fd.set("category", "Testing");
  fd.set("condition", "Great");
  fd.set("status", "invalid_status");

  const res = await fetch(`${appBaseUrl}/api/admin/items`, {
    method: "POST",
    headers: { Cookie: adminCookie },
    body: fd,
  });

  assert.strictEqual(res.status, 400, `Expected 400 for invalid status, got ${res.status}`);
  console.log("[e2e] Verified invalid status rejected with 400");
}

async function assertOversizedNumberRejected(appBaseUrl, adminCookie) {
  const fd = new FormData();
  fd.set("title", "Test Item");
  fd.set("description", "Test description");
  fd.set("category", "Testing");
  fd.set("condition", "Great");
  fd.set("purchasePrice", "123456789012345");
  fd.set("status", "available");

  const res = await fetch(`${appBaseUrl}/api/admin/items`, {
    method: "POST",
    headers: { Cookie: adminCookie },
    body: fd,
  });

  assert.strictEqual(res.status, 400, `Expected 400 for oversized number, got ${res.status}`);
  const json = await res.json();
  assert(
    json.error.includes("price is too long"),
    `Expected price length error, got: ${json.error}`,
  );
  console.log("[e2e] Verified oversized number field rejected with 400");
}

async function assertTitleTooLongRejected(appBaseUrl, adminCookie) {
  const longTitle = "A".repeat(201);
  const fd = new FormData();
  fd.set("title", longTitle);
  fd.set("description", "Test description");
  fd.set("category", "Testing");
  fd.set("condition", "Great");
  fd.set("status", "available");

  const res = await fetch(`${appBaseUrl}/api/admin/items`, {
    method: "POST",
    headers: { Cookie: adminCookie },
    body: fd,
  });

  assert.strictEqual(res.status, 400, `Expected 400 for title too long, got ${res.status}`);
  const json = await res.json();
  assert(json.error.includes("Title is too long"), `Expected title length error, got: ${json.error}`);
  console.log("[e2e] Verified title too long rejected with 400");
}

async function main() {
  console.log("[e2e] E2E PostgreSQL admin create validation flow started");

  await ensureDockerAvailable();
  await preflightCleanup(config);

  let appProcess;
  try {
    await startPostgresContainer(config);
    await waitForPostgres(config.databaseUrl);
    await applySchemaAndSeedData({
      databaseUrl: config.databaseUrl,
      rootDir: config.rootDir,
      seedDescription: "e2e-create-validation dummy seed",
    });

    appProcess = await startApp(config);
    await waitForApp(config.appBaseUrl);

    const adminCookie = await loginAsAdmin(config);

    console.log("[e2e] Verifying item creation input validation");
    await assertMissingTitleRejected(config.appBaseUrl, adminCookie);
    await assertInvalidDateRejected(config.appBaseUrl, adminCookie);
    await assertInvalidStatusRejected(config.appBaseUrl, adminCookie);
    await assertOversizedNumberRejected(config.appBaseUrl, adminCookie);
    await assertTitleTooLongRejected(config.appBaseUrl, adminCookie);

    console.log("[e2e] E2E PostgreSQL admin create validation flow completed successfully");
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
