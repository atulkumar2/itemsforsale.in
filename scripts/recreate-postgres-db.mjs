import { execSync } from "node:child_process";

import { Client } from "pg";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/itemsforsale";
const shouldSeed = process.argv.includes("--seed");

function run(command) {
  execSync(command, { stdio: "inherit" });
}

async function waitForPostgres(maxAttempts = 30) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const client = new Client({ connectionString: databaseUrl });

    try {
      await client.connect();
      await client.query("select 1");
      await client.end();
      return;
    } catch {
      try {
        await client.end();
      } catch {
        // Ignore connection close errors during retries.
      }

      if (attempt === maxAttempts) {
        throw new Error("PostgreSQL did not become ready in time.");
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

async function main() {
  run("docker compose down -v");
  run("docker compose up -d");

  await waitForPostgres();

  run(`psql ${databaseUrl} -f data/postgres.local.sql`);
  run(`psql ${databaseUrl} -f data/migrations/20260317_backfill_postgres_constraints.sql`);
  run(`psql ${databaseUrl} -f data/migrations/20260317_convert_text_to_varchar.sql`);
  run("node scripts/import-json-to-postgres.mjs");

  if (shouldSeed) {
    run("node scripts/seed-dev-fake-data.mjs");
  }

  console.log(
    shouldSeed
      ? "PostgreSQL recreated, imported, and seeded with fake dev data."
      : "PostgreSQL recreated and imported from local JSON.",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
