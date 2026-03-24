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
 * End-to-end captcha refresh flow.
 *
 * Coverage:
 * - fetch captcha challenge and refresh to obtain a different token
 * - verify stale token paired with refreshed answer is rejected
 * - verify refreshed challenge still allows successful public lead submission
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
        "human-check-refresh-item",
        "Human Check Refresh Item",
        "Seeded for captcha refresh E2E flow.",
        "Testing",
        "Great",
        "2024-01-10",
        9000,
        7000,
        "2026-05-01",
        "Whitefield",
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
      phone: "9000011111",
      email: "captcha-refresh@example.com",
      location: "HSR Layout",
      message: "Captcha refresh flow lead submission.",
      bidPrice: "6800",
      captchaToken,
      captchaAnswer,
    }),
  });
}

async function findRefreshedChallenge(firstChallenge, ipAddress) {
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    const nextChallenge = await fetchHumanCheck(ipAddress);

    if (nextChallenge.token === firstChallenge.token) {
      continue;
    }

    if (nextChallenge.prompt === firstChallenge.prompt) {
      continue;
    }

    const answerOnlyInRefreshedChallenge = nextChallenge.options.find(
      (option) => !firstChallenge.options.includes(option),
    );

    if (!answerOnlyInRefreshedChallenge) {
      continue;
    }

    return { nextChallenge, answerOnlyInRefreshedChallenge };
  }

  throw new Error("Unable to fetch a distinct refreshed challenge with a non-overlapping option.");
}

async function assertLeadRows(staleBuyerName, successBuyerName) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const staleResult = await client.query(
      `select count(*)::int as count
       from leads
       where buyer_name = $1`,
      [staleBuyerName],
    );

    const successResult = await client.query(
      `select count(*)::int as count
       from leads
       where buyer_name = $1`,
      [successBuyerName],
    );

    assert.equal(staleResult.rows[0]?.count, 0, "stale token attempt should not create lead row");
    assert.equal(successResult.rows[0]?.count, 1, "refreshed challenge should create exactly one lead row");
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
      seedDescription: "Disposable row inserted by captcha refresh flow.",
    });

    appProcess = await startApp(config);
    await waitForApp(appBaseUrl);

    const itemId = await seedPublicItem();
    const ipAddress = "198.51.100.40";

    log("Fetching initial challenge and refreshed challenge");
    const firstChallenge = await fetchHumanCheck(ipAddress);
    const { nextChallenge, answerOnlyInRefreshedChallenge } = await findRefreshedChallenge(firstChallenge, ipAddress);

    assert.notEqual(firstChallenge.token, nextChallenge.token, "refreshed challenge token should change");

    log("Verifying stale token with refreshed answer is rejected");
    const staleBuyerName = "Captcha Refresh Stale Buyer";
    const staleResponse = await submitLead({
      itemId,
      buyerName: staleBuyerName,
      captchaToken: firstChallenge.token,
      captchaAnswer: answerOnlyInRefreshedChallenge,
      ipAddress,
    });

    assert.equal(staleResponse.status, 400, `stale token submission should fail with 400, got ${staleResponse.status}`);

    log("Verifying refreshed challenge still allows a valid submission");
    const successBuyerName = "Captcha Refresh Success Buyer";
    const correctRefreshedAnswer = getCaptchaAnswer(nextChallenge.prompt, nextChallenge.options);
    const refreshedResponse = await submitLead({
      itemId,
      buyerName: successBuyerName,
      captchaToken: nextChallenge.token,
      captchaAnswer: correctRefreshedAnswer,
      ipAddress,
    });

    assert.equal(refreshedResponse.status, 201, `refreshed token submission should succeed, got ${refreshedResponse.status}`);
    await assertLeadRows(staleBuyerName, successBuyerName);

    log("E2E human-check refresh flow completed successfully");
  } finally {
    await cleanupRun({ appProcess, rootDir, appPort, containerName });
  }
}

main().catch((error) => {
  process.stderr.write(`\n[e2e] ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
