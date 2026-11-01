/**
 * Error paths through the REAL built CLI and the REAL filesystem, no mocks:
 *
 *   (a) A real SIGINT while init waits for piped answers exits 0 and saves
 *       nothing. POSIX only: on Windows child.kill("SIGINT") is
 *       TerminateProcess, so no handler can run. Ctrl-C at each interactive
 *       prompt is covered through a real terminal in interactive.test.ts.
 *   (b) scaffoldProject hitting a real filesystem error must stop the spinner
 *       and exit 1, not bubble a raw stack trace.
 *   (c) saveConfig failing because ANTIGRAVITY_CONFIG_DIR is unusable must be
 *       recovered gracefully by init.
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
// Real built artifact — production runtime path.
const CLI_ENTRY = path.resolve(here, "..", "..", "dist", "index.js");

const STACK_TRACE_RE = /\n\s+at\s+[^\n]+:\d+:\d+/;
const NODE_THROW_RE = /\b(Error|TypeError|RangeError):\s/;

interface RunResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}

interface RunOptions {
  args: string[];
  env?: Record<string, string>;
  /** Bytes to pre-feed on stdin before any kill. */
  stdinChunks?: string[];
  /** Send SIGINT the first time stdout contains this text. */
  sigintWhenStdout?: RegExp;
  /** Hard kill if the child outlives this. */
  timeoutMs?: number;
}

function runCli(opts: RunOptions): Promise<RunResult> {
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
    let sent = false;
    child.stdout.on("data", (d: Buffer) => {
      stdout += d.toString("utf8");
      if (!sent && opts.sigintWhenStdout?.test(stdout)) {
        sent = true;
        child.kill("SIGINT");
      }
    });
    child.stderr.on("data", (d: Buffer) => {
      stderr += d.toString("utf8");
    });

    if (opts.stdinChunks) {
      for (const chunk of opts.stdinChunks) {
        child.stdin.write(chunk);
      }
    }

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
  // A graceful exit must not surface raw Node error frames or thrown
  // Error names. p.log.error / p.cancel output is fine.
  expect(stderr).not.toMatch(STACK_TRACE_RE);
  expect(stderr).not.toMatch(NODE_THROW_RE);
}

beforeAll(() => {
  // Sanity: the built artifact must exist; otherwise the suite is meaningless.
  if (!fsSync.existsSync(CLI_ENTRY)) {
    throw new Error(
      `Built CLI not found at ${CLI_ENTRY}. Run \`npm run build\` first.`
    );
  }
});

// ---------------------------------------------------------------------------
// (a) SIGINT at each interactive prompt
// ---------------------------------------------------------------------------

describe.skipIf(process.platform === "win32")("a real SIGINT while init waits for stdin", { timeout: 60000 }, () => {
  let cfgDir: string;

  beforeEach(async () => {
    cfgDir = await fs.mkdtemp(path.join(os.tmpdir(), "pz-sigint-"));
  });
  afterEach(async () => {
    await fs.rm(cfgDir, { recursive: true, force: true }).catch(() => {});
  });

  it.each([
    ["no answers", []],
    ["one answer", ["my-proj\n"]],
    ["two answers", ["my-proj\n", "coder\n"]],
  ])("with %s: exits 0, no stack trace, nothing saved", async (_label, chunks) => {
    const r = await runCli({
      args: ["init"],
      env: { ANTIGRAVITY_CONFIG_DIR: cfgDir },
      stdinChunks: chunks,
      // init prints this once it is reading stdin. Stdin stays open, so only
      // the signal can end the run; a missing trap dies with signal SIGINT.
      sigintWhenStdout: /reading .*from stdin/i,
    });
    expect(r.signal).toBeNull();
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/cancelled/i);
    assertNoStackTrace(r.stderr);
    expect(fsSync.existsSync(path.join(cfgDir, "config.json"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// (b) scaffoldProject + real EACCES/EPERM on a read-only target dir
// ---------------------------------------------------------------------------

describe("scaffoldProject failure on a read-only target dir is handled gracefully", { timeout: 60000 }, () => {
  let cfgDir: string;
  let readOnlyParent: string;
  let readOnlyTarget: string;

  beforeEach(async () => {
    cfgDir = await fs.mkdtemp(path.join(os.tmpdir(), "pz-scaffold-cfg-"));
    readOnlyParent = await fs.mkdtemp(path.join(os.tmpdir(), "pz-scaffold-ro-"));
    readOnlyTarget = path.join(readOnlyParent, "locked-target");
    await fs.mkdir(readOnlyTarget, { recursive: true });

    // Seed a real saved config so `generate` proceeds past loadConfig().
    process.env.ANTIGRAVITY_CONFIG_DIR = cfgDir;
    const cfg: WizardConfig = {
      projectName: "ro-test",
      agents: ["coder"],
      includeTemplates: true,
    };
    saveConfig(cfg);
    delete process.env.ANTIGRAVITY_CONFIG_DIR;

    // Make the target dir non-writable. POSIX: chmod 0o555. Windows: drop
    // a file at the path scaffoldProject must mkdir into so a real fs error
    // (ENOTDIR/EEXIST) is raised — both are real fs errors on the production
    // path, no mocks.
    if (process.platform === "win32") {
      await fs.rm(readOnlyTarget, { recursive: true, force: true });
      await fs.writeFile(readOnlyTarget, "blocker");
    } else {
      await fs.chmod(readOnlyTarget, 0o555);
    }
  });

  afterEach(async () => {
    if (process.platform !== "win32") {
      await fs.chmod(readOnlyTarget, 0o755).catch(() => {});
    }
    await fs.rm(readOnlyParent, { recursive: true, force: true }).catch(() => {});
    await fs.rm(cfgDir, { recursive: true, force: true }).catch(() => {});
  });

  it("stops the spinner with p.log.error and exits 1 — no raw stack trace", async () => {
    const r = await runCli({
      args: ["generate", "-d", readOnlyTarget],
      env: { ANTIGRAVITY_CONFIG_DIR: cfgDir },
    });
    expect(r.code).toBe(1);
    // Spinner failure label from generate.ts catch branch.
    expect(r.stdout + r.stderr).toMatch(/Scaffolding failed/i);
    assertNoStackTrace(r.stderr);
  });
});

// ---------------------------------------------------------------------------
// (c) saveConfig failing under a read-only ANTIGRAVITY_CONFIG_DIR
// ---------------------------------------------------------------------------

describe("init recovers gracefully when ANTIGRAVITY_CONFIG_DIR is read-only", () => {
  let readOnlyCfgParent: string;
  let readOnlyCfgDir: string;

  beforeEach(async () => {
    readOnlyCfgParent = await fs.mkdtemp(path.join(os.tmpdir(), "pz-cfg-ro-"));
    readOnlyCfgDir = path.join(readOnlyCfgParent, "locked-cfg");
    await fs.mkdir(readOnlyCfgDir, { recursive: true });
    if (process.platform === "win32") {
      // Plant a file where Conf will try to create its store dir/file.
      // This forces a real fs error on the saveConfig path.
      await fs.rm(readOnlyCfgDir, { recursive: true, force: true });
      await fs.writeFile(readOnlyCfgDir, "blocker");
    } else {
      await fs.chmod(readOnlyCfgDir, 0o555);
    }
  });

  afterEach(async () => {
    if (process.platform !== "win32") {
      await fs.chmod(readOnlyCfgDir, 0o755).catch(() => {});
    }
    await fs.rm(readOnlyCfgParent, { recursive: true, force: true }).catch(() => {});
  });

  it("saveConfig surfaces a real error when the config dir is read-only (pre-condition)", () => {
    // This pre-condition asserts the failure is REAL — saveConfig genuinely
    // throws when the backing store cannot be written. If this ever stops
    // throwing, the recovery test below would be vacuous.
    const prev = process.env.ANTIGRAVITY_CONFIG_DIR;
    process.env.ANTIGRAVITY_CONFIG_DIR = readOnlyCfgDir;
    try {
      expect(() =>
        saveConfig({
          projectName: "x",
          agents: ["coder"],
          includeTemplates: false,
        })
      ).toThrow();
    } finally {
      if (prev === undefined) delete process.env.ANTIGRAVITY_CONFIG_DIR;
      else process.env.ANTIGRAVITY_CONFIG_DIR = prev;
    }
  });

  it("`init` end-to-end exits cleanly (code 1, friendly error) instead of crashing", { timeout: 60000 }, async () => {
    // Drive init through every prompt so it reaches the saveConfig() call
    // inside its try/catch. Inputs:
    //   project name  -> "ro-init"
    //   agents        -> "coder"
    //   templates     -> "y"
    const r = await runCli({
      args: ["init"],
      env: { ANTIGRAVITY_CONFIG_DIR: readOnlyCfgDir },
      stdinChunks: ["ro-init\n", "coder\n", "y\n"],
    });
    // A saveConfig failure goes to process.exit(1) with a p.log.error line.
    expect(r.code).toBe(1);
    expect(r.stdout + r.stderr).toMatch(/Failed to save configuration/i);
    assertNoStackTrace(r.stderr);
  });
});

