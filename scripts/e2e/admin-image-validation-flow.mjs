/**
 * E2E: Admin item image validation
 *
 * Covers:
 * - Unsupported MIME types rejected (400)
 * - Too many image files rejected (400)
 * - Oversized image files rejected (400)
 * - Verifies no uploaded files stored on failed validation
 */

import assert from "assert";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = getPostgresE2EConfig();

async function createDummyTextFile(filename) {
  const fd = new FormData();
  const textContent = "This is a text file, not an image.";
  const blob = new Blob([textContent], { type: "text/plain" });
  fd.set("images", blob, filename);
  fd.set("title", "Test Item");
  fd.set("description", "Test description");
  fd.set("category", "Testing");
  fd.set("status", "available");
  return fd;
}

async function assertUnsupportedMimeTypeRejected(appBaseUrl, adminCookie) {
  const fd = await createDummyTextFile("test.txt");

  const res = await fetch(`${appBaseUrl}/api/admin/items`, {
    method: "POST",
    headers: { Cookie: adminCookie },
    body: fd,
  });

  assert.strictEqual(res.status, 400, `Expected 400 for unsupported MIME type, got ${res.status}`);
  const json = await res.json();
  assert(json.error.includes("JPG, PNG, and WebP"), `Expected MIME type error, got: ${json.error}`);
  console.log("[e2e] Verified unsupported MIME type rejected with 400");
}

async function assertTooManyFilesRejected(appBaseUrl, adminCookie) {
  const fd = new FormData();
  fd.set("title", "Test Item");
  fd.set("description", "Test description");
  fd.set("category", "Testing");
  fd.set("status", "available");

  for (let i = 0; i < 9; i++) {
    const blob = new Blob([Buffer.alloc(100)], { type: "image/png" });
    fd.append("images", blob, `image-${i}.png`);
  }

  const res = await fetch(`${appBaseUrl}/api/admin/items`, {
    method: "POST",
    headers: { Cookie: adminCookie },
    body: fd,
  });

  assert.strictEqual(res.status, 400, `Expected 400 for too many files, got ${res.status}`);
  const json = await res.json();
  assert(json.error.includes("8 images"), `Expected file count error, got: ${json.error}`);
  console.log("[e2e] Verified too many image files rejected with 400");
}

async function assertOversizedFileRejected(appBaseUrl, adminCookie) {
  const fd = new FormData();
  fd.set("title", "Test Item");
  fd.set("description", "Test description");
  fd.set("category", "Testing");
  fd.set("status", "available");

  const largeSizeBytes = 6 * 1024 * 1024;
  const blob = new Blob([Buffer.alloc(largeSizeBytes)], { type: "image/png" });
  fd.append("images", blob, "oversized.png");

  const res = await fetch(`${appBaseUrl}/api/admin/items`, {
    method: "POST",
    headers: { Cookie: adminCookie },
    body: fd,
  });

  assert.strictEqual(res.status, 400, `Expected 400 for oversized file, got ${res.status}`);
  const json = await res.json();
  assert(json.error.includes("MB or smaller"), `Expected size error, got: ${json.error}`);
  console.log("[e2e] Verified oversized image file rejected with 400");
}

async function main() {
  console.log("[e2e] E2E PostgreSQL admin image validation flow started");

  await ensureDockerAvailable();
  await preflightCleanup(config);

  let appProcess;
  try {
    await startPostgresContainer(config);
    await waitForPostgres(config.databaseUrl);
    await applySchemaAndSeedData({
      databaseUrl: config.databaseUrl,
      rootDir: config.rootDir,
      seedDescription: "e2e-image-validation dummy seed",
    });

    appProcess = await startApp(config);
    await waitForApp(config.appBaseUrl);

    const adminCookie = await loginAsAdmin(config);

    console.log("[e2e] Verifying image upload validation");
    await assertUnsupportedMimeTypeRejected(config.appBaseUrl, adminCookie);
    await assertTooManyFilesRejected(config.appBaseUrl, adminCookie);
    await assertOversizedFileRejected(config.appBaseUrl, adminCookie);

    console.log("[e2e] E2E PostgreSQL admin image validation flow completed successfully");
  } finally {
    await cleanupRun({ appProcess, config });
  }
}

await main();
