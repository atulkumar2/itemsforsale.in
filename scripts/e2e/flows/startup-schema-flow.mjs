#!/usr/bin/env node

/**
 * startup-schema-flow.mjs
 *
 * E2E flow to validate schema initialization and idempotence
 *
 * Flow:
 * 1. Start PostgreSQL with fresh database
 * 2. Apply schema (creates all tables, indexes, constraints)
 * 3. Verify all expected tables exist via information_schema
 * 4. Insert test data
 * 5. Apply schema again (idempotent check - DDL only, no re-seeding)
 * 6. Verify test data still exists (no data loss)
 * 7. Verify all tables unchanged (idempotent)
 * 8. Cleanup Docker resources
 */

import { strict as assert } from "node:assert";
import { Client } from "pg";
import { readFile } from "fs/promises";
import path from "path";
import {
  applySchemaAndSeedData,
  cleanupRun,
  ensureDockerAvailable,
  getPostgresE2EConfig,
  preflightCleanup,
  startPostgresContainer,
  waitForPostgres,
} from "../flow-common.mjs";
import { log } from "../helpers.mjs";

const config = getPostgresE2EConfig();
const { appPort, containerName, databaseUrl, rootDir } = config;

async function getPostgresClient() {
  const client = new Client({
    connectionString: databaseUrl,
    statement_timeout: 10000,
    query_timeout: 10000,
  });
  await client.connect();
  return client;
}

async function applySchemaOnly(client) {
  const ddl = await readFile(path.join(rootDir, "data", "postgres.local.sql"), "utf8");
  await client.query(ddl);
}

async function queryTableExists(client, tableName) {
  const result = await client.query(
    `
    select exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = $1
    ) as exists
    `,
    [tableName]
  );
  return result.rows[0].exists;
}

async function queryTableColumnCount(client, tableName) {
  const result = await client.query(
    `
    select count(*) as col_count
    from information_schema.columns
    where table_schema = 'public' and table_name = $1
    `,
    [tableName]
  );
  return result.rows[0].col_count;
}

async function testSchemaIdempotence() {
  let client;

  try {
    const expectedTables = ["items", "item_images", "leads", "contact_submissions"];

    log("Verifying all expected tables exist...");
    client = await getPostgresClient();

    for (const tableName of expectedTables) {
      const exists = await queryTableExists(client, tableName);
      assert.ok(
        exists,
        `Table '${tableName}' should exist after schema application`
      );
      log(`  ✓ Table '${tableName}' exists`);
    }

    // Record table column counts for idempotency check
    const columnCountsBefore = {};
    log("Recording table column counts...");
    for (const tableName of expectedTables) {
      const colCount = await queryTableColumnCount(client, tableName);
      columnCountsBefore[tableName] = colCount;
      log(`  ${tableName}: ${colCount} columns`);
    }

    // Insert test data
    log("Inserting test item for idempotency check...");
    const itemId = "11111111-1111-1111-1111-111111111111";
    const slug = "test-schema-item";
    const title = "Test Schema Item";

    await client.query(
      `
      insert into items (id, slug, title, status, created_at, updated_at)
      values ($1, $2, $3, $4, now(), now())
      `,
      [itemId, slug, title, "available"]
    );

    const countBefore = await client.query(
      "select count(*) as cnt from items where id = $1",
      [itemId]
    );
    assert.equal(
      Number(countBefore.rows[0].cnt),
      1,
      "Test item should be inserted"
    );
    log("  ✓ Test item inserted");

    // Reapply schema (DDL only - no seeding to avoid duplicate key conflict)
    // This tests that ensureSchema() is idempotent
    log("Reapplying schema DDL to verify idempotence...");
    await applySchemaOnly(client);
    log("Schema DDL reapplied successfully.");

    // Verify test data still exists
    log("Verifying test data survived schema reapplication...");
    const countAfter = await client.query(
      "select count(*) as cnt from items where id = $1",
      [itemId]
    );
    assert.equal(
      Number(countAfter.rows[0].cnt),
      1,
      "Test item should still exist after idempotent schema reapplication"
    );
    log("  ✓ Test item still exists with same ID and slug");

    // Verify all tables still exist with same column counts
    log("Verifying schema stability (no duplicate tables)...");
    for (const tableName of expectedTables) {
      const exists = await queryTableExists(client, tableName);
      assert.ok(
        exists,
        `Table '${tableName}' should still exist after idempotent schema reapplication`
      );

      const colCountAfter = await queryTableColumnCount(client, tableName);
      assert.equal(
        colCountAfter,
        columnCountsBefore[tableName],
        `Table '${tableName}' should have same column count after idempotent reapplication`
      );
      log(`  ✓ Table '${tableName}' stable (${colCountAfter} columns)`);
    }

    // Verify item_images and leads foreign keys still work
    log("Verifying foreign key constraints...");
    const leadId = "22222222-2222-2222-2222-222222222222";
    await client.query(
      `
      insert into leads (id, item_id, buyer_name, created_at)
      values ($1, $2, $3, now())
      `,
      [leadId, itemId, "Test Buyer"]
    );

    const leadCount = await client.query(
      "select count(*) as cnt from leads where id = $1",
      [leadId]
    );
    assert.equal(Number(leadCount.rows[0].cnt), 1, "Foreign key constraint should allow lead insertion");
    log("  ✓ Foreign key constraints functional");

    await client.end();

    log("✓ Schema is idempotent and stable");
    log("✓ All tables created with expected structure");
  } catch (error) {
    if (client) {
      try {
        await client.end();
      } catch {
        // Ignore error if client already closed
      }
    }
    throw error;
  }
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

    log("Applying schema for the first time...");
    await applySchemaAndSeedData({
      databaseUrl,
      rootDir,
      seedDescription: "Disposable row inserted by the startup-schema E2E flow test.",
    });
    log("Schema applied successfully.");

    await testSchemaIdempotence();

    log("E2E startup schema flow completed successfully");
  } finally {
    await cleanupRun({ appProcess: null, createdItemId: null, rootDir, appPort, containerName });
  }
}

main().catch((error) => {
  process.stderr.write(`\n[e2e] ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
