import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  worktreePathFor,
  listWorktreesForSwarm,
} from "../lib/swarm/worktree-manager.js";
import { discoverPrompts } from "../lib/swarm/prompt-browser.js";

describe("worktreePathFor", () => {
  it("returns the canonical relative layout under the repo root", () => {
    const root = path.resolve("/r");
    const p = worktreePathFor("my-swarm", 3, { repoRoot: root });
    expect(p).toBe(path.join(root, ".claude", "worktrees", "my-swarm", "agent-3"));
  });

  it("rejects names outside the safe regex", () => {
    expect(() => worktreePathFor("../evil", 0, { repoRoot: "/r" })).toThrow(
      /invalid swarmId/
    );
    expect(() => worktreePathFor("has space", 0, { repoRoot: "/r" })).toThrow(
      /invalid swarmId/
    );
    expect(() =>
      worktreePathFor("a".repeat(33), 0, { repoRoot: "/r" })
    ).toThrow(/invalid swarmId/);
  });

  it("listWorktreesForSwarm returns an array (may be empty)", () => {
    // Does not mutate the repo — safe to invoke in tests.
    const list = listWorktreesForSwarm("nonexistent-swarm-xyz");
    expect(Array.isArray(list)).toBe(true);
  });
});

describe("discoverPrompts", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "pz-prompt-"));
  });
  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("lists .md files sorted by id with first-line summaries", async () => {
    await fs.writeFile(path.join(tmp, "alpha.md"), "# Alpha\n\nbody");
    await fs.writeFile(path.join(tmp, "beta.md"), "Beta summary line\n");
    await fs.writeFile(path.join(tmp, ".gitkeep"), "");
    await fs.writeFile(path.join(tmp, "notes.txt"), "ignored");

    const got = discoverPrompts({ dir: tmp });
    expect(got.map((p) => p.id)).toEqual(["alpha", "beta"]);
    expect(got[0].summary).toBe("Alpha");
    expect(got[1].summary).toBe("Beta summary line");
  });

  it("strips frontmatter before picking a summary line", async () => {
    await fs.writeFile(
      path.join(tmp, "fm.md"),
      "---\nname: x\n---\nActual summary\n"
    );
    const got = discoverPrompts({ dir: tmp });
    expect(got[0].summary).toBe("Actual summary");
  });

  it("returns [] when the directory does not exist", () => {
    const got = discoverPrompts({ dir: path.join(tmp, "missing") });
    expect(got).toEqual([]);
  });
});
