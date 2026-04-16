import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  filterChildEnv,
  CHILD_ENV_ALLOWLIST,
} from "../lib/swarm/agent-spawner.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPAWNER_SRC = path.resolve(__dirname, "..", "lib", "swarm", "agent-spawner.ts");

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

  it("allowlist is deliberately short (tokens stay on the parent)", () => {
    // Ledger row 7 — this asserts the list hasn't silently grown.
    // Updating this count requires a conscious review of what the child gets.
    expect(CHILD_ENV_ALLOWLIST.length).toBe(11);
  });
});

describe("agent-spawner — argv-array only (anti-injection)", () => {
  it("source file does not invoke spawn with shell:true", () => {
    const src = fs.readFileSync(SPAWNER_SRC, "utf8");
    // The real guarantee is the spawn() call's `shell: false` — grep for
    // any accidental `shell: true` that would re-enable interpolation.
    expect(src).not.toMatch(/shell\s*:\s*true/);
    expect(src).toMatch(/shell\s*:\s*false/);
  });

  it("source file does not concatenate argv into a shell string", () => {
    // Forbidden shapes: argv.join, ${argv}, exec(... + ...)
    const src = fs.readFileSync(SPAWNER_SRC, "utf8");
    expect(src).not.toMatch(/\bargv\.join\b/);
    expect(src).not.toMatch(/\bexec\s*\(/); // child_process.exec takes a shell string
    expect(src).not.toMatch(/execSync\s*\(/);
  });

  it("source file calls spawn with (bin, argv, options) — three args", () => {
    const src = fs.readFileSync(SPAWNER_SRC, "utf8");
    // Must contain `spawn(bin, argv,` — the critical positional form.
    expect(src).toMatch(/spawn\s*\(\s*bin\s*,\s*argv\s*,/);
  });
});

describe("agent-spawner — missing-binary behavior (ENOENT)", () => {
  it("spawnClaudeAgent with a nonexistent binary fires 'error' (never hangs silently)", async () => {
    // Locks the invariant swarm --live depends on: spawn emits 'error'
    // (not a sync throw) when the binary is missing.
    const { spawnClaudeAgent } = await import("../lib/swarm/agent-spawner.js");
    const tmpPrompt = path.join(
      path.dirname(SPAWNER_SRC),
      "..",
      "..",
      "__tests__",
      "fixtures-missing-prompt.txt"
    );
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
      try {
        fs.rmSync(tmpPrompt);
      } catch {
        /* best effort */
      }
    }
  }, 10000);
});
