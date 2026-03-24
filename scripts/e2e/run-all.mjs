import { createWriteStream } from "node:fs";
import { mkdir, readFile, readdir, unlink } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

const MAX_TIMESTAMPED_LOGS = 5;

/**
 * Executes all E2E flow scripts in deterministic order.
 *
 * Discovery rule: any file in scripts/e2e matching *-flow.mjs.
 * Run config rule: scripts/e2e/flow-run-config.json with values "run" or "not-run".
 */
function getLogTimestamp() {
  return new Date().toISOString().replace(/[.:]/g, "-");
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
  const scriptsDir = path.join(process.cwd(), "scripts", "e2e");
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
  const entries = await readdir(scriptsDir, { withFileTypes: true });
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
    writeRunnerLog(logWriters, "[e2e] No flow scripts found in scripts/e2e.");
    writeRunnerLog(logWriters, `[e2e] Log file: ${relativeTimestampedLogPath}`);
    await closeLogWriters(logWriters);
    return;
  }

  writeRunnerLog(logWriters, `[e2e] Log file: ${relativeTimestampedLogPath}`);
  writeRunnerLog(logWriters, `[e2e] Latest log alias: ${relativeLatestLogPath}`);
  writeRunnerLog(logWriters, `[e2e] Discovered ${flowFiles.length} flow script(s).`);

  const runnableFiles = flowFiles.filter((fileName) => {
    const runState = runConfig[fileName] ?? "run";

    if (runState === "not-run") {
      const relativePath = path.posix.join("scripts", "e2e", fileName);
      writeRunnerLog(logWriters, `[e2e] Skipping ${relativePath} (marked not-run)`);
      return false;
    }

    if (runState !== "run") {
      throw new Error(
        `Invalid run state \"${String(runState)}\" for ${fileName} in flow-run-config.json. Use \"run\" or \"not-run\".`,
      );
    }

    return true;
  });

  if (runnableFiles.length === 0) {
    writeRunnerLog(logWriters, "[e2e] All discovered flow scripts are marked not-run.");
    await closeLogWriters(logWriters);
    return;
  }

  writeRunnerLog(logWriters, "[e2e] Execution plan:");
  runnableFiles.forEach((fileName, index) => {
    const relativePath = path.posix.join("scripts", "e2e", fileName);
    writeRunnerLog(logWriters, `[e2e]   ${index + 1}. ${relativePath}`);
  });

  try {
    for (const [index, fileName] of runnableFiles.entries()) {
      const relativePath = path.posix.join("scripts", "e2e", fileName);
      writeRunnerLog(logWriters, `\n[e2e] [${index + 1}/${runnableFiles.length}] Starting ${relativePath}`);
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
