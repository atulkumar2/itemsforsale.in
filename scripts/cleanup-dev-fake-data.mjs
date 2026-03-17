import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { Client } from "pg";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/itemsforsale";
const dataMode = (process.env.DATA_MODE ?? "local").toLowerCase();
const databaseFilePath = path.join(process.cwd(), "data", "local-db.json");
const devSeedMarker = "[DEV_SEED]";

function isFakeEmail(value) {
  return typeof value === "string" && value.toLowerCase().endsWith("@example.com");
}

function hasMarker(value) {
  return typeof value === "string" && value.startsWith(devSeedMarker);
}

function isFakeLead(row) {
  return isFakeEmail(row?.email) || hasMarker(row?.message);
}

function isFakeSubmission(row) {
  return isFakeEmail(row?.email) || hasMarker(row?.message);
}

async function cleanupLocalJson() {
  const raw = await readFile(databaseFilePath, "utf8");
  const database = JSON.parse(raw);

  const previousLeadCount = (database.leads ?? []).length;
  const previousSubmissionCount = (database.contactSubmissions ?? []).length;

  database.leads = (database.leads ?? []).filter((lead) => !isFakeLead(lead));
  database.contactSubmissions = (database.contactSubmissions ?? []).filter(
    (submission) => !isFakeSubmission(submission),
  );

  const removedLeads = previousLeadCount - database.leads.length;
  const removedSubmissions = previousSubmissionCount - database.contactSubmissions.length;

  await writeFile(databaseFilePath, JSON.stringify(database, null, 2));

  console.log(
    `Removed ${removedLeads} fake leads and ${removedSubmissions} fake contact submissions from local JSON.`,
  );
}

async function cleanupPostgres() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query("begin");

    const leadsResult = await client.query(
      `delete from leads
       where (email is not null and lower(email) like '%@example.com')
          or (message is not null and message like $1)`,
      [`${devSeedMarker}%`],
    );

    const submissionsResult = await client.query(
      `delete from contact_submissions
       where (email is not null and lower(email) like '%@example.com')
          or (message is not null and message like $1)`,
      [`${devSeedMarker}%`],
    );

    await client.query("commit");

    console.log(
      `Removed ${leadsResult.rowCount ?? 0} fake leads and ${submissionsResult.rowCount ?? 0} fake contact submissions from PostgreSQL.`,
    );
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

async function main() {
  if (dataMode === "postgres") {
    await cleanupPostgres();
    return;
  }

  await cleanupLocalJson();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
