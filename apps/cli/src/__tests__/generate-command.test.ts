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
    }, opts.timeoutMs ?? 60000);

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

describe("generate command", { timeout: 60000 }, () => {
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

  it("exits 1 and writes nothing when no config exists", async () => {
    // Exit 0 here let `init && generate` go green with no files on disk.
    const r = await runCli({
      args: ["generate", "-d", outputDir],
      env: { ANTIGRAVITY_CONFIG_DIR: cfgDir },
    });
    expect(r.code).toBe(1);
    expect(r.stdout + r.stderr).toMatch(/run "init" first/i);
    expect(await fs.readdir(outputDir)).toEqual([]);
    assertNoStackTrace(r.stderr);
  });

  it("exits 1 instead of hanging when piped and nothing gives a directory", async () => {
    await fs.writeFile(
      path.join(cfgDir, "config.json"),
      JSON.stringify({ wizard: { projectName: "p", agents: ["coder"], includeTemplates: false } })
    );
    const r = await runCli({ args: ["generate"], env: { ANTIGRAVITY_CONFIG_DIR: cfgDir } });
    expect(r.code).toBe(1);
    expect(r.stdout + r.stderr).toMatch(/-d/);
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
    const entries = (await fs.readdir(outputDir, { recursive: true }))
      .map((e) => String(e).replace(/\\/g, "/"))
      .sort();
    expect(entries).toEqual([
      ".agents",
      ".agents/coder.md",
      ".agents/prompts",
      ".agents/prompts/.gitkeep",
      "CLAUDE.md",
      "skills",
      "skills/coder",
      "skills/coder/SKILL.md",
    ]);
    expect(r.stdout).toMatch(/Created 4 artifacts/);
  });

  it("counts files and not the folders it made", async () => {
    // With templates this config happens to make 4 files and 4 folders, so that
    // count alone cannot tell them apart. Here it is 2 files and 3 folders.
    const prev = process.env.ANTIGRAVITY_CONFIG_DIR;
    process.env.ANTIGRAVITY_CONFIG_DIR = cfgDir;
    try {
      saveConfig({ projectName: "count", agents: ["coder"], includeTemplates: false });
    } finally {
      if (prev === undefined) delete process.env.ANTIGRAVITY_CONFIG_DIR;
      else process.env.ANTIGRAVITY_CONFIG_DIR = prev;
    }
    const out = path.join(cfgDir, "count-out");
    const r = await runCli({
      args: ["generate", "-d", out],
      env: { ANTIGRAVITY_CONFIG_DIR: cfgDir },
    });
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/Created 2 artifacts/);
    expect(r.stdout).toMatch(/Generated 2 artifacts/);
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

// Regression: a connector id from the saved config was used as a file name
// (.mcp/<id>.json) without validation, so "../../ESCAPED" wrote ESCAPED.json
// outside the -d target while generate still reported success.
describe("generate command — connector id path escape", { timeout: 60000 }, () => {
  let cfgDir: string;
  let scratch: string;

  beforeEach(async () => {
    cfgDir = await fs.mkdtemp(path.join(os.tmpdir(), "pz-gen-esc-cfg-"));
    scratch = await fs.mkdtemp(path.join(os.tmpdir(), "pz-gen-esc-out-"));
  });

  afterEach(async () => {
    await fs.rm(cfgDir, { recursive: true, force: true }).catch(() => {});
    await fs.rm(scratch, { recursive: true, force: true }).catch(() => {});
  });

  it("refuses a traversal connector id, exits 1 and writes nothing outside -d", async () => {
    await fs.writeFile(
      path.join(cfgDir, "config.json"),
      JSON.stringify({
        wizard: {
          projectName: "p",
          agents: ["coder"],
          includeTemplates: false,
          mcpConnectors: {
            "../../ESCAPED": {
              id: "x",
              label: "x",
              description: "x",
              tools: [],
              requiredFor: [],
            },
          },
        },
      })
    );
    const out = path.join(scratch, "gen", "out");
    const r = await runCli({
      args: ["generate", "-d", out],
      env: { ANTIGRAVITY_CONFIG_DIR: cfgDir },
    });
    expect(r.code).toBe(1);
    expect(r.stdout + r.stderr).toMatch(/invalid MCP connector id/);
    expect(fsSync.existsSync(path.join(scratch, "gen", "ESCAPED.json"))).toBe(false);
    expect(fsSync.existsSync(path.join(scratch, "ESCAPED.json"))).toBe(false);
    assertNoStackTrace(r.stderr);
  });
});
