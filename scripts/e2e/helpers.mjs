import { spawn } from "node:child_process";
import process from "node:process";

/**
 * Shared helpers used by E2E scripts under scripts/e2e.
 *
 * The helpers here intentionally avoid test-framework dependencies so the
 * scripts can be run directly with node.
 */

/** Logs a line with a consistent E2E prefix. */
export function log(message) {
  process.stdout.write(`[e2e] ${message}\n`);
}

/**
 * Runs a command and returns collected stdout/stderr.
 * Rejects when the process exits with a non-zero code.
 */
export function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(
        new Error(
          `${command} ${args.join(" ")} failed with code ${code}\nstdout:\n${stdout}\nstderr:\n${stderr}`,
        ),
      );
    });
  });
}

/** Best-effort cleanup helper for a known Docker container name. */
export async function removeContainerIfExists(containerName, cwd = process.cwd()) {
  try {
    await runCommand("docker", ["rm", "-f", containerName], { cwd });
  } catch {
    // Ignore missing container.
  }
}

/**
 * Kills listeners bound to the provided port.
 *
 * This is used in cleanup/preflight so repeated E2E runs can start from a
 * deterministic state.
 */
export async function killProcessListeningOnPort(
  port,
  { cwd = process.cwd(), excludePids = [process.pid, process.ppid] } = {},
) {
  if (process.platform === "win32") {
    try {
      await runCommand(
        "cmd.exe",
        [
          "/d",
          "/s",
          "/c",
          `for /f "tokens=5" %a in ('netstat -aon ^| findstr :${String(port)} ^| findstr LISTENING') do taskkill /PID %a /F`,
        ],
        { cwd },
      );
    } catch {
      // Ignore missing listeners and command failures during cleanup
    }
    return;
  }

  try {
    const { stdout } = await runCommand(
      "sh",
      ["-lc", `lsof -ti:${String(port)} 2>/dev/null || true`],
      { cwd },
    );

    const pids = stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => Number(line))
      .filter((pid) => Number.isInteger(pid) && pid > 0);

    for (const pid of pids) {
      if (excludePids.includes(pid)) {
        continue;
      }

      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // Ignore race conditions where process exits between lookup and kill
      }
    }
  } catch {
    // Ignore missing listeners and command failures during cleanup
  }
}
