import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { runCommand } from "./helpers.mjs";

/**
 * Executes all E2E flow scripts in deterministic order.
 *
 * Discovery rule: any file in scripts/e2e matching *-flow.mjs.
 * Run config rule: scripts/e2e/flow-run-config.json with values "run" or "not-run".
 */
async function main() {
  const scriptsDir = path.join(process.cwd(), "scripts", "e2e");
  const runConfigPath = path.join(scriptsDir, "flow-run-config.json");
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
    process.stdout.write("[e2e] No flow scripts found in scripts/e2e.\n");
    return;
  }

  process.stdout.write(`[e2e] Discovered ${flowFiles.length} flow script(s).\n`);

  const runnableFiles = flowFiles.filter((fileName) => {
    const runState = runConfig[fileName] ?? "run";

    if (runState === "not-run") {
      const relativePath = path.posix.join("scripts", "e2e", fileName);
      process.stdout.write(`[e2e] Skipping ${relativePath} (marked not-run)\n`);
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
    process.stdout.write("[e2e] All discovered flow scripts are marked not-run.\n");
    return;
  }

  for (const fileName of runnableFiles) {
    const relativePath = path.posix.join("scripts", "e2e", fileName);
    process.stdout.write(`[e2e] Running ${relativePath}\n`);

    await runCommand("node", [relativePath], {
      cwd: process.cwd(),
      stdio: "inherit",
    });
  }

  process.stdout.write("[e2e] All E2E flow scripts completed successfully.\n");
}

main().catch((error) => {
  process.stderr.write(`\n[e2e] ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
