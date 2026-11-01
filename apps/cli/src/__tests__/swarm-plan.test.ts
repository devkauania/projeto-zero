import { describe, it, expect } from "vitest";
import path from "node:path";
import { buildSwarmPlan, renderPlan } from "../commands/swarm.js";
import type { PromptDescriptor } from "../lib/swarm/prompt-browser.js";

// path.resolve() normalizes to an absolute path on the current platform.
// On Windows this prepends the drive letter; we resolve up front so the
// `toBe` comparison below compares apples-to-apples.
const FIXTURE_ROOT = path.resolve("/virtual/repo");

function prompts(n: number): PromptDescriptor[] {
  const out: PromptDescriptor[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      path: `${FIXTURE_ROOT}/.agents/prompts/p${i}.md`,
      id: `p${i}`,
      summary: `prompt ${i}`,
      bytes: 100,
    });
  }
  return out;
}

describe("buildSwarmPlan", () => {
  it("creates one agent per count and assigns prompts in order", () => {
    const plan = buildSwarmPlan({
      count: 3,
      mode: "work",
      prompts: prompts(3),
      sessionPrefix: "test",
      repoRoot: FIXTURE_ROOT,
    });
    expect(plan.count).toBe(3);
    expect(plan.agents.length).toBe(3);
    expect(plan.agents.map((a) => a.prompt.id)).toEqual(["p0", "p1", "p2"]);
  });

  it("round-robins prompts when count > prompts.length", () => {
    const plan = buildSwarmPlan({
      count: 5,
      mode: "work",
      prompts: prompts(2),
      sessionPrefix: "test",
      repoRoot: FIXTURE_ROOT,
    });
    expect(plan.agents.map((a) => a.prompt.id)).toEqual([
      "p0",
      "p1",
      "p0",
      "p1",
      "p0",
    ]);
  });

  it("each agent gets a unique UUID session id", () => {
    const plan = buildSwarmPlan({
      count: 5,
      mode: "work",
      prompts: prompts(1),
      sessionPrefix: "test",
      repoRoot: FIXTURE_ROOT,
    });
    const ids = new Set(plan.agents.map((a) => a.sessionId));
    expect(ids.size).toBe(5);
    for (const id of ids) {
      expect(id).toMatch(/^[a-f0-9-]{8,64}$/i);
    }
  });

  it("worktree paths follow .claude/worktrees/<swarm-id>/agent-<n>", () => {
    const plan = buildSwarmPlan({
      count: 2,
      mode: "work",
      prompts: prompts(1),
      sessionPrefix: "demo",
      repoRoot: FIXTURE_ROOT,
    });
    expect(plan.id).toMatch(/^demo-\d+$/);
    const expected0 = path.join(
      FIXTURE_ROOT,
      ".claude",
      "worktrees",
      plan.id,
      "agent-0"
    );
    expect(plan.agents[0].worktreePath).toBe(expected0);
  });

  it("verify mode agents have read-only tool lists", () => {
    const plan = buildSwarmPlan({
      count: 1,
      mode: "verify",
      prompts: prompts(1),
      sessionPrefix: "test",
      repoRoot: FIXTURE_ROOT,
    });
    const argv = plan.agents[0].argv;
    const idx = argv.indexOf("--allowed-tools");
    expect(idx).toBeGreaterThanOrEqual(0);
    const end = argv.indexOf("--disallowed-tools");
    expect(argv.slice(idx + 1, end)).toEqual([
      "Read",
      "Grep",
      "Glob",
      "Bash(git diff:*)",
    ]);
    const modeIdx = argv.indexOf("--permission-mode");
    expect(argv[modeIdx + 1]).toBe("plan");
  });

  it("refuses to plan when no prompts are found", () => {
    expect(() =>
      buildSwarmPlan({
        count: 2,
        mode: "work",
        prompts: [],
        sessionPrefix: "test",
        repoRoot: FIXTURE_ROOT,
      })
    ).toThrow(/no prompts discovered/);
  });

  it("tells the user to write prompt files, not to re-run init", () => {
    // Regression: the hint used to say "Scaffold some with `antigravity
    // init`", but init writes no files and generate only creates an empty
    // .agents/prompts/ folder, so following the hint never fixed the error.
    let message = "";
    try {
      buildSwarmPlan({
        count: 1,
        mode: "work",
        prompts: [],
        sessionPrefix: "test",
        repoRoot: FIXTURE_ROOT,
      });
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toMatch(/write one \.md prompt file per task/);
    expect(message).toMatch(/--prompts <dir>/);
    expect(message).not.toMatch(/\binit\b/);
  });
});

describe("buildSwarmPlan — the limits reach every agent's argv", () => {
  const plan = (extra: Record<string, unknown> = {}) =>
    buildSwarmPlan({
      count: 2,
      mode: "work",
      prompts: prompts(2),
      sessionPrefix: "test",
      repoRoot: FIXTURE_ROOT,
      ...extra,
    });
  const after = (argv: string[], flag: string) => argv[argv.indexOf(flag) + 1];

  it("forwards --max-budget-usd and --max-turns with their real values", () => {
    for (const a of plan({ maxBudgetUsd: 0.5, maxTurns: 3 }).agents) {
      expect(after(a.argv, "--max-budget-usd")).toBe("0.50");
      expect(after(a.argv, "--max-turns")).toBe("3");
    }
  });

  it("forwards the caller's allow and deny lists", () => {
    const [a] = plan({ allowedTools: ["Read"], disallowedTools: ["Bash(sudo:*)", "WebFetch"] }).agents;
    expect(a.argv.slice(a.argv.indexOf("--allowed-tools") + 1, a.argv.indexOf("--disallowed-tools"))).toEqual(["Read"]);
    expect(a.argv.slice(a.argv.indexOf("--disallowed-tools") + 1, a.argv.indexOf("--max-turns"))).toEqual([
      "Bash(sudo:*)",
      "WebFetch",
    ]);
  });

  it("the default deny list is on argv, not only in the effective values", () => {
    const [a] = plan().agents;
    const denied = a.argv.slice(a.argv.indexOf("--disallowed-tools") + 1, a.argv.indexOf("--max-turns"));
    expect(denied).toEqual(["Bash(rm:*)", "Bash(curl:*)", "Bash(wget:*)", "Bash(ssh:*)", "WebFetch", "WebSearch"]);
  });

  it("carries the bypass gate through to argv only with the acknowledgement", () => {
    const off = plan({ permissionMode: "bypassPermissions" }).agents[0].argv;
    const on = plan({ permissionMode: "bypassPermissions", iUnderstand: true }).agents[0].argv;
    expect(after(off, "--permission-mode")).toBe("acceptEdits");
    expect(after(on, "--permission-mode")).toBe("bypassPermissions");
  });

  it("refuses at plan time a rule the spawner would refuse later", () => {
    expect(() => plan({ allowedTools: ["Bash(a && b)"] })).toThrow(/metacharacter/);
    expect(() =>
      plan({
        allowedTools: ["Bash(a && b)"],
        permissionMode: "bypassPermissions",
        iUnderstand: true,
      })
    ).toThrow(/metacharacter/);
  });

  it("a long prefix never pushes out the timestamp or the 32-character limit", () => {
    const p = plan({ sessionPrefix: "x".repeat(32) });
    expect(p.id.length).toBeLessThanOrEqual(32);
    expect(p.id).toMatch(/^x+-\d{14}$/);
  });
});

describe("renderPlan — deterministic output", () => {
  it("renders every documented field", () => {
    const plan = buildSwarmPlan({
      count: 1,
      mode: "work",
      prompts: prompts(1),
      sessionPrefix: "golden",
      repoRoot: FIXTURE_ROOT,
    });
    const out = renderPlan(plan);
    expect(out).toContain(`swarm-id: ${plan.id}`);
    expect(out).toContain("mode:     work");
    expect(out).toContain("count:    1");
    expect(out).toContain("agent[0]");
    expect(out).toContain(plan.agents[0].sessionId);
    expect(out).toContain("prompt-id:    p0");
    expect(out).toContain("--output-format");
  });

  it("renders 15 agents (upper bound)", () => {
    const plan = buildSwarmPlan({
      count: 15,
      mode: "work",
      prompts: prompts(3),
      sessionPrefix: "max",
      repoRoot: FIXTURE_ROOT,
    });
    const out = renderPlan(plan);
    for (let i = 0; i < 15; i++) {
      expect(out).toContain(`agent[${i}]`);
    }
  });
});
