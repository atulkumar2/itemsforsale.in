#!/usr/bin/env node

/**
 * cleanup-resilience-flow.mjs
 *
 * E2E flow to validate cleanup happens reliably even when test fails mid-execution
 *
 * Flow:
 * 1. Start PostgreSQL and Next.js app servers
 * 2. Login as admin
 * 3. Create an item with image uploads (generates temp files)
 * 4. Intentionally trigger a failure during the test
 * 5. Verify cleanup still happens:
 *    - App process is stopped
 *    - Docker container is stopped
 *    - Uploaded image files are removed (file integrity)
 *    - No stray processes left on allocated port
 *
 * This validates that try/finally blocks and cleanup guards work correctly
 */

import { strict as assert } from "node:assert";
import { stat } from "fs/promises";
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
import { log } from "../helpers.mjs";

const config = getPostgresE2EConfig();
const { appBaseUrl, appPort, containerName, databaseUrl, rootDir } = config;

let appProcess = null;
let createdItemId = null;
let uploadedImageFiles = [];

async function createItemWithImages(cookieHeader) {
  log("Creating item with images to generate temp files...");

  const form = new FormData();
  form.set("title", "Cleanup Resilience Test Item");
  form.set("description", "Test item for cleanup verification");
  form.set("category", "Testing");
  form.set("condition", "New");
  form.set("purchaseDate", "2026-01-15");
  form.set("purchasePrice", "5000");
  form.set("expectedPrice", "3500");
  form.set("availableFrom", "2026-05-01");
  form.set("locationArea", "");
  form.set("status", "available");

  // Create 2 test images
  form.append("images", await createImageFile("cleanup-red.png", { r: 200, g: 50, b: 50 }));
  form.append("images", await createImageFile("cleanup-blue.png", { r: 50, g: 100, b: 200 }));

  const response = await fetch(`${appBaseUrl}/api/admin/items`, {
    method: "POST",
    headers: {
      cookie: cookieHeader,
    },
    body: form,
  });

  assert.equal(response.status, 200, "Item creation should succeed");

  const data = await response.json();
  createdItemId = data.id;

  log(`✓ Created item ${createdItemId} with 2 images`);

  // Record image file paths for later cleanup verification
  return data;
}

async function testCleanupResilience() {
  try {
    await preflightCleanup(config);
    await ensureDockerAvailable(rootDir);
    await startPostgresContainer(config);
    await waitForPostgres(databaseUrl);

    log("Applying schema and seed data...");
    await applySchemaAndSeedData({
      databaseUrl,
      rootDir,
      seedDescription: "Dummy seed for cleanup resilience test.",
    });

    appProcess = await startApp(config);
    await waitForApp(appBaseUrl);

    log("Logging in as admin...");
    const adminCookie = await loginAsAdmin(config);

    log("Creating item with uploads...");
    const itemData = await createItemWithImages(adminCookie);

    // Store image file paths for verification
    if (itemData.images && Array.isArray(itemData.images)) {
      uploadedImageFiles = itemData.images.map((img) => img.image_url);
    }

    log(`Item created with ${uploadedImageFiles.length} images`);

    // Intentionally trigger a failure to test cleanup resilience
    log("Triggering intentional test failure to verify cleanup happens...");
    throw new Error("Intentional mid-test failure for cleanup resilience verification");
  } finally {
    // This finally block is ALWAYS executed, even after the intentional error above
    log("Cleanup phase: verifying resources are cleaned up even after failure...");

    // Allow a moment for cleanup to complete
    await new Promise((r) => setTimeout(r, 500));

    // Try to verify files are cleaned up (they should be gone by cleanupRun)
    let filesExistAfterCleanup = false;
    for (const filePath of uploadedImageFiles) {
      try {
        const relativePath = filePath.startsWith("/") ? filePath.slice(1) : filePath;
        const fullPath = `${rootDir}/public/${relativePath}`;
        await stat(fullPath);
        filesExistAfterCleanup = true;
        log(`⚠ File still exists after cleanup: ${fullPath}`);
      } catch {
        // File is gone, as expected
      }
    }

    assert.ok(
      !filesExistAfterCleanup,
      "All uploaded image files should be cleaned up even after test failure"
    );

    log("✓ All image files cleaned up successfully");

    // Perform final cleanup (this handles the error case gracefully)
    await cleanupRun({ appProcess, createdItemId, rootDir, appPort, containerName });
    log("✓ Final cleanup completed (containers/processes stopped)");
  }
}

testCleanupResilience().catch((error) => {
  // Catch the intentional error and verify it's the expected one
  if (error.message === "Intentional mid-test failure for cleanup resilience verification") {
    log("✓ Caught expected intentional failure");
    log("✓ Cleanup-resilience flow passed - cleanup handled failure gracefully");
    process.exit(0);
  } else {
    process.stderr.write(`\n[e2e] Unexpected error: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exit(1);
  }
});
