import { strict as assert } from "node:assert";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

import { Client } from "pg";
import sharp from "sharp";

import {
  killProcessListeningOnPort,
  log,
  removeContainerIfExists,
  runCommand,
} from "./helpers.mjs";

/**
 * Shared PostgreSQL E2E flow helpers used by scripts/e2e/*.mjs.
 */

/** Builds a default runtime config for postgres-backed E2E scripts. */
export function getPostgresE2EConfig() {
  const containerName = process.env.E2E_POSTGRES_CONTAINER ?? "itemsforsale-e2e-postgres";
  const postgresPort = Number(process.env.E2E_POSTGRES_PORT ?? "54321");
  const appPort = Number(process.env.E2E_APP_PORT ?? String(3400 + Math.floor(Math.random() * 1000)));
  const postgresDb = process.env.E2E_POSTGRES_DB ?? "itemsforsale_e2e";
  const postgresUser = process.env.E2E_POSTGRES_USER ?? "postgres";
  const postgresPassword = process.env.E2E_POSTGRES_PASSWORD ?? "postgres";

  return {
    containerName,
    postgresPort,
    appPort,
    postgresDb,
    postgresUser,
    postgresPassword,
    appBaseUrl: `http://127.0.0.1:${appPort}`,
    databaseUrl: `postgresql://${postgresUser}:${postgresPassword}@127.0.0.1:${postgresPort}/${postgresDb}`,
    adminEmail: "e2e-admin@example.com",
    adminPassword: "E2e-admin-pass-123",
    adminSessionSecret: "e2e-session-secret",
    captchaSecret: "e2e-captcha-secret",
    rootDir: process.cwd(),
  };
}

export async function ensureDockerAvailable(rootDir) {
  try {
    await runCommand("docker", ["info"], { cwd: rootDir });
  } catch (error) {
    throw new Error(
      "Docker is not available. Start Docker Desktop (or another Docker daemon) and retry this end-to-end test.",
      { cause: error },
    );
  }
}

export async function startPostgresContainer(config) {
  await removeContainerIfExists(config.containerName, config.rootDir);
  log(`Starting disposable Postgres container ${config.containerName} on port ${config.postgresPort}`);
  await runCommand("docker", [
    "run",
    "-d",
    "--rm",
    "--name",
    config.containerName,
    "-e",
    `POSTGRES_DB=${config.postgresDb}`,
    "-e",
    `POSTGRES_USER=${config.postgresUser}`,
    "-e",
    `POSTGRES_PASSWORD=${config.postgresPassword}`,
    "-p",
    `${config.postgresPort}:5432`,
    "postgres:16-alpine",
  ], { cwd: config.rootDir });
}

export async function waitForPostgres(databaseUrl) {
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

export async function applySchemaAndSeedData({ databaseUrl, rootDir, seedDescription }) {
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
        seedDescription,
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

export async function startApp(config) {
  log(`Starting Next.js app on ${config.appBaseUrl}`);
  const command = process.platform === "win32" ? "cmd.exe" : "npm";
  const args =
    process.platform === "win32"
      ? ["/d", "/s", "/c", "npm run dev:webpack -- -H 127.0.0.1 -p " + String(config.appPort)]
      : ["run", "dev:webpack", "--", "-H", "127.0.0.1", "-p", String(config.appPort)];

  const appProcess = spawn(command, args, {
    cwd: config.rootDir,
    detached: process.platform !== "win32",
    env: {
      ...process.env,
      DATA_MODE: "postgres",
      DATABASE_URL: config.databaseUrl,
      NEXT_PUBLIC_APP_URL: config.appBaseUrl,
      ADMIN_EMAIL: config.adminEmail,
      ADMIN_PASSWORD: config.adminPassword,
      ADMIN_SESSION_SECRET: config.adminSessionSecret,
      CONTACT_CAPTCHA_SECRET: config.captchaSecret,
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

  return appProcess;
}

export async function waitForApp(appBaseUrl) {
  log("Waiting for app HTTP server");
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(`${appBaseUrl}/admin/login`, { redirect: "manual" });
      if (response.ok || response.status === 307 || response.status === 429) {
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

async function fetchCaptchaChallenge(appBaseUrl) {
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

export async function loginAsAdmin({ appBaseUrl, adminEmail, adminPassword }) {
  log("Logging in through the real admin login route");
  const challenge = await fetchCaptchaChallenge(appBaseUrl);
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

export async function createImageFile(name, color) {
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

export async function assertFileExists(rootDir, relativeUrl) {
  const filePath = path.join(rootDir, "public", relativeUrl.replace(/^\/+/, "").replace(/\//g, path.sep));
  await stat(filePath);
}

export async function assertFileMissing(rootDir, relativeUrl) {
  const filePath = path.join(rootDir, "public", relativeUrl.replace(/^\/+/, "").replace(/\//g, path.sep));
  try {
    await stat(filePath);
  } catch {
    return;
  }

  throw new Error(`Expected ${relativeUrl} to be deleted, but it still exists.`);
}

async function stopAppProcess(appProcess) {
  if (!appProcess) {
    return;
  }

  const waitForExit = () => {
    if (appProcess.exitCode !== null) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      appProcess.once("exit", resolve);
    });
  };

  if (appProcess.exitCode !== null) {
    return;
  }

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

export async function cleanupRun({ appProcess, createdItemId, rootDir, appPort, containerName }) {
  log("Cleaning up disposable resources");

  await stopAppProcess(appProcess);

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

export async function preflightCleanup({ rootDir, containerName, appPort }) {
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
