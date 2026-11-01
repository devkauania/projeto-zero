import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  filterChildEnv,
  CHILD_ENV_ALLOWLIST,
  parseCmdShimTarget,
} from "../lib/swarm/agent-spawner.js";
import { NPM_SHIM_EXE, NPM_SHIM_JS } from "./helpers/fake-claude.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPAWNER_SRC = path.resolve(__dirname, "..", "lib", "swarm", "agent-spawner.ts");

/** The source without comments, so a comment cannot satisfy a code check. */
function spawnerCode(): string {
  return fs
    .readFileSync(SPAWNER_SRC, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("parseCmdShimTarget", () => {
  it("finds the program in both shapes npm writes", () => {
    expect(parseCmdShimTarget(NPM_SHIM_EXE)).toBe(
      "node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe"
    );
    expect(parseCmdShimTarget(NPM_SHIM_JS)).toBe(
      "node_modules\\@anthropic-ai\\claude-code\\cli.js"
    );
  });

  it("does not take the node.exe check in the js shape for the program", () => {
    expect(parseCmdShimTarget(NPM_SHIM_JS)).not.toMatch(/node\.exe/);
  });

  it.each([
    ["a batch file someone wrote", '@echo off\r\nC:\\tools\\claude.exe %*\r\n'],
    ["an empty file", ""],
    ["a target with no argument forwarding", '"%dp0%\\x\\claude.exe"\r\n'],
  ])("refuses %s", (_label, text) => {
    expect(parseCmdShimTarget(text)).toBeNull();
  });
});

describe("agent-spawner — env filtering", () => {
  it("passes through only allowlisted env vars", () => {
    const parent: NodeJS.ProcessEnv = {
      PATH: "/usr/bin",
      HOME: "/home/u",
      NPM_TOKEN: "npm_LEAK_ME",
      ANTHROPIC_API_KEY: "sk-ant-LEAK",
      GITHUB_TOKEN: "ghp_LEAK",
      CLAUDE_CODE_OAUTH_TOKEN: "claude-ok",
      SOMETHING_ELSE: "nope",
    };
    const filtered = filterChildEnv(parent);
    expect(filtered.PATH).toBe("/usr/bin");
    expect(filtered.HOME).toBe("/home/u");
    expect(filtered.CLAUDE_CODE_OAUTH_TOKEN).toBe("claude-ok");
    expect(filtered.NPM_TOKEN).toBeUndefined();
    expect(filtered.ANTHROPIC_API_KEY).toBeUndefined();
    expect(filtered.GITHUB_TOKEN).toBeUndefined();
    expect(filtered.SOMETHING_ELSE).toBeUndefined();
  });

  it("the allowlist is exactly these names (tokens stay on the parent)", () => {
    // Ledger row 7. A size check let GH_TOKEN swap in for TERM unnoticed.
    // Changing this list requires a conscious review of what the child gets.
    expect([...CHILD_ENV_ALLOWLIST]).toEqual([
      "PATH",
      "HOME",
      "USERPROFILE",
      "TMPDIR",
      "TMP",
      "TEMP",
      "LANG",
      "LC_ALL",
      "TERM",
      "CLAUDE_CODE_OAUTH_TOKEN",
      "CLAUDE_CONFIG_DIR",
    ]);
  });
});

describe("agent-spawner — argv-array only (anti-injection)", () => {
  // What the child really gets is asserted in swarm-live.test.ts. These only
  // catch the shapes that behaviour test could miss on one platform.
  it("source code never asks for a shell", () => {
    const code = spawnerCode();
    expect(code).toMatch(/shell\s*:\s*false/);
    expect(code.match(/shell\s*:/g)).toHaveLength(1);
  });

  it("source file does not concatenate argv into a shell string", () => {
    const code = spawnerCode();
    expect(code).not.toMatch(/\bargv\.join\b/);
    expect(code).not.toMatch(/\bexec\s*\(/); // child_process.exec takes a shell string
    expect(code).not.toMatch(/execSync\s*\(/);
  });

  it("refuses an argv the audit rejects, without spawning anything", async () => {
    const { spawnClaudeAgent } = await import("../lib/swarm/agent-spawner.js");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pz-spawn-"));
    const marker = path.join(dir, "ran.txt");
    const prompt = path.join(dir, "p.md");
    fs.writeFileSync(prompt, "x");
    try {
      expect(() =>
        spawnClaudeAgent({
          // If the audit were skipped this would really run and leave a marker.
          bin: process.execPath,
          argv: ["-e", `require("fs").writeFileSync(${JSON.stringify(marker)}, "x") && 1`],
          cwd: dir,
          promptFile: prompt,
        })
      ).toThrow(/refusing to spawn/);
      await new Promise((r) => setTimeout(r, 500));
      expect(fs.existsSync(marker)).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    }
  });

  it("does not start a child when the prompt cannot be read", async () => {
    const { spawnClaudeAgent } = await import("../lib/swarm/agent-spawner.js");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pz-spawn-"));
    const marker = path.join(dir, "ran.txt");
    try {
      expect(() =>
        spawnClaudeAgent({
          bin: process.execPath,
          argv: ["-e", `require("fs").writeFileSync(${JSON.stringify(marker)}, "x")`],
          cwd: dir,
          promptFile: path.join(dir, "missing.md"),
        })
      ).toThrow(/ENOENT/);
      await new Promise((r) => setTimeout(r, 500));
      expect(fs.existsSync(marker)).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    }
  });
});

describe("agent-spawner — missing-binary behavior (ENOENT)", () => {
  it("spawnClaudeAgent with a nonexistent binary fires 'error' (never hangs silently)", async () => {
    // Locks the invariant swarm --live depends on: spawn emits 'error'
    // (not a sync throw) when the binary is missing.
    const { spawnClaudeAgent } = await import("../lib/swarm/agent-spawner.js");
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pz-spawn-"));
    const tmpPrompt = path.join(tmpDir, "prompt.md");
    fs.writeFileSync(tmpPrompt, "irrelevant\n");
    try {
      const { proc } = spawnClaudeAgent({
        bin:
          process.platform === "win32"
            ? "C:\\does\\not\\exist\\pz-missing-bin.exe"
            : "/does/not/exist/pz-missing-bin",
        argv: ["--permission-mode", "plan", "--max-turns", "1"],
        cwd: process.cwd(),
        promptFile: tmpPrompt,
      });
      const result = await new Promise<{ event: string; code?: number | null; err?: string }>(
        (resolve) => {
          proc.on("exit", (code) => resolve({ event: "exit", code }));
          proc.on("error", (err: Error) =>
            resolve({ event: "error", err: err.message })
          );
          setTimeout(() => resolve({ event: "timeout" }), 4000);
        }
      );
      expect(result.event).toBe("error");
      expect(result.err).toMatch(/ENOENT/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3 });
    }
  }, 10000);
});
