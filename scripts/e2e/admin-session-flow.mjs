import { strict as assert } from "node:assert";

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
 * End-to-end admin session flow.
 *
 * Coverage:
 * - one login session can be reused for multiple admin mutations
 * - logout clears browser access for subsequent requests
 * - tampered session cookies are rejected
 */

const config = getPostgresE2EConfig();
const { appBaseUrl, appPort, containerName, databaseUrl, rootDir } = config;

let appProcess = null;
let createdItemId = null;

async function createAdminItem(cookieHeader, title) {
  const form = new FormData();
  form.set("title", title);
  form.set("description", "Created by admin session E2E flow.");
  form.set("category", "Testing");
  form.set("condition", "Great");
  form.set("purchaseDate", "2024-02-01");
  form.set("purchasePrice", "5000");
  form.set("expectedPrice", "4200");
  form.set("availableFrom", "2026-05-10");
  form.set("locationArea", "Session flow test area");
  form.set("status", "available");

  const response = await fetch(`${appBaseUrl}/api/admin/items`, {
    method: "POST",
    headers: { Cookie: cookieHeader },
    body: form,
  });

  assert.equal(response.status, 200, `item create should succeed with session, got ${response.status}`);
  const payload = await response.json();
  assert.ok(payload.itemId, "create response should return itemId");
  createdItemId = payload.itemId;
  return payload.itemId;
}

async function editAdminItem(cookieHeader, itemId, title) {
  const form = new FormData();
  form.set("id", itemId);
  form.set("title", title);
  form.set("description", "Updated by admin session E2E flow.");
  form.set("category", "Testing Updated");
  form.set("condition", "Very good");
  form.set("purchaseDate", "2024-02-05");
  form.set("purchasePrice", "5100");
  form.set("expectedPrice", "4300");
  form.set("availableFrom", "2026-05-12");
  form.set("locationArea", "Session flow updated area");
  form.set("status", "reserved");

  const response = await fetch(`${appBaseUrl}/api/admin/items`, {
    method: "POST",
    headers: { Cookie: cookieHeader },
    body: form,
  });

  assert.equal(response.status, 200, `item edit should succeed with session, got ${response.status}`);
}

async function deleteAdminItem(cookieHeader, itemId, expectedStatus = 200) {
  const response = await fetch(`${appBaseUrl}/api/admin/items/${itemId}`, {
    method: "DELETE",
    ...(cookieHeader ? { headers: { Cookie: cookieHeader } } : {}),
  });

  assert.equal(
    response.status,
    expectedStatus,
    `delete expected ${expectedStatus}, got ${response.status}`,
  );

  return response;
}

function tamperSessionCookie(cookieHeader) {
  const match = cookieHeader.match(/itemsforsale-admin-session=([^;]+)/);
  assert.ok(match?.[1], "session cookie should exist before tampering");
  const original = match[1];
  const tampered = `${original.slice(0, -1)}${original.endsWith("a") ? "b" : "a"}`;
  return cookieHeader.replace(`itemsforsale-admin-session=${original}`, `itemsforsale-admin-session=${tampered}`);
}

async function logout(cookieHeader) {
  const response = await fetch(`${appBaseUrl}/api/admin/logout`, {
    method: "POST",
    headers: { Cookie: cookieHeader },
  });

  assert.equal(response.status, 200, `logout should return 200, got ${response.status}`);

  const setCookie = response.headers.getSetCookie().join(";");
  assert.match(setCookie, /itemsforsale-admin-session=/, "logout should clear admin session cookie");
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
      seedDescription: "Disposable row inserted by the end-to-end admin session flow test.",
    });

    appProcess = await startApp(config);
    await waitForApp(appBaseUrl);

    log("Logging in once and reusing session across multiple mutations");
    const cookieHeader = await loginAsAdmin(config);

    const firstItemId = await createAdminItem(cookieHeader, "Session Flow Item One");
    await editAdminItem(cookieHeader, firstItemId, "Session Flow Item One Updated");

    const secondItemId = await createAdminItem(cookieHeader, "Session Flow Item Two");
    await deleteAdminItem(cookieHeader, secondItemId, 200);

    log("Verifying logout clears access for subsequent requests");
    await logout(cookieHeader);
    await deleteAdminItem("", firstItemId, 401);

    log("Verifying tampered session cookie is rejected");
    const tamperedCookie = tamperSessionCookie(cookieHeader);
    await deleteAdminItem(tamperedCookie, firstItemId, 401);

    log("E2E admin session flow completed successfully");
  } finally {
    await cleanupRun({ appProcess, createdItemId, rootDir, appPort, containerName });
  }
}

main().catch((error) => {
  process.stderr.write(`\n[e2e] ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
