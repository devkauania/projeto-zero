/**
 * Session 14d — reset command tests.
 *
 * Tests the `reset` command via child_process.spawn against the real
 * built CLI at dist/index.js. No mocks.
 *
 * Known gap: The interactive confirmation flow (p.confirm) cannot be
 * tested via spawn because piped stdio triggers the non-TTY guard in
 * reset.ts, which exits before reaching the confirmation prompt.
 * Testing the TTY-dependent confirmation path would require a
 * pseudo-TTY, which is outside the scope of this session.
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
    }, opts.timeoutMs ?? 8000);

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

describe("reset command", { timeout: 15000 }, () => {
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
    expect(r.code).toBe(0);
  });

  it("does not hang in non-TTY (piped stdin) — terminates within 5s", async () => {
    const start = Date.now();
    const r = await runCli({
      args: ["reset"],
      env: { ANTIGRAVITY_CONFIG_DIR: cfgDir },
      timeoutMs: 5000,
    });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000);
    expect(r.stdout).toMatch(/interactive terminal/i);
    expect(r.signal).toBeNull();
  });

  it("exits cleanly in non-TTY mode even with existing config (known gap: interactive confirmation untestable via spawn)", async () => {
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
    expect(r.code).toBe(0);
  });
});
