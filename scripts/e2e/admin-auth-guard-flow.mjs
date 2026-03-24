import { strict as assert } from "node:assert";
import { Client } from "pg";

import { log } from "./helpers.mjs";
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

/**
 * End-to-end auth guard flow for admin APIs.
 *
 * Coverage:
 * - protected admin APIs reject unauthenticated requests
 * - wrong captcha is blocked at login
 * - wrong credentials are blocked at login
 * - valid session cookie is required for protected mutations
 */

const config = getPostgresE2EConfig();
const { appBaseUrl, appPort, containerName, databaseUrl, rootDir } = config;

let appProcess = null;
let createdItemId = null;

async function fetchCaptchaChallenge() {
  const response = await fetch(`${appBaseUrl}/api/human-check`, {
    headers: { "Cache-Control": "no-store" },
  });
  assert.equal(response.status, 200, "captcha endpoint should return 200");
  return response.json();
}

async function assertProtectedCreateRejectedWithoutSession() {
  log("Verifying protected create route rejects unauthenticated requests");
  const form = new FormData();
  form.set("title", "Blocked without session");
  form.set("description", "Should not be allowed without admin session.");
  form.set("category", "Testing");
  form.set("condition", "Great");
  form.set("purchaseDate", "2024-01-10");
  form.set("purchasePrice", "1000");
  form.set("expectedPrice", "900");
  form.set("availableFrom", "2026-05-01");
  form.set("locationArea", "Test area");
  form.set("status", "available");
  form.append("images", await createImageFile("blocked-no-session.png", { r: 120, g: 120, b: 120 }));

  const response = await fetch(`${appBaseUrl}/api/admin/items`, {
    method: "POST",
    body: form,
  });

  assert.equal(response.status, 401, "create route should reject request without session cookie");
}

async function assertProtectedDeleteRejectedWithoutSession() {
  log("Verifying protected delete route rejects unauthenticated requests");
  const fakeItemId = "00000000-0000-0000-0000-000000000000";

  const response = await fetch(`${appBaseUrl}/api/admin/items/${fakeItemId}`, {
    method: "DELETE",
  });

  assert.equal(response.status, 401, "delete route should reject request without session cookie");
}

async function assertWrongCaptchaRejected() {
  log("Verifying wrong captcha answer is blocked at login");
  const challenge = await fetchCaptchaChallenge();

  const response = await fetch(`${appBaseUrl}/api/admin/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: config.adminEmail,
      password: config.adminPassword,
      captchaToken: challenge.token,
      captchaAnswer: "definitely-wrong-answer",
    }),
  });

  assert.equal(response.status, 400, "wrong captcha answer should return 400");
  const payload = await response.json();
  assert.equal(payload.error, "Captcha answer is incorrect.");
}

async function assertWrongCredentialsRejected() {
  log("Verifying wrong credentials are blocked even when captcha is correct");
  const challenge = await fetchCaptchaChallenge();
  let sawInvalidCredentials = false;

  for (const option of challenge.options) {
    const response = await fetch(`${appBaseUrl}/api/admin/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: config.adminEmail,
        password: `${config.adminPassword}-wrong`,
        captchaToken: challenge.token,
        captchaAnswer: option,
      }),
    });

    if (response.status === 401) {
      const payload = await response.json();
      assert.equal(payload.error, "Invalid admin credentials.");
      sawInvalidCredentials = true;
      break;
    }
  }

  assert.equal(sawInvalidCredentials, true, "expected one captcha option to reach credential validation");
}

async function createItemWithValidSession(cookieHeader) {
  log("Verifying valid session is required and allows protected mutations");
  const form = new FormData();
  form.set("title", "Auth Guard E2E Item");
  form.set("description", "Created by auth-guard flow.");
  form.set("category", "Testing");
  form.set("condition", "Great");
  form.set("purchaseDate", "2024-02-15");
  form.set("purchasePrice", "12000");
  form.set("expectedPrice", "8000");
  form.set("availableFrom", "2026-05-01");
  form.set("locationArea", "Auth guard location");
  form.set("status", "available");
  form.append("images", await createImageFile("auth-guard-red.png", { r: 190, g: 80, b: 80 }));

  const createResponse = await fetch(`${appBaseUrl}/api/admin/items`, {
    method: "POST",
    headers: {
      Cookie: cookieHeader,
    },
    body: form,
  });

  assert.equal(createResponse.status, 200, "create should succeed with valid session cookie");
  const payload = await createResponse.json();
  assert.ok(payload.itemId, "create route should return itemId");
  createdItemId = payload.itemId;
  return payload.itemId;
}

async function assertProtectedDeleteRequiresSession(itemId, cookieHeader) {
  const unauthenticatedDelete = await fetch(`${appBaseUrl}/api/admin/items/${itemId}`, {
    method: "DELETE",
  });
  assert.equal(unauthenticatedDelete.status, 401, "delete should fail without session even for existing item");

  const authenticatedDelete = await fetch(`${appBaseUrl}/api/admin/items/${itemId}`, {
    method: "DELETE",
    headers: {
      Cookie: cookieHeader,
    },
  });

  assert.equal(authenticatedDelete.status, 200, "delete should succeed with valid session cookie");
  const payload = await authenticatedDelete.json();
  assert.equal(payload.message, "Item deleted.");
}

async function assertItemDeletedInDb(itemId) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const result = await client.query("select id from items where id = $1", [itemId]);
    assert.equal(result.rows.length, 0, "item should be removed after authenticated delete");
  } finally {
    await client.end();
  }
}

/**
 * Runs the auth guard flow and always performs teardown.
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
      seedDescription: "Disposable row inserted by the end-to-end admin auth guard flow test.",
    });
    appProcess = await startApp(config);
    await waitForApp(appBaseUrl);

    await assertProtectedCreateRejectedWithoutSession();
    await assertProtectedDeleteRejectedWithoutSession();
    await assertWrongCaptchaRejected();
    await assertWrongCredentialsRejected();

    const cookieHeader = await loginAsAdmin(config);
    const itemId = await createItemWithValidSession(cookieHeader);
    await assertProtectedDeleteRequiresSession(itemId, cookieHeader);
    await assertItemDeletedInDb(itemId);

    log("E2E PostgreSQL admin auth guard flow completed successfully");
  } finally {
    await cleanupRun({ appProcess, createdItemId, rootDir, appPort, containerName });
  }
}

main().catch((error) => {
  process.stderr.write(`\n[e2e] ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
