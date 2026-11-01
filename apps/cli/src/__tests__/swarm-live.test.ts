// End-to-end: the built CLI, a real git repo and a fake `claude` first on PATH.
// This is the only place that sees what an agent actually receives, so it is
// what stops the launcher's safety promises from being true only in the plan.

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { assertBuilt, runCli } from "./helpers/cli.js";
import { createFakeClaude, type FakeClaude, type FakeCall } from "./helpers/fake-claude.js";

const SECRET = "SENTINEL-MUST-NOT-REACH-THE-CHILD";
const SECRETS = {
  NPM_TOKEN: SECRET,
  GITHUB_TOKEN: SECRET,
  GH_TOKEN: SECRET,
  ANTHROPIC_API_KEY: SECRET,
  AWS_SECRET_ACCESS_KEY: SECRET,
  SOME_RANDOM_VAR: SECRET,
};
// The accented text proves stdin stays UTF-8 and the prompt survives intact.
const PROMPT_A = "# Tarefa A\n\nRevisão de ação; quoted \"x\" & $HOME.\n";
const PROMPT_B = "# Tarefa B\n\nsecond body\n";
const PROMPT_C = "# Tarefa C\n\nthird body\n";

let fakeParent: string;
let base: string;
let repo: string;
let fake: FakeClaude;

function git(cwd: string, ...args: string[]): string {
  const r = spawnSync(
    "git",
    ["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", ...args],
    { cwd, encoding: "utf8" }
  );
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout;
}

function swarm(args: string[], extraEnv: Record<string, string> = {}) {
  return runCli(["swarm", ...args], { cwd: repo, fullEnv: fake.env({ ...SECRETS, ...extraEnv }) });
}

/** What follows `flag` on argv, up to the next flag. */
function valuesOf(call: FakeCall, flag: string): string[] {
  const start = call.argv.indexOf(flag);
  expect(start, `${flag} missing from ${JSON.stringify(call.argv)}`).toBeGreaterThanOrEqual(0);
  const out: string[] = [];
  for (let i = start + 1; i < call.argv.length && !call.argv[i].startsWith("--"); i++) {
    out.push(call.argv[i]);
  }
  return out;
}

/** The directory, with short names and links resolved, on every platform. */
function real(p: string): string {
  return fs.realpathSync.native(p);
}

function worktreeDirs(): string[] {
  const root = path.join(repo, ".claude", "worktrees");
  if (!fs.existsSync(root)) return [];
  const out: string[] = [];
  for (const swarmId of fs.readdirSync(root)) {
    for (const agent of fs.readdirSync(path.join(root, swarmId))) {
      out.push(path.join(root, swarmId, agent));
    }
  }
  return out;
}

beforeAll(() => {
  assertBuilt();
  // Spaces and accents on purpose: a common real path that CI never exercises.
  fakeParent = fs.mkdtempSync(path.join(os.tmpdir(), "pz fake açã "));
  fake = createFakeClaude(fakeParent);
});
afterAll(() => {
  fs.rmSync(fakeParent, { recursive: true, force: true, maxRetries: 3 });
});

beforeEach(() => {
  fake.reset();
  base = fs.mkdtempSync(path.join(os.tmpdir(), "pz live açã "));
  repo = path.join(base, "the repo");
  fs.mkdirSync(path.join(repo, ".agents", "prompts"), { recursive: true });
  git(repo, "init", "-q");
  fs.writeFileSync(path.join(repo, "README.md"), "hello\n");
  git(repo, "add", ".");
  git(repo, "commit", "-q", "-m", "first");
  fs.writeFileSync(path.join(repo, ".agents", "prompts", "a.md"), PROMPT_A);
  fs.writeFileSync(path.join(repo, ".agents", "prompts", "b.md"), PROMPT_B);
});

afterEach(() => {
  fs.rmSync(base, { recursive: true, force: true, maxRetries: 3 });
});

describe("swarm is a dry run unless --live", { timeout: 180000 }, () => {
  it.each([[[]], [["--dry-run"]]])("%j spawns nothing and creates no worktree", async (flags) => {
    const r = await swarm(["--count", "2", ...flags]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("agent[1]");
    expect(fake.calls()).toEqual([]);
    expect(worktreeDirs()).toEqual([]);
  });
});

describe("swarm --live: what each agent receives", { timeout: 180000 }, () => {
  it("runs each agent once, in its own registered worktree, on its own swarm branch", async () => {
    const r = await swarm(["--count", "2", "--live", "--session-prefix", "wt"]);
    expect(r.code, r.all).toBe(0);
    const calls = fake.calls();
    expect(calls).toHaveLength(2);

    const dirs = worktreeDirs().map(real).sort();
    expect(dirs).toHaveLength(2);
    expect(dirs.map((d) => path.basename(d))).toEqual(["agent-0", "agent-1"]);
    expect(calls.map((c) => real(c.cwd)).sort()).toEqual(dirs);

    const listed = git(repo, "worktree", "list", "--porcelain");
    expect(listed).toMatch(/branch refs\/heads\/swarm\/wt-\d+\/agent-0/);
    expect(listed).toMatch(/branch refs\/heads\/swarm\/wt-\d+\/agent-1/);
    // The agents worked on a checkout, not on an empty folder.
    expect(fs.existsSync(path.join(calls[0].cwd, "README.md"))).toBe(true);
  });

  it("sends each prompt on stdin, whole, then closes stdin, and never on argv", async () => {
    const r = await swarm(["--count", "2", "--live"]);
    expect(r.code, r.all).toBe(0);
    const [first, second] = fake.calls();
    expect(first.stdin).toBe(PROMPT_A);
    expect(second.stdin).toBe(PROMPT_B);
    expect(first.stdinClosed).toBe(true);
    expect(second.stdinClosed).toBe(true);
    for (const call of [first, second]) {
      const joined = call.argv.join("\n");
      expect(joined).not.toContain("Tarefa");
      expect(joined).not.toContain("a.md");
    }
  });

  it("delivers argv tokens literally: no shell splits or expands a rule", async () => {
    const rule = "Bash(echo x & echo y %PATH% > z.txt)";
    const r = await swarm(["--live", "--allowed-tools", `Read,${rule}`]);
    expect(r.code, r.all).toBe(0);
    const [call] = fake.calls();
    expect(valuesOf(call, "--allowed-tools")).toEqual(["Read", rule]);
    expect(fs.existsSync(path.join(call.cwd, "z.txt"))).toBe(false);
  });

  it("emits the whole default envelope on the child's argv", async () => {
    const r = await swarm(["--live"]);
    expect(r.code, r.all).toBe(0);
    const [call] = fake.calls();
    // The whole line, in order: a flag nobody asked for is an "unknown option"
    // exit from the real CLI, so an extra token must fail here.
    expect(call.argv).toEqual([
      "-p",
      "--verbose",
      "--output-format",
      "stream-json",
      "--permission-mode",
      "acceptEdits",
      "--allowed-tools",
      "Read",
      "Write",
      "Edit",
      "Bash(git:*)",
      "Bash(npm:*)",
      "--disallowed-tools",
      "Bash(rm:*)",
      "Bash(curl:*)",
      "Bash(wget:*)",
      "Bash(ssh:*)",
      "WebFetch",
      "WebSearch",
      "--max-turns",
      "20",
      "--max-budget-usd",
      "5.00",
      "--session-id",
      call.argv[call.argv.length - 1],
    ]);
    expect(call.argv.slice(0, 4)).toEqual(["-p", "--verbose", "--output-format", "stream-json"]);
    expect(valuesOf(call, "--permission-mode")).toEqual(["acceptEdits"]);
    expect(valuesOf(call, "--allowed-tools")).toEqual(["Read", "Write", "Edit", "Bash(git:*)", "Bash(npm:*)"]);
    expect(valuesOf(call, "--disallowed-tools")).toEqual([
      "Bash(rm:*)",
      "Bash(curl:*)",
      "Bash(wget:*)",
      "Bash(ssh:*)",
      "WebFetch",
      "WebSearch",
    ]);
    expect(valuesOf(call, "--max-turns")).toEqual(["20"]);
    expect(valuesOf(call, "--max-budget-usd")).toEqual(["5.00"]);
    expect(valuesOf(call, "--session-id")[0]).toMatch(/^[a-f0-9-]{36}$/);
  });

  it("forwards non-default limits and tool lists to the child", async () => {
    const r = await swarm([
      "--live",
      "--max-turns",
      "3",
      "--max-budget-usd",
      "0.50",
      "--disallowed-tools",
      "Bash(sudo:*),WebFetch",
    ]);
    expect(r.code, r.all).toBe(0);
    const [call] = fake.calls();
    expect(valuesOf(call, "--max-turns")).toEqual(["3"]);
    expect(valuesOf(call, "--max-budget-usd")).toEqual(["0.50"]);
    expect(valuesOf(call, "--disallowed-tools")).toEqual(["Bash(sudo:*)", "WebFetch"]);
  });

  it("gives every agent its own session id", async () => {
    await swarm(["--count", "3", "--live"]);
    const ids = fake.calls().map((c) => valuesOf(c, "--session-id")[0]);
    expect(new Set(ids).size).toBe(3);
  });

  it("strips secrets from the child env and keeps what claude needs", async () => {
    const r = await swarm(["--live"], { CLAUDE_CODE_OAUTH_TOKEN: "oauth-ok" });
    expect(r.code, r.all).toBe(0);
    const [call] = fake.calls();
    expect(JSON.stringify(call.env)).not.toContain(SECRET);
    for (const name of Object.keys(SECRETS)) expect(call.env[name]).toBeUndefined();
    expect(call.env.CLAUDE_CODE_OAUTH_TOKEN).toBe("oauth-ok");
    expect(call.env.PATH ?? call.env.Path).toBeTruthy();
  });
});

describe("swarm --live: the --i-understand gate at the CLI", { timeout: 180000 }, () => {
  it("--permission-mode bypassPermissions without --i-understand runs acceptEdits", async () => {
    const r = await swarm(["--live", "--permission-mode", "bypassPermissions"]);
    expect(r.code, r.all).toBe(0);
    const [call] = fake.calls();
    expect(valuesOf(call, "--permission-mode")).toEqual(["acceptEdits"]);
    expect(call.argv).not.toContain("bypassPermissions");
  });

  it("--permission-mode plan in work mode reaches the child as plan", async () => {
    const r = await swarm(["--live", "--permission-mode", "plan"]);
    expect(r.code, r.all).toBe(0);
    expect(valuesOf(fake.calls()[0], "--permission-mode")).toEqual(["plan"]);
  });

  it("--i-understand on its own does not turn bypass on", async () => {
    await swarm(["--live", "--i-understand"]);
    expect(valuesOf(fake.calls()[0], "--permission-mode")).toEqual(["acceptEdits"]);
  });

  it("both together pass bypassPermissions through", async () => {
    const r = await swarm(["--live", "--permission-mode", "bypassPermissions", "--i-understand"]);
    expect(r.code, r.all).toBe(0);
    expect(valuesOf(fake.calls()[0], "--permission-mode")).toEqual(["bypassPermissions"]);
  });

  it("--mode verify stays plan and read-only whatever else is passed", async () => {
    const r = await swarm([
      "--live",
      "--mode",
      "verify",
      "--permission-mode",
      "bypassPermissions",
      "--i-understand",
      "--allowed-tools",
      "Write",
      "--disallowed-tools",
      "Read",
    ]);
    expect(r.code, r.all).toBe(0);
    const [call] = fake.calls();
    expect(valuesOf(call, "--permission-mode")).toEqual(["plan"]);
    expect(valuesOf(call, "--allowed-tools")).toEqual(["Read", "Grep", "Glob", "Bash(git diff:*)"]);
    // A caller's list adds to the verify deny list. It must not replace it.
    const denied = valuesOf(call, "--disallowed-tools");
    expect(denied).toContain("Read");
    expect(denied).toContain("WebFetch");
    expect(denied).toContain("Bash(rm:*)");
    // `git diff --output=F` writes a file, and verify allows `git diff`.
    expect(denied).toContain("Bash(git diff --output:*)");
  });
});

describe("swarm --live: outcome and exit code", { timeout: 180000 }, () => {
  it("every agent succeeding exits 0 and says complete", async () => {
    const r = await swarm(["--count", "2", "--live"]);
    expect(r.code, r.all).toBe(0);
    expect(r.stdout).toMatch(/Swarm \S+ complete: 2 agent/);
    expect(r.stderr).not.toMatch(/FAILED/);
  });

  it.each([
    ["fail", /exited with code 1/],
    ["iserror", /is_error=true/],
    ["noresult", /no stream-json result/],
    ["okthenerr", /error_during_execution/],
    ["garbage", /not stream-json/],
    ["errorresult", /error_max_turns/],
  ] as const)("a child in mode %s exits 1 with its reason", async (mode, reason) => {
    fake.behave({ default: mode });
    const r = await swarm(["--live"]);
    expect(r.code, r.all).toBe(1);
    expect(r.stderr).toMatch(reason);
    expect(r.stderr).toMatch(/FAILED: 1 of 1 agent/);
    expect(r.stdout).not.toMatch(/complete:/);
  });

  it("one failure among successes still fails the run and names that agent", async () => {
    fake.behave({ default: "ok", "agent-1": "fail" });
    const r = await swarm(["--count", "3", "--live"]);
    expect(r.code, r.all).toBe(1);
    expect(r.stderr).toMatch(/\[agent-1\].*exited with code 1/);
    expect(r.stderr).not.toMatch(/\[agent-0\].*failed/);
    expect(r.stderr).toMatch(/FAILED: 1 of 3 agent/);
    expect(fake.calls()).toHaveLength(3);
  });

  it("a final result line with no trailing newline still counts", async () => {
    fake.behave({ default: "notrail" });
    const r = await swarm(["--live"]);
    expect(r.code, r.all).toBe(0);
    expect(r.stdout).toMatch(/"subtype":"success"/);
  });

  it.skipIf(process.platform === "win32" || process.getuid?.() === 0)(
    "an agent whose prompt cannot be read fails, and is not counted as a success",
    async () => {
      // spawnClaudeAgent throws before any child exists, so this is the path
      // where no process and no output can say that something went wrong.
      const prompt = path.join(repo, ".agents", "prompts", "a.md");
      fs.chmodSync(prompt, 0o000);
      try {
        const r = await swarm(["--live"]);
        expect(r.code, r.all).toBe(1);
        expect(r.stderr).toMatch(/\[agent-0\].*spawn refused/);
        expect(r.stderr).toMatch(/FAILED: 1 of 1 agent/);
        expect(fake.calls()).toEqual([]);
      } finally {
        fs.chmodSync(prompt, 0o644);
      }
    }
  );

  it("no claude on PATH fails with a hint and no stack trace", async () => {
    const r = await runCli(["swarm", "--live"], {
      cwd: repo,
      fullEnv: { ...fake.env(), PATH: path.join(base, "empty-dir") + path.delimiter + path.dirname(gitPath()) },
    });
    expect(r.code, r.all).toBe(1);
    expect(r.stderr).toMatch(/is Claude Code installed/);
    expect(r.stderr).toMatch(/FAILED: 1 of 1 agent/);
    expect(r.all).not.toMatch(/\n\s+at\s/);
  });
});

function gitPath(): string {
  const which = process.platform === "win32" ? "where" : "which";
  return spawnSync(which, ["git"], { encoding: "utf8" }).stdout.split(/\r?\n/)[0].trim();
}

describe("swarm --live: a child that does not read its prompt", { timeout: 180000 }, () => {
  // Larger than any OS pipe buffer, so the write fails once the child is gone.
  const HUGE = "x".repeat(5 * 1024 * 1024);

  beforeEach(() => {
    fs.writeFileSync(path.join(repo, ".agents", "prompts", "a.md"), HUGE);
    fs.writeFileSync(path.join(repo, ".agents", "prompts", "b.md"), HUGE);
  });

  it("is a reported agent failure, not a launcher crash", async () => {
    fake.behave({ default: "noread" });
    const r = await swarm(["--count", "2", "--live"]);
    expect(r.code, r.all).toBe(1);
    expect(r.all).not.toMatch(/Emitted 'error' event|Unhandled 'error'/);
    expect(r.all).not.toMatch(/\n\s+at\s/);
    expect(r.stderr).toMatch(/\[agent-0\].*failed: .*prompt/);
    expect(r.stderr).toMatch(/\[agent-1\].*failed: .*prompt/);
    expect(r.stderr, r.all).toMatch(/FAILED: 2 of 2 agent/);
  });

  it("does not take down a sibling that reads its prompt", async () => {
    fake.behave({ default: "ok", "agent-0": "noread" });
    const r = await swarm(["--count", "2", "--live"]);
    expect(r.code, r.all).toBe(1);
    expect(r.stderr, r.all).toMatch(/FAILED: 1 of 2 agent/);
    expect(r.stderr).toMatch(/\[agent-0\].*failed/);
    const sibling = fake.calls().find((c) => path.basename(c.cwd) === "agent-1");
    expect(sibling?.stdin.length).toBe(HUGE.length);
    expect(sibling?.stdinClosed).toBe(true);
  });
});

describe("swarm: prompts and refusals", { timeout: 180000 }, () => {
  it("--prompts reads that folder instead of the default", async () => {
    const other = path.join(base, "other prompts");
    fs.mkdirSync(other);
    fs.writeFileSync(path.join(other, "z.md"), "from the other folder\n");
    const r = await swarm(["--live", "--prompts", other]);
    expect(r.code, r.all).toBe(0);
    expect(fake.calls()[0].stdin).toBe("from the other folder\n");
  });

  it("warns when --count leaves prompts unassigned, and names them", async () => {
    fs.writeFileSync(path.join(repo, ".agents", "prompts", "c.md"), PROMPT_C);
    const r = await swarm(["--count", "2", "--live"]);
    expect(r.code, r.all).toBe(0);
    expect(fake.calls().map((c) => c.stdin)).toEqual([PROMPT_A, PROMPT_B]);
    expect(r.stderr).toMatch(/1 of 3 prompts? .*not assigned/i);
    expect(r.stderr).toContain("c.md");
    expect(r.stderr).not.toContain("a.md");
  });

  it("the default --count of 1 also warns in a dry run", async () => {
    const r = await swarm([]);
    expect(r.code).toBe(0);
    expect(r.stderr).toContain("b.md");
  });

  it("does not warn when every prompt has an agent", async () => {
    const r = await swarm(["--count", "2"]);
    expect(r.stderr).not.toMatch(/not assigned/i);
  });

  it.each([
    [["--mode", "wrok"], /--mode must be/],
    [["--permission-mode", "bypass"], /--permission-mode must be/],
    [["--count", "0"], /--count must be/],
    [["--count", "16"], /--count must be/],
    [["--count", "0x2"], /--count must be/],
    [["--count", "1e1"], /--count must be/],
    [["--max-turns", "1e21"], /--max-turns must be/],
    [["--max-turns", "0x10"], /--max-turns must be/],
    [["--max-budget-usd", "0,5"], /--max-budget-usd must be/],
    [["--allowed-tools", "read_file"], /invalid allowedTools rule/],
    [["--disallowed-tools", "bash(rm:*)"], /invalid disallowedTools rule/],
    [["--session-prefix", "../x"], /invalid swarmId/],
  ])("%j is refused before anything runs", async (flags, message) => {
    const r = await swarm([...flags, "--live"]);
    expect(r.code, r.all).toBe(1);
    expect(r.stderr).toMatch(message);
    expect(fake.calls()).toEqual([]);
    expect(worktreeDirs()).toEqual([]);
  });

  it.each([[[]], [["--dry-run"]], [["--live"]], [["--live", "--permission-mode", "bypassPermissions", "--i-understand"]]])(
    "a rule with a shell metacharacter is refused the same way with %j",
    async (flags) => {
      const r = await swarm(["--allowed-tools", "Bash(a && b)", ...flags]);
      expect(r.code, r.all).toBe(1);
      expect(r.stderr).toMatch(/metacharacter/);
      expect(r.stdout).not.toMatch(/swarm-id:/);
      expect(fake.calls()).toEqual([]);
      expect(worktreeDirs()).toEqual([]);
    }
  );

  it("a long --session-prefix keeps the timestamp, so a second run still works", async () => {
    const prefix = "p".repeat(32);
    const first = await swarm(["--live", "--session-prefix", prefix]);
    expect(first.code, first.all).toBe(0);
    await new Promise((r) => setTimeout(r, 1100));
    const second = await swarm(["--live", "--session-prefix", prefix]);
    expect(second.code, second.all).toBe(0);
    const id = /swarm-id: (\S+)/.exec(second.stdout)?.[1] ?? "";
    expect(id.length).toBeLessThanOrEqual(32);
    expect(id).toMatch(/-\d{14}$/);
  });
});

describe("swarm --live: a worktree that cannot be created", { timeout: 180000 }, () => {
  it("leaves no worktree or branch from the agents before it, and starts no agent", async () => {
    // git refuses the third branch, the way an existing branch or a full disk
    // would, after the first two worktrees already exist.
    const hook = path.join(repo, ".git", "hooks", "reference-transaction");
    fs.writeFileSync(
      hook,
      '#!/bin/sh\nif [ "$1" = prepared ] && grep -q "swarm/.*/agent-2"; then exit 1; fi\nexit 0\n'
    );
    fs.chmodSync(hook, 0o755);

    const r = await swarm(["--count", "3", "--live"]);

    expect(r.code, r.all).toBe(1);
    expect(r.stderr).toMatch(/git worktree add failed/);
    expect(fake.calls()).toEqual([]);
    expect(worktreeDirs()).toEqual([]);
    expect(git(repo, "worktree", "list", "--porcelain")).not.toMatch(/agent-\d/);
    expect(git(repo, "branch", "--list", "swarm/*").trim()).toBe("");
  });
});

describe("swarm --live: repositories it cannot work in", { timeout: 180000 }, () => {
  it("a repo with no commits gets a clear message and no agent runs", async () => {
    const fresh = path.join(base, "unborn");
    fs.mkdirSync(path.join(fresh, ".agents", "prompts"), { recursive: true });
    git(fresh, "init", "-q");
    fs.writeFileSync(path.join(fresh, ".agents", "prompts", "a.md"), PROMPT_A);
    const r = await runCli(["swarm", "--live"], { cwd: fresh, fullEnv: fake.env() });
    expect(r.code, r.all).toBe(1);
    expect(r.stderr).toMatch(/no commits/i);
    expect(r.stderr).toMatch(/git commit/);
    expect(r.stderr).not.toMatch(/invalid reference/);
    expect(fake.calls()).toEqual([]);
  });

  it("a folder that is not a repo gets a clear message and no agent runs", async () => {
    const plain = path.join(base, "plain");
    fs.mkdirSync(path.join(plain, ".agents", "prompts"), { recursive: true });
    fs.writeFileSync(path.join(plain, ".agents", "prompts", "a.md"), PROMPT_A);
    const r = await runCli(["swarm", "--live"], { cwd: plain, fullEnv: fake.env() });
    expect(r.code, r.all).toBe(1);
    expect(r.stderr).toMatch(/not a git repository/i);
    expect(fake.calls()).toEqual([]);
  });
});
