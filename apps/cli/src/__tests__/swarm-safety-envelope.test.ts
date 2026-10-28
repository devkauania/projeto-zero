import { describe, it, expect } from "vitest";
import {
  buildClaudeArgv,
  auditArgv,
  DEFAULT_ALLOWED_TOOLS,
  DEFAULT_DISALLOWED_TOOLS,
  DEFAULT_MAX_TURNS,
  DEFAULT_MAX_BUDGET_USD,
  CLAUDE_CLI_FLAGS,
} from "../lib/swarm/safety-envelope.js";

const base = {
  sessionId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  workingDir: "/tmp/swarm/agent-0",
  promptFile: "/tmp/prompts/p0.md",
} as const;

describe("safety-envelope — anti-gaming invariant", () => {
  it("refuses bypassPermissions unless iUnderstand:true AND mode:work", () => {
    // Caller asked for bypass but did NOT acknowledge. Envelope downgrades
    // to acceptEdits silently. This is the tripwire the LLM cannot self-
    // certify — a future change that drops this check fails this test.
    const built = buildClaudeArgv({
      ...base,
      mode: "work",
      permissionMode: "bypassPermissions",
      iUnderstand: false,
    });
    expect(built.effective.permissionMode).toBe("acceptEdits");
    expect(built.argv).toContain("acceptEdits");
    expect(built.argv).not.toContain("bypassPermissions");
  });

  it("allows bypassPermissions ONLY when both flags are set together", () => {
    const built = buildClaudeArgv({
      ...base,
      mode: "work",
      permissionMode: "bypassPermissions",
      iUnderstand: true,
    });
    expect(built.effective.permissionMode).toBe("bypassPermissions");
    expect(built.argv).toContain("bypassPermissions");
  });

  it("verify mode forces plan + read-only tools regardless of caller", () => {
    const built = buildClaudeArgv({
      ...base,
      mode: "verify",
      permissionMode: "bypassPermissions", // ignored
      iUnderstand: true, // ignored
      allowedTools: ["write_file"], // ignored
    });
    expect(built.effective.permissionMode).toBe("plan");
    expect(built.effective.allowedTools).toEqual([
      "read_file",
      "bash(git:diff*)",
    ]);
    expect(built.effective.allowedTools).not.toContain("write_file");
  });
});

describe("safety-envelope — defaults", () => {
  it("applies the hardcoded safe defaults when caller omits options", () => {
    const built = buildClaudeArgv({ ...base, mode: "work" });
    expect(built.effective.permissionMode).toBe("acceptEdits");
    expect(built.effective.allowedTools).toEqual([...DEFAULT_ALLOWED_TOOLS]);
    expect(built.effective.disallowedTools).toEqual([
      ...DEFAULT_DISALLOWED_TOOLS,
    ]);
    expect(built.effective.maxTurns).toBe(DEFAULT_MAX_TURNS);
    expect(built.effective.maxBudgetUsd).toBe(DEFAULT_MAX_BUDGET_USD);
  });

  it("argv contains --output-format stream-json and --session-id", () => {
    const built = buildClaudeArgv({ ...base, mode: "work" });
    expect(built.argv).toContain("--output-format");
    expect(built.argv).toContain("stream-json");
    expect(built.argv).toContain("--session-id");
    expect(built.argv).toContain(base.sessionId);
  });

  it("prompt is NEVER on argv — neither its body nor its path (stdin only)", () => {
    const built = buildClaudeArgv({ ...base, mode: "work" });
    expect(built.argv).not.toContain("--prompt");
    expect(built.argv).not.toContain("--prompt-file");
    expect(built.argv).not.toContain(base.promptFile);
    // The worktree is the spawn cwd, not an argv flag.
    expect(built.argv).not.toContain(base.workingDir);
  });
});

describe("safety-envelope — input validation", () => {
  it("rejects malformed sessionId", () => {
    expect(() =>
      buildClaudeArgv({ ...base, sessionId: "not a uuid", mode: "work" })
    ).toThrow(/invalid sessionId/);
  });

  it("rejects missing workingDir", () => {
    expect(() =>
      buildClaudeArgv({ ...base, workingDir: "", mode: "work" })
    ).toThrow(/workingDir/);
  });

  it("rejects invalid mode", () => {
    expect(() =>
      // @ts-expect-error — testing runtime guard
      buildClaudeArgv({ ...base, mode: "chaos" })
    ).toThrow(/invalid mode/);
  });

  it("clamps nonsense maxTurns/maxBudgetUsd to defaults", () => {
    const built = buildClaudeArgv({
      ...base,
      mode: "work",
      maxTurns: -5,
      maxBudgetUsd: 0,
    });
    expect(built.effective.maxTurns).toBe(DEFAULT_MAX_TURNS);
    expect(built.effective.maxBudgetUsd).toBe(DEFAULT_MAX_BUDGET_USD);
  });
});

describe("auditArgv", () => {
  it("flags shell metacharacters in argv tokens", () => {
    const argv = ["--session-id", "x; rm -rf /"];
    expect(auditArgv(argv)).toMatch(/suspicious shell metacharacter/);
  });

  it("allows clean argv from buildClaudeArgv", () => {
    const built = buildClaudeArgv({ ...base, mode: "work" });
    expect(auditArgv(built.argv)).toBeNull();
  });

  it("surfaces (but does not reject) the gated bypassPermissions case", () => {
    const built = buildClaudeArgv({
      ...base,
      mode: "work",
      permissionMode: "bypassPermissions",
      iUnderstand: true,
    });
    const msg = auditArgv(built.argv);
    expect(msg).toMatch(/bypassPermissions/);
  });
});

describe("safety-envelope — Claude Code CLI contract (regression: invalid flags)", () => {
  // Regression for the bug where the envelope emitted --temperature,
  // --working-dir and --prompt-file (none exist in Claude Code; the CLI
  // exited 1 with "unknown option") and omitted -p, so --live never ran.
  const modes = [
    { mode: "work" as const },
    { mode: "verify" as const },
    { mode: "work" as const, permissionMode: "bypassPermissions" as const, iUnderstand: true },
  ];

  it("emits only flags recorded from the real Claude Code CLI", () => {
    for (const m of modes) {
      const { argv } = buildClaudeArgv({ ...base, ...m });
      const flags = argv.filter((t) => t.startsWith("-"));
      for (const f of flags) {
        expect(CLAUDE_CLI_FLAGS, `unknown flag ${f}`).toContain(f);
      }
    }
  });

  it("never emits the non-existent --temperature/--working-dir/--prompt-file", () => {
    for (const m of modes) {
      const { argv } = buildClaudeArgv({ ...base, ...m });
      expect(argv).not.toContain("--temperature");
      expect(argv).not.toContain("--working-dir");
      expect(argv).not.toContain("--prompt-file");
    }
  });

  it("runs in print mode with --verbose (required for stream-json under -p)", () => {
    const { argv } = buildClaudeArgv({ ...base, mode: "work" });
    expect(argv[0]).toBe("-p");
    expect(argv).toContain("--verbose");
    const i = argv.indexOf("--output-format");
    expect(argv[i + 1]).toBe("stream-json");
  });

  it("every flag that takes a value is followed by a non-flag token", () => {
    const { argv } = buildClaudeArgv({ ...base, mode: "work" });
    for (const f of [
      "--output-format",
      "--permission-mode",
      "--allowed-tools",
      "--disallowed-tools",
      "--max-turns",
      "--max-budget-usd",
      "--session-id",
    ]) {
      const i = argv.indexOf(f);
      expect(i, f).toBeGreaterThanOrEqual(0);
      expect(argv[i + 1]?.startsWith("-"), f).toBe(false);
    }
  });
});
