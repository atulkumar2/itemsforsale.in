import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";

import { Client } from "pg";

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
 * End-to-end public location fallback flow.
 *
 * Coverage:
 * - item without locationArea links to /about-seller on item detail page
 * - item with locationArea renders location text directly
 */

const config = getPostgresE2EConfig();
const { appBaseUrl, appPort, containerName, databaseUrl, rootDir } = config;

let appProcess = null;

async function seedItemsForLocationChecks() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const now = new Date().toISOString();

    const noLocation = {
      id: randomUUID(),
      slug: "public-location-fallback-no-location",
      title: "Public Location Fallback No Location",
    };

    const withLocation = {
      id: randomUUID(),
      slug: "public-location-fallback-with-location",
      title: "Public Location Fallback With Location",
      locationArea: "Whitefield",
    };

    await client.query(
      `insert into items (
         id, slug, title, description, category, condition, purchase_date,
         purchase_price, expected_price, available_from, location_area,
         status, created_at, updated_at
       ) values
       ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14),
       ($15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)`,
      [
        noLocation.id,
        noLocation.slug,
        noLocation.title,
        "No location area; page should link to seller details.",
        "Testing",
        "Great",
        "2024-01-10",
        9000,
        6500,
        "2026-05-01",
        null,
        "available",
        now,
        now,
        withLocation.id,
        withLocation.slug,
        withLocation.title,
        "Has explicit location area; page should show location text.",
        "Testing",
        "Great",
        "2024-01-10",
        10000,
        7000,
        "2026-05-01",
        withLocation.locationArea,
        "available",
        now,
        now,
      ],
    );

    return { noLocation, withLocation };
  } finally {
    await client.end();
  }
}

async function assertFallbackLink(slug) {
  const response = await fetch(`${appBaseUrl}/items/${slug}`);
  assert.equal(response.status, 200, "item page should render for no-location item");
  const html = await response.text();

  assert.match(html, /See seller location and contact details/, "fallback copy should be visible");
  assert.match(html, /href="\/about-seller"/, "fallback should link to /about-seller");
}

async function assertDirectLocationText(slug, locationArea) {
  const response = await fetch(`${appBaseUrl}/items/${slug}`);
  assert.equal(response.status, 200, "item page should render for located item");
  const html = await response.text();

  assert.ok(html.includes(locationArea), "location text should be visible on item page");
  assert.doesNotMatch(
    html,
    /See seller location and contact details/,
    "fallback copy should not appear when locationArea exists",
  );
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
      seedDescription: "Disposable row inserted by public location fallback flow.",
    });

    appProcess = await startApp(config);
    await waitForApp(appBaseUrl);

    log("Seeding items with and without locationArea for fallback checks");
    const { noLocation, withLocation } = await seedItemsForLocationChecks();

    log("Verifying /about-seller link fallback and direct location rendering");
    await assertFallbackLink(noLocation.slug);
    await assertDirectLocationText(withLocation.slug, withLocation.locationArea);

    log("E2E public location fallback flow completed successfully");
  } finally {
    await cleanupRun({ appProcess, rootDir, appPort, containerName });
  }
}

main().catch((error) => {
  process.stderr.write(`\n[e2e] ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
