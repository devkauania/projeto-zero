// Regression: ANTIGRAVITY_CONFIG_DIR out-of-scope must exit 1 with a
// one-line message, never a raw Node stack trace. See audit/patches/06.

import { describe, it, expect, beforeAll } from "vitest";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const CLI_ENTRY = path.resolve(here, "..", "..", "dist", "index.js");

// Neither under os.homedir() nor os.tmpdir() on either platform.
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

  // reset is TTY-gated — exercised at library level in config.test.ts.
});
