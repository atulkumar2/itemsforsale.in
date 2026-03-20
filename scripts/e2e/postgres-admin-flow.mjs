import { strict as assert } from "node:assert";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

import { Client, types } from "pg";
import sharp from "sharp";
import {
  killProcessListeningOnPort,
  log,
  removeContainerIfExists,
  runCommand,
} from "./helpers.mjs";

// Configure pg to return DATE columns as strings instead of Date objects
// Type OID 1082 is DATE type in PostgreSQL
types.setTypeParser(1082, (value) => value);

const containerName = process.env.E2E_POSTGRES_CONTAINER ?? "itemsforsale-e2e-postgres";
const postgresPort = Number(process.env.E2E_POSTGRES_PORT ?? "54321");
const appPort = Number(process.env.E2E_APP_PORT ?? String(3400 + Math.floor(Math.random() * 1000)));
const postgresDb = process.env.E2E_POSTGRES_DB ?? "itemsforsale_e2e";
const postgresUser = process.env.E2E_POSTGRES_USER ?? "postgres";
const postgresPassword = process.env.E2E_POSTGRES_PASSWORD ?? "postgres";
const appBaseUrl = `http://127.0.0.1:${appPort}`;
const databaseUrl = `postgresql://${postgresUser}:${postgresPassword}@127.0.0.1:${postgresPort}/${postgresDb}`;
const adminEmail = "e2e-admin@example.com";
const adminPassword = "E2e-admin-pass-123";
const adminSessionSecret = "e2e-session-secret";
const captchaSecret = "e2e-captcha-secret";
const rootDir = process.cwd();

let appProcess = null;
let createdItemId = null;

async function ensureDockerAvailable() {
  try {
    await runCommand("docker", ["info"], { cwd: rootDir });
  } catch (error) {
    throw new Error(
      "Docker is not available. Start Docker Desktop (or another Docker daemon) and retry this end-to-end test.",
      { cause: error },
    );
  }
}

async function startPostgresContainer() {
  await removeContainerIfExists(containerName, rootDir);
  log(`Starting disposable Postgres container ${containerName} on port ${postgresPort}`);
  await runCommand("docker", [
    "run",
    "-d",
    "--rm",
    "--name",
    containerName,
    "-e",
    `POSTGRES_DB=${postgresDb}`,
    "-e",
    `POSTGRES_USER=${postgresUser}`,
    "-e",
    `POSTGRES_PASSWORD=${postgresPassword}`,
    "-p",
    `${postgresPort}:5432`,
    "postgres:16-alpine",
  ], { cwd: rootDir });
}

async function waitForPostgres() {
  log("Waiting for PostgreSQL to accept connections");
  for (let attempt = 0; attempt < 60; attempt += 1) {
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
        // Ignore cleanup errors during retries.
      }
      await delay(1000);
    }
  }

  throw new Error("PostgreSQL did not become ready in time.");
}

async function applySchemaAndSeedData() {
  log("Applying PostgreSQL DDL and inserting dummy seed data");
  const ddl = await readFile(path.join(rootDir, "data", "postgres.local.sql"), "utf8");
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query(ddl);
    const dummyItemId = randomUUID();
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
        dummyItemId,
        "dummy-seed-item",
        "Dummy Seed Item",
        "Disposable row inserted by the end-to-end admin flow test.",
        "Seed",
        "Used",
        "2024-01-10",
        2500,
        1800,
        "2026-04-10",
        "Seed location",
        "available",
        now,
        now,
      ],
    );
  } finally {
    await client.end();
  }
}

async function startApp() {
  log(`Starting Next.js app on ${appBaseUrl}`);
  const command = process.platform === "win32" ? "cmd.exe" : "npm";
  const args =
    process.platform === "win32"
      ? ["/d", "/s", "/c", "npm run dev:webpack -- -H 127.0.0.1 -p " + String(appPort)]
      : ["run", "dev:webpack", "--", "-H", "127.0.0.1", "-p", String(appPort)];

  appProcess = spawn(command, args, {
    cwd: rootDir,
    detached: process.platform !== "win32",
    env: {
      ...process.env,
      DATA_MODE: "postgres",
      DATABASE_URL: databaseUrl,
      NEXT_PUBLIC_APP_URL: appBaseUrl,
      ADMIN_EMAIL: adminEmail,
      ADMIN_PASSWORD: adminPassword,
      ADMIN_SESSION_SECRET: adminSessionSecret,
      CONTACT_CAPTCHA_SECRET: captchaSecret,
      WATCHPACK_POLLING: "true",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  appProcess.stdout?.on("data", (chunk) => {
    process.stdout.write(`[app] ${chunk.toString()}`);
  });
  appProcess.stderr?.on("data", (chunk) => {
    process.stderr.write(`[app] ${chunk.toString()}`);
  });

  appProcess.on("exit", (code) => {
    if (code !== null && code !== 0) {
      process.stderr.write(`[e2e] App process exited with code ${code}\n`);
    }
  });
}

async function waitForApp() {
  log("Waiting for app HTTP server");
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(`${appBaseUrl}/admin/login`, { redirect: "manual" });
      if (response.ok || response.status === 307 || response.status === 429) {
        // 429 means app is responding (rate limited) so it's ready
        // Add extra delay to ensure app is fully stable
        await delay(2000);
        return;
      }
    } catch {
      // Retry until boot finishes.
    }

    await delay(1000);
  }

  throw new Error("App server did not become ready in time.");
}

async function fetchCaptchaChallenge() {
  const response = await fetch(`${appBaseUrl}/api/human-check`, {
    headers: { "Cache-Control": "no-store" },
  });
  assert.equal(response.status, 200, "captcha endpoint should return 200");
  return response.json();
}

function mergeCookies(existingCookieHeader, response) {
  const jar = new Map();

  for (const part of existingCookieHeader.split(";").map((entry) => entry.trim()).filter(Boolean)) {
    const [name, ...rest] = part.split("=");
    jar.set(name, rest.join("="));
  }

  for (const cookie of response.headers.getSetCookie()) {
    const [pair] = cookie.split(";", 1);
    const [name, ...rest] = pair.split("=");
    jar.set(name, rest.join("="));
  }

  return Array.from(jar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

async function loginAsAdmin() {
  log("Logging in through the real admin login route");
  const challenge = await fetchCaptchaChallenge();
  let cookieHeader = "";
  let lastError = null;

  for (const option of challenge.options) {
    const response = await fetch(`${appBaseUrl}/api/admin/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      body: JSON.stringify({
        email: adminEmail,
        password: adminPassword,
        captchaToken: challenge.token,
        captchaAnswer: option,
      }),
    });

    if (response.ok) {
      cookieHeader = mergeCookies(cookieHeader, response);
      assert.match(cookieHeader, /itemsforsale-admin-session=/, "admin session cookie should be set");
      return cookieHeader;
    }

    lastError = await response.text();
  }

  throw new Error(`Unable to solve login captcha in 4 attempts.\n${lastError ?? ""}`);
}

async function createImageFile(name, color) {
  const buffer = await sharp({
    create: {
      width: 1200,
      height: 900,
      channels: 3,
      background: color,
    },
  })
    .png()
    .toBuffer();

  return new File([buffer], name, { type: "image/png" });
}

async function createItem(cookieHeader) {
  log("Creating a new admin item with three uploaded photos");
  const form = new FormData();
  form.set("title", "E2E Postgres Test Chair");
  form.set("description", "Created by the disposable end-to-end PostgreSQL flow.");
  form.set("category", "Testing");
  form.set("condition", "Great");
  form.set("purchaseDate", "2024-02-15");
  form.set("purchasePrice", "12000");
  form.set("expectedPrice", "8000");
  form.set("availableFrom", "2026-05-01");
  form.set("locationArea", "");
  form.set("status", "available");
  form.append("images", await createImageFile("chair-red.png", { r: 210, g: 90, b: 90 }));
  form.append("images", await createImageFile("chair-green.png", { r: 90, g: 180, b: 120 }));
  form.append("images", await createImageFile("chair-blue.png", { r: 80, g: 120, b: 220 }));

  const response = await fetch(`${appBaseUrl}/api/admin/items`, {
    method: "POST",
    headers: {
      Cookie: cookieHeader,
    },
    body: form,
  });

  assert.equal(response.status, 200, "item create should succeed");
  const payload = await response.json();
  assert.ok(payload.itemId, "create route should return itemId");
  createdItemId = payload.itemId;
  return payload.itemId;
}

async function getItemState(itemId) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const itemResult = await client.query(
      `select id, slug, title, description, category, condition, purchase_date, purchase_price,
              expected_price, available_from, location_area, status
         from items
         where id = $1`,
      [itemId],
    );
    const imageResult = await client.query(
      `select id, image_url, thumbnail_url, sort_order
         from item_images
         where item_id = $1
         order by sort_order asc, created_at asc`,
      [itemId],
    );
    const item = itemResult.rows[0] ?? null;
    if (item) {
      log(`DEBUG: available_from from DB: "${item.available_from}" (type: ${typeof item.available_from})`);
      log(`DEBUG: full item: ${JSON.stringify(item, null, 2)}`);
    }
    return {
      item,
      images: imageResult.rows,
    };
  } finally {
    await client.end();
  }
}

async function assertFileExists(relativeUrl) {
  const filePath = path.join(rootDir, "public", relativeUrl.replace(/^\/+/, "").replace(/\//g, path.sep));
  await stat(filePath);
}

async function assertFileMissing(relativeUrl) {
  const filePath = path.join(rootDir, "public", relativeUrl.replace(/^\/+/, "").replace(/\//g, path.sep));
  try {
    await stat(filePath);
  } catch {
    return;
  }

  throw new Error(`Expected ${relativeUrl} to be deleted, but it still exists.`);
}

async function editItem(cookieHeader, itemId, existingImages) {
  log("Editing the item, removing one image, and adding a replacement image");
  const [removedImage] = existingImages;
  assert.ok(removedImage, "expected an image to remove during edit");

  const form = new FormData();
  form.set("id", itemId);
  form.set("title", "E2E Postgres Test Chair Updated");
  form.set("description", "Updated by the disposable end-to-end PostgreSQL flow.");
  form.set("category", "Testing Updated");
  form.set("condition", "Very good");
  form.set("purchaseDate", "2024-03-01");
  form.set("purchasePrice", "12500");
  form.set("expectedPrice", "7600");
  form.set("availableFrom", "2026-05-12");
  form.set("locationArea", "Seller fallback page expected");
  form.set("status", "reserved");
  form.append("removeImageIds", removedImage.id);
  form.append("images", await createImageFile("chair-yellow.png", { r: 230, g: 190, b: 70 }));

  const response = await fetch(`${appBaseUrl}/api/admin/items`, {
    method: "POST",
    headers: {
      Cookie: cookieHeader,
    },
    body: form,
  });

  assert.equal(response.status, 200, "item edit should succeed");
  await response.json();
  return removedImage;
}

async function verifyScenario(itemId, removedImage) {
  log("Verifying item updates, image mutations, and public item page rendering");
  const afterEdit = await getItemState(itemId);
  assert.ok(afterEdit.item, "edited item should still exist");
  assert.equal(afterEdit.item.title, "E2E Postgres Test Chair Updated");
  assert.equal(afterEdit.item.category, "Testing Updated");
  assert.equal(afterEdit.item.condition, "Very good");
  assert.equal(afterEdit.item.status, "reserved");
  assert.equal(String(afterEdit.item.expected_price), "7600.00");
  assert.equal(afterEdit.item.available_from.toISOString?.()?.slice?.(0, 10) ?? String(afterEdit.item.available_from).slice(0, 10), "2026-05-12");
  assert.equal(afterEdit.images.length, 3, "three images should remain after one delete and one add");
  assert.ok(!afterEdit.images.some((image) => image.id === removedImage.id), "removed image row should be gone");
  assert.deepEqual(
    afterEdit.images.map((image) => image.sort_order),
    [0, 1, 2],
    "sort order should be compact after removal and insert",
  );

  for (const image of afterEdit.images) {
    await assertFileExists(image.image_url);
    await assertFileExists(image.thumbnail_url);
  }
  await assertFileMissing(removedImage.image_url);
  await assertFileMissing(removedImage.thumbnail_url);

  const publicItemResponse = await fetch(`${appBaseUrl}/items/${afterEdit.item.slug}`);
  assert.equal(publicItemResponse.status, 200, "public item page should render");
  const publicItemHtml = await publicItemResponse.text();
  assert.match(publicItemHtml, /E2E Postgres Test Chair Updated/);
  assert.match(publicItemHtml, /Seller fallback page expected/);
}

async function cleanup() {
  log("Cleaning up disposable resources");

  if (appProcess) {
    const waitForExit = () => {
      if (appProcess.exitCode !== null) {
        return Promise.resolve();
      }

      return new Promise((resolve) => {
        appProcess.once("exit", resolve);
      });
    };

    if (appProcess.exitCode === null) {
      if (process.platform === "win32") {
        appProcess.kill("SIGTERM");
      } else if (appProcess.pid) {
        try {
          process.kill(-appProcess.pid, "SIGTERM");
        } catch {
          appProcess.kill("SIGTERM");
        }
      } else {
        appProcess.kill("SIGTERM");
      }

      const exitedGracefully = await Promise.race([
        waitForExit().then(() => true),
        delay(5000).then(() => false),
      ]);

      if (!exitedGracefully && appProcess.exitCode === null) {
        if (process.platform === "win32") {
          appProcess.kill("SIGKILL");
        } else if (appProcess.pid) {
          try {
            process.kill(-appProcess.pid, "SIGKILL");
          } catch {
            appProcess.kill("SIGKILL");
          }
        } else {
          appProcess.kill("SIGKILL");
        }
        await waitForExit();
      }
    }
  }

  if (createdItemId) {
    await rm(path.join(rootDir, "public", "uploads", createdItemId), {
      recursive: true,
      force: true,
    });
  }

  log(`Ensuring app process on port ${appPort} is stopped`);
  await killProcessListeningOnPort(appPort, { cwd: rootDir });

  await removeContainerIfExists(containerName, rootDir);
}

async function preflightCleanup() {
  log("Cleaning up any stray Docker containers from previous runs");
  try {
    await runCommand("docker", ["rm", "-f", containerName], { cwd: rootDir });
  } catch {
    // Ignore cleanup errors during preflight
  }

  if (process.platform !== "win32") {
    log("Stopping stray next dev processes");
    try {
      await runCommand("sh", ["-lc", "pkill -f 'next dev' || true"], { cwd: rootDir });
    } catch {
      // Ignore if no matching process is running
    }
  }

  try {
    await rm(path.join(rootDir, ".next", "dev", "lock"), { force: true });
  } catch {
    // Ignore if lock file does not exist
  }

  log(`Cleaning up any stale app process on port ${appPort}`);
  await killProcessListeningOnPort(appPort, { cwd: rootDir });
}

async function main() {
  try {
    await preflightCleanup();
    await ensureDockerAvailable();
    await startPostgresContainer();
    await waitForPostgres();
    await applySchemaAndSeedData();
    await startApp();
    await waitForApp();

    const cookieHeader = await loginAsAdmin();
    const itemId = await createItem(cookieHeader);
    const afterCreate = await getItemState(itemId);
    assert.ok(afterCreate.item, "created item should exist");
    assert.equal(afterCreate.item.title, "E2E Postgres Test Chair");
    assert.equal(afterCreate.images.length, 3, "create flow should persist three images");

    for (const image of afterCreate.images) {
      await assertFileExists(image.image_url);
      await assertFileExists(image.thumbnail_url);
    }

    const removedImage = await editItem(cookieHeader, itemId, afterCreate.images);
    await verifyScenario(itemId, removedImage);

    log("E2E PostgreSQL admin flow completed successfully");
  } finally {
    await cleanup();
  }
}

main().catch((error) => {
  process.stderr.write(`\n[e2e] ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
