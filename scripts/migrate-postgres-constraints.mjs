import { readFile } from "node:fs/promises";
import path from "node:path";

import { Client } from "pg";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/itemsforsale";
const migrationFilePath = path.join(
  process.cwd(),
  "data",
  "migrations",
  "20260317_backfill_postgres_constraints.sql",
);

async function main() {
  const client = new Client({ connectionString: databaseUrl });

  await client.connect();

  try {
    const migrationSql = await readFile(migrationFilePath, "utf8");
    await client.query(migrationSql);
    console.log("Applied PostgreSQL constraint migration successfully.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
