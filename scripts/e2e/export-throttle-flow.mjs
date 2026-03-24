import { strict as assert } from "node:assert";

import { log } from "./helpers.mjs";
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
} from "./flow-common.mjs";

/**
 * End-to-end catalogue export throttle flow.
 *
 * Coverage:
 * - invalid export query params are rejected with 400
 * - repeated export calls are throttled after route limit
 * - throttled response includes Retry-After header
 */

const config = getPostgresE2EConfig();
const { appBaseUrl, appPort, containerName, databaseUrl, rootDir } = config;

let appProcess = null;

async function assertInvalidQueryRejection() {
  const invalidIp = "198.51.100.70";

  log("Verifying invalid status filter is rejected for catalogue export");
  const response = await fetch(`${appBaseUrl}/api/catalogue/export?status=definitely-invalid`, {
    headers: {
      "x-forwarded-for": invalidIp,
    },
  });

  assert.equal(response.status, 400, `invalid status should return 400, got ${response.status}`);
  const payload = await response.json();
  assert.ok(
    String(payload.error ?? "").includes("Status filter must be one of"),
    `unexpected invalid status error: ${JSON.stringify(payload)}`,
  );
}

async function assertExportThrottling() {
  const exportIp = "198.51.100.71";

  log("Verifying catalogue export throttling after repeated successful calls");
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    const response = await fetch(`${appBaseUrl}/api/catalogue/export`, {
      headers: {
        "x-forwarded-for": exportIp,
      },
    });

    assert.equal(response.status, 200, `export attempt ${attempt} should succeed, got ${response.status}`);

    const contentType = response.headers.get("Content-Type") ?? "";
    assert.ok(contentType.includes("text/csv"), `export attempt ${attempt} should return CSV content type`);
  }

  const throttledResponse = await fetch(`${appBaseUrl}/api/catalogue/export`, {
    headers: {
      "x-forwarded-for": exportIp,
    },
  });

  assert.equal(throttledResponse.status, 429, `13th export request should be throttled, got ${throttledResponse.status}`);
  const retryAfter = throttledResponse.headers.get("Retry-After");
  assert.ok(retryAfter, "throttled export response should include Retry-After");
  assert.ok(Number(retryAfter) >= 1, `export Retry-After should be >= 1, got ${retryAfter}`);
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
      seedDescription: "Disposable row inserted by export throttle flow.",
    });

    appProcess = await startApp(config);
    await waitForApp(appBaseUrl);

    await assertInvalidQueryRejection();
    await assertExportThrottling();

    log("E2E export throttle flow completed successfully");
  } finally {
    await cleanupRun({ appProcess, rootDir, appPort, containerName });
  }
}

main().catch((error) => {
  process.stderr.write(`\n[e2e] ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
