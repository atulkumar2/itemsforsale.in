import { createWriteStream } from "node:fs";
import { mkdir, readFile, readdir, unlink } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

const MAX_TIMESTAMPED_LOGS = 5;
const VALID_RUN_STATES = new Set(["run", "not-run"]);

/**
 * Executes all E2E flow scripts in deterministic order.
 *
 * Discovery rule: any file in scripts/e2e/flows matching *-flow.mjs.
 * Run config rule: scripts/e2e/flow-run-config.json with either:
 * - a string value: "run" | "not-run"
 * - or an object: { status: "run" | "not-run", category: string }
 *
 * CLI options:
 * - --category <name>
 * - --category=<name>
 */
function getLogTimestamp() {
  return new Date().toISOString().replace(/[.:]/g, "-");
}

function parseRunnerOptions(argv) {
  const categories = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--category") {
      const category = argv[index + 1];

      if (!category) {
        throw new Error('Missing value for "--category". Example: node scripts/e2e/run-all.mjs --category system-environment');
      }

      categories.push(category);
      index += 1;
      continue;
    }

    if (arg.startsWith("--category=")) {
      const category = arg.slice("--category=".length);

      if (!category) {
        throw new Error('Missing value for "--category". Example: node scripts/e2e/run-all.mjs --category=system-environment');
      }

      categories.push(category);
      continue;
    }

    throw new Error(`Unknown argument "${arg}". Supported options: --category <name>`);
  }

  return {
    categories: [...new Set(categories)],
  };
}

function normalizeRunConfigEntry(fileName, entry) {
  if (typeof entry === "undefined") {
    return { status: "run", category: null };
  }

  if (typeof entry === "string") {
    if (!VALID_RUN_STATES.has(entry)) {
      throw new Error(
        `Invalid run state "${entry}" for ${fileName} in flow-run-config.json. Use "run" or "not-run".`,
      );
    }

    return { status: entry, category: null };
  }

  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new Error(
      `Invalid config for ${fileName} in flow-run-config.json. Use "run", "not-run", or an object with { status, category }.`,
    );
  }

  const { status = "run", category = null } = entry;

  if (!VALID_RUN_STATES.has(status)) {
    throw new Error(
      `Invalid run state "${String(status)}" for ${fileName} in flow-run-config.json. Use "run" or "not-run".`,
    );
  }

  if (category !== null && (typeof category !== "string" || category.trim().length === 0)) {
    throw new Error(
      `Invalid category for ${fileName} in flow-run-config.json. Category must be a non-empty string when provided.`,
    );
  }

  return {
    status,
    category: category?.trim() ?? null,
  };
}

function writeRunnerLog(logWriters, message) {
  const line = `${message}\n`;
  process.stdout.write(line);
  logWriters.timestamped.write(line);
  logWriters.latest.write(line);
}

function writeChunkToLogs(logWriters, chunk, target) {
  if (target === "stdout") {
    process.stdout.write(chunk);
  } else {
    process.stderr.write(chunk);
  }

  logWriters.timestamped.write(chunk);
  logWriters.latest.write(chunk);
}

function runFlowWithLogging(relativePath, cwd, logWriters) {
  return new Promise((resolve, reject) => {
    const child = spawn("node", [relativePath], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      writeChunkToLogs(logWriters, chunk, "stdout");
    });

    child.stderr?.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      writeChunkToLogs(logWriters, chunk, "stderr");
    });

    child.on("error", reject);

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(
        new Error(
          `node ${relativePath} failed with code ${code}\nstdout:\n${stdout}\nstderr:\n${stderr}`,
        ),
      );
    });
  });
}

function closeLogWriters(logWriters) {
  return Promise.all([
    new Promise((resolve) => {
      logWriters.timestamped.end(resolve);
    }),
    new Promise((resolve) => {
      logWriters.latest.end(resolve);
    }),
  ]);
}

async function rotateTimestampedLogs(logsDir, keepCount) {
  const entries = await readdir(logsDir, { withFileTypes: true });

  const timestampedLogNames = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /^run-all-\d{4}-\d{2}-\d{2}T.+\.log$/.test(name))
    .sort((left, right) => right.localeCompare(left));

  const logsToDelete = timestampedLogNames.slice(keepCount);

  await Promise.all(
    logsToDelete.map(async (fileName) => {
      const filePath = path.join(logsDir, fileName);
      await unlink(filePath);
    }),
  );

  return logsToDelete;
}

async function main() {
  const options = parseRunnerOptions(process.argv.slice(2));
  const scriptsDir = path.join(process.cwd(), "scripts", "e2e");
  const flowScriptsDir = path.join(scriptsDir, "flows");
  const runConfigPath = path.join(scriptsDir, "flow-run-config.json");
  const logsDir = path.join(scriptsDir, "logs");
  const logTimestamp = getLogTimestamp();
  const timestampedLogPath = path.join(logsDir, `run-all-${logTimestamp}.log`);
  const latestLogPath = path.join(logsDir, "run-all-latest.log");

  await mkdir(logsDir, { recursive: true });

  const logWriters = {
    timestamped: createWriteStream(timestampedLogPath, { flags: "w" }),
    latest: createWriteStream(latestLogPath, { flags: "w" }),
  };

  const relativeTimestampedLogPath = path.posix.join("scripts", "e2e", "logs", `run-all-${logTimestamp}.log`);
  const relativeLatestLogPath = path.posix.join("scripts", "e2e", "logs", "run-all-latest.log");
  const entries = await readdir(flowScriptsDir, { withFileTypes: true });
  let runConfig = {};

  try {
    const rawConfig = await readFile(runConfigPath, "utf8");
    runConfig = JSON.parse(rawConfig);
  } catch (error) {
    if (!(error instanceof Error) || !String(error).includes("ENOENT")) {
      throw new Error(`Unable to read E2E run config at ${runConfigPath}`, { cause: error });
    }
  }

  const flowFiles = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name.endsWith("-flow.mjs"))
    .sort((left, right) => left.localeCompare(right));

  if (flowFiles.length === 0) {
    writeRunnerLog(logWriters, "[e2e] No flow scripts found in scripts/e2e/flows.");
    writeRunnerLog(logWriters, `[e2e] Log file: ${relativeTimestampedLogPath}`);
    await closeLogWriters(logWriters);
    return;
  }

  writeRunnerLog(logWriters, `[e2e] Log file: ${relativeTimestampedLogPath}`);
  writeRunnerLog(logWriters, `[e2e] Latest log alias: ${relativeLatestLogPath}`);
  writeRunnerLog(logWriters, `[e2e] Discovered ${flowFiles.length} flow script(s).`);

  const configuredFlows = flowFiles.map((fileName) => {
    const normalizedConfig = normalizeRunConfigEntry(fileName, runConfig[fileName]);

    return {
      fileName,
      ...normalizedConfig,
    };
  });

  const availableCategories = [...new Set(configuredFlows.map((flow) => flow.category).filter(Boolean))].sort((left, right) => left.localeCompare(right));

  if (options.categories.length > 0) {
    const unknownCategories = options.categories.filter((category) => !availableCategories.includes(category));

    if (unknownCategories.length > 0) {
      throw new Error(
        `Unknown E2E category ${unknownCategories.map((category) => `"${category}"`).join(", ")}. Available categories: ${availableCategories.join(", ")}`,
      );
    }

    writeRunnerLog(logWriters, `[e2e] Category filter: ${options.categories.join(", ")}`);
  }

  const runnableFiles = configuredFlows.filter(({ fileName, status, category }) => {
    const relativePath = path.posix.join("scripts", "e2e", "flows", fileName);

    if (status === "not-run") {
      writeRunnerLog(logWriters, `[e2e] Skipping ${relativePath} (marked not-run)`);
      return false;
    }

    if (options.categories.length > 0 && !options.categories.includes(category)) {
      writeRunnerLog(logWriters, `[e2e] Skipping ${relativePath} (category ${category ?? "unassigned"} not selected)`);
      return false;
    }

    return true;
  });

  if (runnableFiles.length === 0) {
    if (options.categories.length > 0) {
      writeRunnerLog(logWriters, `[e2e] No runnable flow scripts matched category filter: ${options.categories.join(", ")}.`);
    } else {
      writeRunnerLog(logWriters, "[e2e] All discovered flow scripts are marked not-run.");
    }

    await closeLogWriters(logWriters);
    return;
  }

  writeRunnerLog(logWriters, "[e2e] Execution plan:");
  runnableFiles.forEach(({ fileName, category }, index) => {
    const relativePath = path.posix.join("scripts", "e2e", "flows", fileName);
    const categorySuffix = category ? ` [${category}]` : "";
    writeRunnerLog(logWriters, `[e2e]   ${index + 1}. ${relativePath}${categorySuffix}`);
  });

  try {
    for (const [index, { fileName, category }] of runnableFiles.entries()) {
      const relativePath = path.posix.join("scripts", "e2e", "flows", fileName);
      const categorySuffix = category ? ` [${category}]` : "";
      writeRunnerLog(logWriters, `\n[e2e] [${index + 1}/${runnableFiles.length}] Starting ${relativePath}${categorySuffix}`);
      const startedAt = Date.now();

      await runFlowWithLogging(relativePath, process.cwd(), logWriters);

      const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
      writeRunnerLog(logWriters, `[e2e] [${index + 1}/${runnableFiles.length}] Completed ${relativePath} (${elapsedSeconds}s)`);
    }

    writeRunnerLog(logWriters, "[e2e] All E2E flow scripts completed successfully.");
  } finally {
    await closeLogWriters(logWriters);

    const deletedLogNames = await rotateTimestampedLogs(logsDir, MAX_TIMESTAMPED_LOGS);

    if (deletedLogNames.length > 0) {
      process.stdout.write(
        `[e2e] Rotated timestamped logs: removed ${deletedLogNames.length}, keeping latest ${MAX_TIMESTAMPED_LOGS}.\n`,
      );
    }
  }
}

main().catch((error) => {
  process.stderr.write(`\n[e2e] ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
