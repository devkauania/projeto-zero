/**
 * Session 14d — generate command tests.
 *
 * Tests the `generate` command via child_process.spawn against the real
 * built CLI at dist/index.js. No mocks of fs, Conf, or child_process.
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

const STACK_TRACE_RE = /\n\s+at\s+[^\n]+:\d+:\d+/;
const NODE_THROW_RE = /\b(Error|TypeError|RangeError):\s/;

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

function assertNoStackTrace(stderr: string): void {
  expect(stderr).not.toMatch(STACK_TRACE_RE);
  expect(stderr).not.toMatch(NODE_THROW_RE);
}

beforeAll(() => {
  if (!fsSync.existsSync(CLI_ENTRY)) {
    throw new Error(
      `Built CLI not found at ${CLI_ENTRY}. Run \`npm run build\` first.`
    );
  }
});

describe("generate command", { timeout: 15000 }, () => {
  let cfgDir: string;
  let outputDir: string;

  beforeEach(async () => {
    cfgDir = await fs.mkdtemp(path.join(os.tmpdir(), "pz-gen-cfg-"));
    outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "pz-gen-out-"));
  });

  afterEach(async () => {
    await fs.rm(cfgDir, { recursive: true, force: true }).catch(() => {});
    await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {});
  });

  it("shows 'run init first' and exits 0 when no config exists", async () => {
    const r = await runCli({
      args: ["generate", "-d", outputDir],
      env: { ANTIGRAVITY_CONFIG_DIR: cfgDir },
    });
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/init/i);
    assertNoStackTrace(r.stderr);
  });

  it("creates files in the target dir when config is valid", async () => {
    const prev = process.env.ANTIGRAVITY_CONFIG_DIR;
    process.env.ANTIGRAVITY_CONFIG_DIR = cfgDir;
    try {
      const cfg: WizardConfig = {
        projectName: "gen-test",
        agents: ["coder"],
        includeTemplates: true,
      };
      saveConfig(cfg);
    } finally {
      if (prev === undefined) delete process.env.ANTIGRAVITY_CONFIG_DIR;
      else process.env.ANTIGRAVITY_CONFIG_DIR = prev;
    }

    const r = await runCli({
      args: ["generate", "-d", outputDir],
      env: { ANTIGRAVITY_CONFIG_DIR: cfgDir },
    });
    expect(r.code).toBe(0);
    const entries = await fs.readdir(outputDir, { recursive: true });
    expect(entries.length).toBeGreaterThan(0);
  });

  it("exits 1 with no stack trace when target dir is read-only", async () => {
    const prev = process.env.ANTIGRAVITY_CONFIG_DIR;
    process.env.ANTIGRAVITY_CONFIG_DIR = cfgDir;
    try {
      saveConfig({
        projectName: "ro-gen",
        agents: ["coder"],
        includeTemplates: true,
      });
    } finally {
      if (prev === undefined) delete process.env.ANTIGRAVITY_CONFIG_DIR;
      else process.env.ANTIGRAVITY_CONFIG_DIR = prev;
    }

    const roDir = path.join(outputDir, "locked");
    await fs.mkdir(roDir, { recursive: true });
    if (process.platform === "win32") {
      await fs.rm(roDir, { recursive: true, force: true });
      await fs.writeFile(roDir, "blocker");
    } else {
      await fs.chmod(roDir, 0o555);
    }

    const r = await runCli({
      args: ["generate", "-d", roDir],
      env: { ANTIGRAVITY_CONFIG_DIR: cfgDir },
    });
    expect(r.code).toBe(1);
    assertNoStackTrace(r.stderr);

    if (process.platform !== "win32") {
      await fs.chmod(roDir, 0o755).catch(() => {});
    }
  });
});
