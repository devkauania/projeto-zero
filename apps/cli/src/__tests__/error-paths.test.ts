/**
 * Session 14a — Error-path acceptance tests (R13 split, part 1).
 *
 * These tests are written to FAIL against the current production code.
 * They encode the three error-path gaps left open by Session 11:
 *
 *   (a) SIGINT / Ctrl+C at each interactive prompt (`p.text`,
 *       `p.confirm`, `p.multiselect`) must exit the CLI with code 0
 *       and emit no Node stack trace on stderr.
 *   (b) `scaffoldProject` hitting a real filesystem permission error on
 *       a read-only target dir must stop the spinner via `p.log.error`
 *       and call `process.exit(1)` — not bubble a raw stack trace.
 *   (c) `saveConfig` failing because `ANTIGRAVITY_CONFIG_DIR` points at a
 *       read-only location must be recovered gracefully by `init`
 *       (clean exit, friendly error, no stack trace).
 *
 * Hard constraints honored:
 *   - No mocks of `fs` or `Conf`. We exercise the REAL built CLI under
 *     `apps/cli/dist/index.js` via `child_process.spawn`, and we touch
 *     the REAL filesystem under per-test temp dirs.
 *   - We import `saveConfig` directly from the real source for test (c)'s
 *     pre-condition (it is the production module, not a stub).
 *
 * Session 14b is responsible for making these tests go green WITHOUT
 * loosening the assertions.
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
  /** ms after spawn before sending SIGINT. */
  sigintAfterMs?: number;
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
    child.stdout.on("data", (d: Buffer) => {
      stdout += d.toString("utf8");
    });
    child.stderr.on("data", (d: Buffer) => {
      stderr += d.toString("utf8");
    });

    if (opts.stdinChunks) {
      for (const chunk of opts.stdinChunks) {
        child.stdin.write(chunk);
      }
    }

    let sigintTimer: NodeJS.Timeout | undefined;
    if (typeof opts.sigintAfterMs === "number") {
      sigintTimer = setTimeout(() => {
        try {
          child.kill("SIGINT");
        } catch {
          /* ignore */
        }
      }, opts.sigintAfterMs);
    }

    const hardTimer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        /* ignore */
      }
    }, opts.timeoutMs ?? 8000);

    child.on("close", (code, signal) => {
      if (sigintTimer) clearTimeout(sigintTimer);
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

describe("SIGINT exits cleanly at every interactive prompt", { timeout: 15000 }, () => {
  let cfgDir: string;

  beforeEach(async () => {
    cfgDir = await fs.mkdtemp(path.join(os.tmpdir(), "pz-sigint-"));
  });
  afterEach(async () => {
    await fs.rm(cfgDir, { recursive: true, force: true }).catch(() => {});
  });

  it("exits 0 with no stack trace when SIGINT hits the project-name p.text prompt", async () => {
    const r = await runCli({
      args: ["init"],
      env: { ANTIGRAVITY_CONFIG_DIR: cfgDir },
      sigintAfterMs: 800,
    });
    expect(r.code).toBe(0);
    assertNoStackTrace(r.stderr);
  });

  it("exits 0 with no stack trace when SIGINT hits the agents p.multiselect prompt", async () => {
    const r = await runCli({
      args: ["init"],
      env: { ANTIGRAVITY_CONFIG_DIR: cfgDir },
      // Submit a project name first, then SIGINT once we're past p.text.
      stdinChunks: ["my-proj\r"],
      sigintAfterMs: 1500,
    });
    expect(r.code).toBe(0);
    assertNoStackTrace(r.stderr);
  });

  it("exits 0 with no stack trace when SIGINT hits the includeTemplates p.confirm prompt", async () => {
    const r = await runCli({
      args: ["init"],
      env: { ANTIGRAVITY_CONFIG_DIR: cfgDir },
      // Name + (try to) advance through multiselect with space+enter, then SIGINT.
      stdinChunks: ["my-proj\r", " \r"],
      sigintAfterMs: 2200,
    });
    expect(r.code).toBe(0);
    assertNoStackTrace(r.stderr);
  });
});

// ---------------------------------------------------------------------------
// (b) scaffoldProject + real EACCES/EPERM on a read-only target dir
// ---------------------------------------------------------------------------

describe("scaffoldProject failure on a read-only target dir is handled gracefully", () => {
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

  it("`init` end-to-end exits cleanly (code 1, friendly error) instead of crashing", { timeout: 15000 }, async () => {
    // Drive init through every prompt so it reaches the saveConfig() call
    // inside its try/catch. Inputs:
    //   project name        -> "ro-init\r"
    //   agents multiselect  -> " \r"  (toggle first option, submit)
    //   includeTemplates    -> "y\r"
    const r = await runCli({
      args: ["init"],
      env: { ANTIGRAVITY_CONFIG_DIR: readOnlyCfgDir },
      stdinChunks: ["ro-init\r", " \r", "y\r"],
      timeoutMs: 10000,
    });
    // init.ts:148-152 routes saveConfig failure to process.exit(1) with
    // a p.log.error line — graceful exit, no stack trace.
    expect(r.code).toBe(1);
    expect(r.stdout + r.stderr).toMatch(/Failed to save configuration/i);
    assertNoStackTrace(r.stderr);
  });
});
