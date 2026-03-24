import { strict as assert } from "node:assert";

import { log } from "../helpers.mjs";
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
} from "../flow-common.mjs";

/**
 * End-to-end about seller render flow.
 *
 * Coverage:
 * - verify seller address and Google Maps CTA render
 * - verify distance table and map embed render
 * - verify merged contact form and captcha selector render
 */

const config = getPostgresE2EConfig();
const { appBaseUrl, appPort, containerName, databaseUrl, rootDir } = config;

let appProcess = null;

async function assertAboutSellerHtml() {
  const response = await fetch(`${appBaseUrl}/about-seller`);
  assert.equal(response.status, 200, `about-seller page should return 200, got ${response.status}`);

  const html = await response.text();

  assert.ok(html.includes("Seller details and pickup location"), "about-seller heading should render");
  assert.ok(html.includes("Pickup address"), "pickup address section should render");
  assert.ok(html.includes("Pioneer Wood winds Apartment"), "seller address text should render");

  assert.ok(html.includes("Open in Google Maps"), "maps CTA should render");
  assert.ok(html.includes("https://maps.app.goo.gl/dnveXLxu6jniBJHv6"), "maps link href should render");

  assert.ok(html.includes("Distances"), "distance section heading should render");
  assert.ok(html.includes("Silk Board Junction"), "distance row for Silk Board Junction should render");
  assert.ok(html.includes("Electronic City"), "distance row for Electronic City should render");

  assert.ok(html.includes("title=\"Seller location map\""), "embedded map iframe should render");
  assert.ok(html.includes("Reach out directly"), "contact section heading should render");
  assert.ok(html.includes("Verify &amp; continue") || html.includes("Verify & continue"), "contact form submit button should render");
  assert.ok(html.includes("Select the correct answer"), "captcha selector should render");
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
      seedDescription: "Disposable row inserted by about seller render flow.",
    });

    appProcess = await startApp(config);
    await waitForApp(appBaseUrl);

    log("Verifying about-seller page rendering for address, map, distances, and contact form");
    await assertAboutSellerHtml();

    log("E2E about seller flow completed successfully");
  } finally {
    await cleanupRun({ appProcess, rootDir, appPort, containerName });
  }
}

main().catch((error) => {
  process.stderr.write(`\n[e2e] ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
