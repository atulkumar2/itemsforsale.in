import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";

import { Client } from "pg";

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
 * End-to-end public rate-limit flow.
 *
 * Coverage:
 * - repeated public lead submissions are throttled after limit
 * - repeated public contact submissions are throttled after limit
 * - throttled responses include Retry-After
 * - rows are capped at route limits (no excess writes after throttle)
 */

const config = getPostgresE2EConfig();
const { appBaseUrl, appPort, containerName, databaseUrl, rootDir } = config;

let appProcess = null;

const promptAnswerMap = {
  "What is the capital city of India?": "New Delhi",
  "Mumbai belongs to which country?": "India",
  "Which state is Bengaluru in?": "Karnataka",
  "Which state is Mysuru in?": "Karnataka",
  "Which state is Chennai in?": "Tamil Nadu",
  "Which state is Hyderabad in?": "Telangana",
  "Goa is in which country?": "India",
  "Kerala is in which country?": "India",
  "Which language is widely used as a common official language in India?": "Hindi",
  "The Taj Mahal is in which city?": "Agra",
  "The Gateway of India is in which city?": "Mumbai",
  "The Red Fort is in which city?": "Delhi",
};

function getCaptchaAnswer(prompt, options) {
  const mathMatch = prompt.match(/^What is (\d+)\s*([+\-x])\s*(\d+)\?$/);

  let answer = "";
  if (mathMatch) {
    const left = Number.parseInt(mathMatch[1], 10);
    const operator = mathMatch[2];
    const right = Number.parseInt(mathMatch[3], 10);

    if (operator === "+") {
      answer = String(left + right);
    } else if (operator === "-") {
      answer = String(left - right);
    } else {
      answer = String(left * right);
    }
  } else {
    answer = promptAnswerMap[prompt] ?? "";
  }

  assert.ok(answer, `Unsupported captcha prompt: ${prompt}`);
  assert.ok(options.includes(answer), `Expected answer \"${answer}\" to exist in options for prompt: ${prompt}`);

  return answer;
}

async function seedPublicItem() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const itemId = randomUUID();
    const now = new Date().toISOString();

    await client.query(
      `insert into items (
         id, slug, title, description, category, condition, purchase_date,
         purchase_price, expected_price, available_from, location_area,
         status, created_at, updated_at
       ) values (
         $1, $2, $3, $4, $5, $6, $7,
         $8, $9, $10, $11,
         $12, $13, $14
       )`,
      [
        itemId,
        "public-rate-limit-item",
        "Public Rate Limit Item",
        "Seeded for public rate-limit E2E flow.",
        "Testing",
        "Great",
        "2024-01-10",
        9500,
        7200,
        "2026-05-01",
        "Electronic City",
        "available",
        now,
        now,
      ],
    );

    return itemId;
  } finally {
    await client.end();
  }
}

async function fetchHumanCheck(ipAddress) {
  const response = await fetch(`${appBaseUrl}/api/human-check`, {
    headers: {
      "Cache-Control": "no-store",
      "x-forwarded-for": ipAddress,
    },
  });

  assert.equal(response.status, 200, "human-check endpoint should return 200");
  return response.json();
}

async function fetchContactChallenge(ipAddress) {
  const response = await fetch(`${appBaseUrl}/api/contact-submissions`, {
    method: "GET",
    headers: {
      "Cache-Control": "no-store",
      "x-forwarded-for": ipAddress,
    },
  });

  assert.equal(response.status, 200, "contact challenge endpoint should return 200");
  return response.json();
}

async function submitLead({ itemId, buyerName, captchaToken, captchaAnswer, ipAddress }) {
  return fetch(`${appBaseUrl}/api/leads`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ipAddress,
    },
    body: JSON.stringify({
      itemId,
      buyerName,
      phone: "9100000001",
      email: "public-rate-limit-lead@example.com",
      location: "Jayanagar",
      message: "Lead rate-limit flow submission.",
      bidPrice: "7000",
      captchaToken,
      captchaAnswer,
    }),
  });
}

async function submitContact({ buyerName, captchaToken, captchaAnswer, ipAddress }) {
  return fetch(`${appBaseUrl}/api/contact-submissions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ipAddress,
    },
    body: JSON.stringify({
      buyerName,
      phone: "9100000002",
      email: "public-rate-limit-contact@example.com",
      location: "Malleshwaram",
      message: "Contact rate-limit flow submission.",
      captchaToken,
      captchaAnswer,
    }),
  });
}

async function assertRateLimitedLeadFlow(itemId) {
  const ipAddress = "203.0.113.60";

  log("Submitting public leads until route throttle limit is reached");
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    const challenge = await fetchHumanCheck(ipAddress);
    const answer = getCaptchaAnswer(challenge.prompt, challenge.options);
    const buyerName = `Rate Lead Buyer ${attempt}`;

    const response = await submitLead({
      itemId,
      buyerName,
      captchaToken: challenge.token,
      captchaAnswer: answer,
      ipAddress,
    });

    assert.equal(response.status, 201, `lead attempt ${attempt} should succeed, got ${response.status}`);
  }

  const throttledChallenge = await fetchHumanCheck(ipAddress);
  const throttledAnswer = getCaptchaAnswer(throttledChallenge.prompt, throttledChallenge.options);
  const throttledResponse = await submitLead({
    itemId,
    buyerName: "Rate Lead Buyer 11",
    captchaToken: throttledChallenge.token,
    captchaAnswer: throttledAnswer,
    ipAddress,
  });

  assert.equal(throttledResponse.status, 429, `11th lead submission should be throttled, got ${throttledResponse.status}`);
  const retryAfter = throttledResponse.headers.get("Retry-After");
  assert.ok(retryAfter, "throttled lead response should include Retry-After");
  assert.ok(Number(retryAfter) >= 1, `lead Retry-After should be >= 1, got ${retryAfter}`);
}

async function assertRateLimitedContactFlow() {
  const ipAddress = "203.0.113.61";

  log("Submitting public contact requests until route throttle limit is reached");
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const challenge = await fetchContactChallenge(ipAddress);
    const answer = getCaptchaAnswer(challenge.prompt, challenge.options);
    const buyerName = `Rate Contact Buyer ${attempt}`;

    const response = await submitContact({
      buyerName,
      captchaToken: challenge.token,
      captchaAnswer: answer,
      ipAddress,
    });

    assert.equal(response.status, 201, `contact attempt ${attempt} should succeed, got ${response.status}`);
  }

  const throttledChallenge = await fetchContactChallenge(ipAddress);
  const throttledAnswer = getCaptchaAnswer(throttledChallenge.prompt, throttledChallenge.options);
  const throttledResponse = await submitContact({
    buyerName: "Rate Contact Buyer 9",
    captchaToken: throttledChallenge.token,
    captchaAnswer: throttledAnswer,
    ipAddress,
  });

  assert.equal(throttledResponse.status, 429, `9th contact submission should be throttled, got ${throttledResponse.status}`);
  const retryAfter = throttledResponse.headers.get("Retry-After");
  assert.ok(retryAfter, "throttled contact response should include Retry-After");
  assert.ok(Number(retryAfter) >= 1, `contact Retry-After should be >= 1, got ${retryAfter}`);
}

async function assertNoExcessRows() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const leadsResult = await client.query(
      `select count(*)::int as count
       from leads
       where buyer_name like 'Rate Lead Buyer %'`,
    );

    const contactsResult = await client.query(
      `select count(*)::int as count
       from contact_submissions
       where buyer_name like 'Rate Contact Buyer %'`,
    );

    assert.equal(leadsResult.rows[0]?.count, 10, "lead rows should stop at throttle limit");
    assert.equal(contactsResult.rows[0]?.count, 8, "contact rows should stop at throttle limit");
  } finally {
    await client.end();
  }
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
      seedDescription: "Disposable row inserted by public rate-limit flow.",
    });

    appProcess = await startApp(config);
    await waitForApp(appBaseUrl);

    const itemId = await seedPublicItem();

    await assertRateLimitedLeadFlow(itemId);
    await assertRateLimitedContactFlow();
    await assertNoExcessRows();

    log("E2E public rate-limit flow completed successfully");
  } finally {
    await cleanupRun({ appProcess, rootDir, appPort, containerName });
  }
}

main().catch((error) => {
  process.stderr.write(`\n[e2e] ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
