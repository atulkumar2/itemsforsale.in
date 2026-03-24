import { strict as assert } from "node:assert";

import { Client } from "pg";

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
 * End-to-end public contact flow.
 *
 * Coverage:
 * - submit merged seller-contact request through public contact-submissions route
 * - verify contact submission persistence (including captcha prompt)
 * - verify admin contact submissions page visibility
 */

const config = getPostgresE2EConfig();
const { appBaseUrl, appPort, containerName, databaseUrl, rootDir } = config;

let appProcess = null;

async function fetchContactChallenge() {
  const response = await fetch(`${appBaseUrl}/api/contact-submissions`, {
    method: "GET",
    headers: { "Cache-Control": "no-store" },
  });

  assert.equal(response.status, 200, "contact challenge endpoint should return 200");
  return response.json();
}

async function submitContactRequest() {
  const challenge = await fetchContactChallenge();
  const buyerName = "Public Contact Buyer";

  for (const option of challenge.options) {
    const response = await fetch(`${appBaseUrl}/api/contact-submissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        buyerName,
        phone: "9345678901",
        email: "public-contact@example.com",
        location: "JP Nagar",
        message: "Please share a convenient time to discuss pickup details.",
        captchaToken: challenge.token,
        captchaAnswer: option,
      }),
    });

    if (response.status === 201) {
      const payload = await response.json();
      assert.equal(payload.message, "Contact request submitted successfully.");
      return { buyerName };
    }
  }

  throw new Error("Unable to submit contact request: captcha options did not validate.");
}

async function assertContactSubmissionRow(buyerName) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const result = await client.query(
      `select buyer_name, phone, email, location, message, captcha_prompt
       from contact_submissions
       where buyer_name = $1
       order by created_at desc
       limit 1`,
      [buyerName],
    );

    assert.equal(result.rows.length, 1, "contact submission row should exist");
    assert.equal(result.rows[0].phone, "9345678901");
    assert.equal(result.rows[0].email, "public-contact@example.com");
    assert.equal(result.rows[0].location, "JP Nagar");
    assert.match(result.rows[0].message, /pickup details/i);
    assert.ok(result.rows[0].captcha_prompt, "captcha prompt should be stored with submission");
  } finally {
    await client.end();
  }
}

async function assertAdminVisibility(buyerName) {
  const cookieHeader = await loginAsAdmin(config);

  const response = await fetch(`${appBaseUrl}/admin/contact-submissions`, {
    headers: { Cookie: cookieHeader },
    redirect: "manual",
  });

  assert.equal(response.status, 200, "admin contact submissions page should be accessible after login");
  const html = await response.text();
  assert.ok(html.includes(buyerName), "admin contact submissions page should show submitted buyer");
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
      seedDescription: "Disposable row inserted by public contact flow.",
    });

    appProcess = await startApp(config);
    await waitForApp(appBaseUrl);

    log("Submitting merged seller contact request from public route");
    const { buyerName } = await submitContactRequest();

    log("Verifying contact submission persistence and admin visibility");
    await assertContactSubmissionRow(buyerName);
    await assertAdminVisibility(buyerName);

    log("E2E public contact flow completed successfully");
  } finally {
    await cleanupRun({ appProcess, rootDir, appPort, containerName });
  }
}

main().catch((error) => {
  process.stderr.write(`\n[e2e] ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
