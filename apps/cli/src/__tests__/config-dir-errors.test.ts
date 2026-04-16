/**
 * Regression — ANTIGRAVITY_CONFIG_DIR scope-reject UX.
 *
 * Ledger row 8 (audit/patches/03-config-dir-hardening.md) hardens the
 * Conf store against an env-var pointed at an out-of-scope path. The
 * hardening itself is correct (throws from `validateConfigDir`), but
 * the first pass left `info`/`generate`/`reset` propagating the throw
 * as a raw Node stack trace. This suite locks the friendly-error UX:
 * every command must exit 1 with a one-line message and NO stack trace
 * when the env var is set to a path outside $HOME or $TMPDIR.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const CLI_ENTRY = path.resolve(here, "..", "..", "dist", "index.js");

// Path that is neither under os.homedir() nor os.tmpdir() on either
// platform. validateConfigDir must reject it.
const BAD_SCOPE =
  process.platform === "win32" ? "Z:\\pz-bad-scope" : "/opt/pz-bad-scope";

const STACK_TRACE_RE = /\n\s+at\s+[^\n]+:\d+:\d+/;
const NODE_THROW_RE = /\bError:\s.*\n\s+at\s/;

interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

function runCli(args: string[]): Promise<RunResult> {
  return new Promise((resolve) => {
    const child: ChildProcessWithoutNullStreams = spawn(
      process.execPath,
      [CLI_ENTRY, ...args],
      {
        env: { ...process.env, ANTIGRAVITY_CONFIG_DIR: BAD_SCOPE },
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
    }, 8000);
    child.on("close", (code) => {
      clearTimeout(hardTimer);
      resolve({ code, stdout, stderr });
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

describe("ANTIGRAVITY_CONFIG_DIR out-of-scope — friendly error UX", { timeout: 15000 }, () => {
  it("info exits 1 with a scope message, no stack trace", async () => {
    const r = await runCli(["info"]);
    expect(r.code).toBe(1);
    const combined = r.stdout + r.stderr;
    expect(combined).toMatch(/outside the allowed scope|ANTIGRAVITY_CONFIG_DIR/);
    expect(combined).not.toMatch(STACK_TRACE_RE);
    expect(combined).not.toMatch(NODE_THROW_RE);
  });

  it("generate exits 1 with a scope message, no stack trace", async () => {
    const r = await runCli(["generate", "-d", "."]);
    expect(r.code).toBe(1);
    const combined = r.stdout + r.stderr;
    expect(combined).toMatch(/outside the allowed scope|ANTIGRAVITY_CONFIG_DIR/);
    expect(combined).not.toMatch(STACK_TRACE_RE);
    expect(combined).not.toMatch(NODE_THROW_RE);
  });

  // Note: reset is TTY-gated and exits early with a warning under piped
  // stdio — it never reaches loadConfig in this harness, so the throw
  // path is exercised by the library-level config.test.ts tests. The
  // inline try/catch added in commands/reset.ts protects interactive
  // users; its failure mode is still a single friendly line.
});
