#!/usr/bin/env node

/**
 * system-status-flow.mjs
 *
 * E2E flow to validate admin system status page rendering and PostgreSQL connection health
 *
 * Flow:
 * 1. Start PostgreSQL and Next.js app servers
 * 2. Login as admin
 * 3. Fetch /admin/system page
 * 4. Verify page renders with:
 *    - "Runtime health" heading
 *    - Data mode (postgres), Persistence, Upload storage, and PostgreSQL status cards
 *    - Connection details (Host, Port, Database)
 *    - PostgreSQL connection shows "Reachable" (not "Unavailable")
 * 5. Cleanup Docker and process resources
 */

import { strict as assert } from "node:assert";
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
import { log } from "./helpers.mjs";

const config = getPostgresE2EConfig();
const { appBaseUrl, appPort, containerName, databaseUrl, rootDir } = config;

let appProcess = null;

async function testSystemStatusPage() {
  log("Testing system status page...");

  // Test: Fetch system status page
  const adminCookie = await loginAsAdmin(config);
  const statusResponse = await fetch(`${appBaseUrl}/admin/system`, {
    headers: {
      cookie: adminCookie,
    },
  });

  assert.equal(statusResponse.status, 200, "System status page should return 200");

  const statusHtml = await statusResponse.text();

  // Verify page structure
  assert.ok(
    statusHtml.includes("Runtime health"),
    "Page should have 'Runtime health' heading"
  );

  assert.ok(
    statusHtml.includes("Data mode"),
    "Page should have 'Data mode' card label"
  );

  assert.ok(
    statusHtml.includes("postgres"),
    "Data mode should show 'postgres' in postgres mode"
  );

  assert.ok(
    statusHtml.includes("Persistence"),
    "Page should have 'Persistence' card label"
  );

  assert.ok(
    statusHtml.includes("Upload storage"),
    "Page should have 'Upload storage' card label"
  );

  assert.ok(statusHtml.includes("PostgreSQL"), "Page should have 'PostgreSQL' card");

  // Verify PostgreSQL is reachable
  assert.ok(
    statusHtml.includes("Reachable"),
    "PostgreSQL should show 'Reachable' status"
  );

  // Verify connection details section exists
  assert.ok(
    statusHtml.includes("Connection details"),
    "Page should have 'Connection details' section"
  );

  assert.ok(statusHtml.includes("Host"), "Connection details should show Host");

  assert.ok(statusHtml.includes("Port"), "Connection details should show Port");

  assert.ok(statusHtml.includes("Database"), "Connection details should show Database");

  // Verify database name appears in connection details
  assert.ok(
    statusHtml.includes("itemsforsale"),
    "Database name should appear in connection details"
  );

  log("✓ System status page renders correctly");
  log("✓ PostgreSQL connection is reachable");
  log("✓ Connection details are displayed");
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
      seedDescription: "Disposable row inserted by the system-status E2E flow test.",
    });
    appProcess = await startApp(config);
    await waitForApp(appBaseUrl);

    await testSystemStatusPage();

    log("E2E system status flow completed successfully");
  } finally {
    await cleanupRun({ appProcess, createdItemId: null, rootDir, appPort, containerName });
  }
}

main().catch((error) => {
  process.stderr.write(`\n[e2e] ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
