// Runs the real built CLI as a child process and reads back what it saved.

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const CLI_ENTRY = path.resolve(here, "..", "..", "..", "dist", "index.js");

export function assertBuilt(): void {
  if (!fs.existsSync(CLI_ENTRY)) {
    throw new Error(`Built CLI not found at ${CLI_ENTRY}. Run \`npm run build\` first.`);
  }
}

export interface RunResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  /** stdout + stderr, for messages whose stream is not the point of the test. */
  all: string;
  timedOut: boolean;
}

export interface RunOptions {
  cwd?: string;
  env?: Record<string, string>;
  /** Replaces the inherited env entirely instead of extending it. */
  fullEnv?: Record<string, string>;
  /** Written to stdin in order, then stdin is closed. */
  stdin?: string;
  /** Delay before writing `stdin`, to behave like a slow producer. */
  stdinDelayMs?: number;
  /** Leave stdin open after writing. */
  keepStdinOpen?: boolean;
  timeoutMs?: number;
}

export function runCli(args: string[], opts: RunOptions = {}): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI_ENTRY, ...args], {
      cwd: opts.cwd,
      env: opts.fullEnv ?? { ...process.env, ...(opts.env ?? {}) },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    child.stdout.on("data", (d: Buffer) => (stdout += d.toString("utf8")));
    child.stderr.on("data", (d: Buffer) => (stderr += d.toString("utf8")));
    // The CLI may close its end first; that is not what these tests measure.
    child.stdin.on("error", () => {});

    const writeStdin = () => {
      if (opts.stdin !== undefined) child.stdin.write(opts.stdin);
      if (!opts.keepStdinOpen) child.stdin.end();
    };
    if (opts.stdinDelayMs) setTimeout(writeStdin, opts.stdinDelayMs);
    else writeStdin();

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, opts.timeoutMs ?? 150000);

    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, stdout, stderr, all: stdout + stderr, timedOut });
    });
  });
}

/** Read the store exactly as the CLI left it, bypassing the code under test. */
export function readSavedWizard(cfgDir: string): Record<string, unknown> | null {
  const file = path.join(cfgDir, "config.json");
  if (!fs.existsSync(file)) return null;
  const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as { wizard?: Record<string, unknown> | null };
  return parsed.wizard ?? null;
}

/** Write a store file directly, for shapes the CLI itself would never save. */
export function writeSavedWizard(cfgDir: string, wizard: unknown): void {
  fs.mkdirSync(cfgDir, { recursive: true });
  fs.writeFileSync(path.join(cfgDir, "config.json"), JSON.stringify({ wizard }));
}

/**
 * A directory link. A junction on Windows, which unlike a symlink needs no
 * privilege, so these tests run for real on every machine instead of skipping.
 */
export function linkDir(target: string, linkPath: string): void {
  fs.symlinkSync(target, linkPath, process.platform === "win32" ? "junction" : "dir");
}
