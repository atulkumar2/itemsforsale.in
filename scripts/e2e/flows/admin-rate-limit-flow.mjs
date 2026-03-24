import { strict as assert } from "node:assert";

import { log } from "../helpers.mjs";
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
} from "../flow-common.mjs";

/**
 * End-to-end admin login rate-limit flow.
 *
 * Coverage:
 * - repeated admin login attempts are throttled
 * - throttled responses include Retry-After header
 * - fresh app process allows login again (window reset strategy)
 */

const config = getPostgresE2EConfig();
config.adminSessionSecret = "e2e-rate-limit-secret";

const { appBaseUrl, appPort, containerName, databaseUrl, rootDir } = config;

let appProcess = null;

async function attemptInvalidLogin(ipAddress) {
  return fetch(`${appBaseUrl}/api/admin/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ipAddress,
    },
    body: JSON.stringify({
      email: config.adminEmail,
      password: config.adminPassword,
      captchaToken: "invalid-captcha-token",
      captchaAnswer: "invalid-captcha-answer",
    }),
  });
}

async function assertRateLimitIsEnforced() {
  const fixedIp = "198.51.100.10";

  log("Verifying admin login rate limit by repeated attempts");
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const response = await attemptInvalidLogin(fixedIp);
    assert.equal(
      response.status,
      400,
      `attempt ${attempt} should fail validation/captcha before throttle, got ${response.status}`,
    );
  }

  const throttled = await attemptInvalidLogin(fixedIp);
  assert.equal(throttled.status, 429, `6th request should be throttled, got ${throttled.status}`);

  const retryAfter = throttled.headers.get("Retry-After");
  assert.ok(retryAfter, "throttled response should include Retry-After header");
  assert.ok(Number(retryAfter) >= 1, `Retry-After should be >= 1, got ${retryAfter}`);
}

async function restartAppStack() {
  await cleanupRun({ appProcess, rootDir, appPort, containerName });
  appProcess = null;

  await startPostgresContainer(config);
  await waitForPostgres(databaseUrl);
  await applySchemaAndSeedData({
    databaseUrl,
    rootDir,
    seedDescription: "Disposable row inserted by the end-to-end admin rate-limit flow test.",
  });

  appProcess = await startApp(config);
  await waitForApp(appBaseUrl);
}

async function assertFreshAppAllowsAdminLogin() {
  log("Verifying login succeeds after fresh app restart (rate-limit window reset strategy)");
  const cookieHeader = await loginAsAdmin(config);
  assert.match(cookieHeader, /itemsforsale-admin-session=/, "admin session cookie should be present");
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
      seedDescription: "Disposable row inserted by the end-to-end admin rate-limit flow test.",
    });

    appProcess = await startApp(config);
    await waitForApp(appBaseUrl);

    await assertRateLimitIsEnforced();
    await restartAppStack();
    await assertFreshAppAllowsAdminLogin();

    log("E2E admin rate-limit flow completed successfully");
  } finally {
    await cleanupRun({ appProcess, rootDir, appPort, containerName });
  }
}

main().catch((error) => {
  process.stderr.write(`\n[e2e] ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
