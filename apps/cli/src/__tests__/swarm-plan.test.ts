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
    expect(argv.slice(idx + 1, end)).toEqual(["read_file", "bash(git:diff*)"]);
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
