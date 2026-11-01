/**
 * reset under piped stdio, through the real built CLI. The confirmation prompt
 * needs a terminal, so it is covered in interactive.test.ts.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { saveConfig, type WizardConfig } from "../lib/config.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const CLI_ENTRY = path.resolve(here, "..", "..", "dist", "index.js");

interface RunResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}

function runCli(opts: {
  args: string[];
  env?: Record<string, string>;
  timeoutMs?: number;
}): Promise<RunResult> {
  return new Promise((resolve) => {
    const child: ChildProcessWithoutNullStreams = spawn(
      process.execPath,
      [CLI_ENTRY, ...opts.args],
      {
        env: { ...process.env, ...(opts.env ?? {}) },
        stdio: ["pipe", "pipe", "pipe"],
      }
    );

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d: Buffer) => {
      stdout += d.toString("utf8");
    });
    child.stderr.on("data", (d: Buffer) => {
      stderr += d.toString("utf8");
    });

    const hardTimer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        /* ignore */
      }
    }, opts.timeoutMs ?? 60000);

    child.on("close", (code, signal) => {
      clearTimeout(hardTimer);
      resolve({ code, signal, stdout, stderr });
    });
  });
}

beforeAll(() => {
  if (!fsSync.existsSync(CLI_ENTRY)) {
    throw new Error(
      `Built CLI not found at ${CLI_ENTRY}. Run \`npm run build\` first.`
    );
  }
});

describe("reset command", { timeout: 60000 }, () => {
  let cfgDir: string;

  beforeEach(async () => {
    cfgDir = await fs.mkdtemp(path.join(os.tmpdir(), "pz-reset-"));
  });

  afterEach(async () => {
    await fs.rm(cfgDir, { recursive: true, force: true }).catch(() => {});
  });

  it("exits cleanly in non-TTY mode with no config", async () => {
    const r = await runCli({
      args: ["reset"],
      env: { ANTIGRAVITY_CONFIG_DIR: cfgDir },
    });
    expect(r.stdout).toMatch(/interactive terminal/i);
    // Nothing was cleared, so a script must not read this as success.
    expect(r.code).toBe(1);
  });

  it("does not hang in non-TTY (piped stdin)", async () => {
    const start = Date.now();
    const r = await runCli({
      args: ["reset"],
      env: { ANTIGRAVITY_CONFIG_DIR: cfgDir },
      timeoutMs: 30000,
    });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(30000);
    expect(r.stdout).toMatch(/interactive terminal/i);
    expect(r.signal).toBeNull();
  });

  it("refuses in non-TTY mode and leaves an existing config in place", async () => {
    const prev = process.env.ANTIGRAVITY_CONFIG_DIR;
    process.env.ANTIGRAVITY_CONFIG_DIR = cfgDir;
    try {
      const cfg: WizardConfig = {
        projectName: "reset-test",
        agents: ["coder"],
        includeTemplates: true,
      };
      saveConfig(cfg);
    } finally {
      if (prev === undefined) delete process.env.ANTIGRAVITY_CONFIG_DIR;
      else process.env.ANTIGRAVITY_CONFIG_DIR = prev;
    }

    const r = await runCli({
      args: ["reset"],
      env: { ANTIGRAVITY_CONFIG_DIR: cfgDir },
    });
    expect(r.stdout).toMatch(/interactive terminal/i);
    expect(r.code).toBe(1);
    const stored = JSON.parse(fsSync.readFileSync(path.join(cfgDir, "config.json"), "utf8"));
    expect(stored.wizard.projectName).toBe("reset-test");
  });
});
