import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import {
  assertCanCreateWorktrees,
  createWorktree,
  createWorktrees,
  worktreePathFor,
  listWorktreesForSwarm,
  removeWorktree,
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
    // A dot is what turns a name into "..", and git refuses "a..b" in a branch.
    expect(() => worktreePathFor("a.b", 0, { repoRoot: "/r" })).toThrow(/invalid swarmId/);
    expect(() => worktreePathFor("..", 0, { repoRoot: "/r" })).toThrow(/invalid swarmId/);
  });
});

describe("worktrees in a real git repository (ledger row 5)", { timeout: 60000 }, () => {
  let repo: string;

  it("createWorktrees makes all of them, on their own branches", () => {
    const handles = createWorktrees("all-ok", [0, 1], { repoRoot: repo });
    expect(handles.map((h) => h.ref)).toEqual(["swarm/all-ok/agent-0", "swarm/all-ok/agent-1"]);
    expect(listWorktreesForSwarm("all-ok", { repoRoot: repo }).map((h) => h.agentIndex).sort()).toEqual([0, 1]);
  });

  it("createWorktrees rolls back what it made when a later one fails", () => {
    git("branch", "swarm/collide/agent-1");
    expect(() => createWorktrees("collide", [0, 1, 2], { repoRoot: repo })).toThrow(/agent-1/);
    expect(listWorktreesForSwarm("collide", { repoRoot: repo })).toEqual([]);
    // The branch that was there first is not ours to delete.
    expect(git("branch", "--list", "swarm/collide/*").trim()).toBe("swarm/collide/agent-1");
  });

  function git(...args: string[]): string {
    const r = spawnSync(
      "git",
      ["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", ...args],
      { cwd: repo, encoding: "utf8" }
    );
    if (r.status !== 0) throw new Error(r.stderr);
    return r.stdout;
  }

  beforeEach(async () => {
    repo = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "pz wt ")));
    git("init", "-q");
    git("config", "core.autocrlf", "false");
    await fs.writeFile(path.join(repo, "f.txt"), "hello\n");
    git("add", ".");
    git("commit", "-q", "-m", "first");
  });
  afterEach(async () => {
    await fs.rm(repo, { recursive: true, force: true, maxRetries: 3 });
  });

  it("gives each agent its own checkout on its own branch", async () => {
    const a = createWorktree("run1", 0, { repoRoot: repo });
    const b = createWorktree("run1", 1, { repoRoot: repo });
    expect(a.path).toBe(worktreePathFor("run1", 0, { repoRoot: repo }));
    expect(b.path).toBe(worktreePathFor("run1", 1, { repoRoot: repo }));
    expect(a.path).not.toBe(b.path);
    expect(a.ref).toBe("swarm/run1/agent-0");
    // A write in one checkout is not visible in the other. This is the isolation.
    await fs.writeFile(path.join(a.path, "f.txt"), "changed\n");
    expect(await fs.readFile(path.join(b.path, "f.txt"), "utf8")).toBe("hello\n");
    expect(git("branch", "--list", "swarm/*").match(/agent-\d/g)?.sort()).toEqual(["agent-0", "agent-1"]);
  });

  it("listWorktreesForSwarm finds that swarm's worktrees and no other's", () => {
    createWorktree("run1", 0, { repoRoot: repo });
    createWorktree("run1", 1, { repoRoot: repo });
    createWorktree("run2", 0, { repoRoot: repo });
    const listed = listWorktreesForSwarm("run1", { repoRoot: repo });
    expect(listed.map((h) => h.agentIndex).sort()).toEqual([0, 1]);
    expect(listWorktreesForSwarm("nothing-here", { repoRoot: repo })).toEqual([]);
  });

  it("surfaces a git failure rather than handing back a path that does not exist", () => {
    createWorktree("run1", 0, { repoRoot: repo });
    expect(() => createWorktree("run1", 0, { repoRoot: repo })).toThrow(/git worktree add failed/);
  });

  it.each(["../evil", "has space", "a/b", "a".repeat(33), ""])(
    "createWorktree refuses the swarm id %j before touching git",
    (id) => {
      expect(() => createWorktree(id, 0, { repoRoot: repo })).toThrow(/invalid swarmId/);
      expect(git("worktree", "list", "--porcelain").match(/^worktree /gm)).toHaveLength(1);
    }
  );

  it.each([-1, 1.5, 100])("createWorktree refuses agent index %j", (n) => {
    expect(() => createWorktree("run1", n, { repoRoot: repo })).toThrow(/agentIndex/);
  });

  it("removeWorktree removes it, and is false the second time", () => {
    const h = createWorktree("run1", 0, { repoRoot: repo });
    expect(removeWorktree(h, { repoRoot: repo })).toBe(true);
    expect(listWorktreesForSwarm("run1", { repoRoot: repo })).toEqual([]);
    expect(removeWorktree(h, { repoRoot: repo })).toBe(false);
  });

  it("assertCanCreateWorktrees passes in a repo that has a commit", () => {
    expect(() => assertCanCreateWorktrees({ repoRoot: repo })).not.toThrow();
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

  it("ignores a hidden .md file and a folder named like a prompt", async () => {
    await fs.writeFile(path.join(tmp, "real.md"), "real\n");
    await fs.writeFile(path.join(tmp, ".hidden.md"), "hidden\n");
    await fs.mkdir(path.join(tmp, "folder.md"));
    expect(discoverPrompts({ dir: tmp }).map((p) => p.id)).toEqual(["real"]);
  });

  it("returns [] when the directory does not exist", () => {
    const got = discoverPrompts({ dir: path.join(tmp, "missing") });
    expect(got).toEqual([]);
  });
});
