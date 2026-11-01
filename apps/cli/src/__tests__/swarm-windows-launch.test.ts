// How `claude` is found on Windows. spawn with shell:false cannot run a .cmd, and
// an npm global install of Claude Code is only a .cmd on PATH, so without this the
// launcher fails with ENOENT on the most common Windows setup while the same
// `claude` works in a terminal.

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { assertBuilt, runCli } from "./helpers/cli.js";
import { createFakeNpmClaude, type FakeClaude } from "./helpers/fake-claude.js";
import { resolveAgentCommand } from "../lib/swarm/agent-spawner.js";
import { CLAUDE_CLI_FLAGS, buildClaudeArgv } from "../lib/swarm/safety-envelope.js";

const WIN = process.platform === "win32";
const PROMPT = "# Tarefa\n\nRevisão de ação & 100% $HOME\n";

function git(cwd: string, ...args: string[]): void {
  const r = spawnSync(
    "git",
    ["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", ...args],
    { cwd, encoding: "utf8" }
  );
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
}

/** Only what git needs on PATH, so no real claude can answer instead of the fake. */
function gitOnlyPath(): string {
  const r = spawnSync("where", ["git"], { encoding: "utf8" });
  return path.dirname(r.stdout.split(/\r?\n/)[0].trim());
}

describe.skipIf(!WIN)("swarm --live on Windows", { timeout: 180000 }, () => {
  let parent: string;
  let base: string;
  let repo: string;

  beforeAll(() => {
    assertBuilt();
    parent = fs.mkdtempSync(path.join(os.tmpdir(), "pz npm açã "));
  });
  afterAll(() => {
    fs.rmSync(parent, { recursive: true, force: true, maxRetries: 3 });
  });

  beforeEach(() => {
    base = fs.mkdtempSync(path.join(os.tmpdir(), "pz win açã "));
    repo = path.join(base, "the repo");
    fs.mkdirSync(path.join(repo, ".agents", "prompts"), { recursive: true });
    git(repo, "init", "-q");
    fs.writeFileSync(path.join(repo, "README.md"), "hello\n");
    git(repo, "add", ".");
    git(repo, "commit", "-q", "-m", "first");
    fs.writeFileSync(path.join(repo, ".agents", "prompts", "a.md"), PROMPT);
  });
  afterEach(() => {
    fs.rmSync(base, { recursive: true, force: true, maxRetries: 3 });
  });

  function envWith(binDir: string): Record<string, string> {
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) {
      // This variable turns off the cwd search being tested, and a terminal or
      // CI host may have set it. Without it, this is a default Windows machine.
      if (k.toLowerCase() === "nodefaultcurrentdirectoryinexepath") continue;
      if (typeof v === "string" && k.toUpperCase() !== "PATH") env[k] = v;
    }
    env.PATH = binDir + path.delimiter + gitOnlyPath();
    return env;
  }

  it.each([["exe" as const], ["js" as const]])(
    "runs through an npm claude.cmd whose program is a .%s, with argv untouched",
    async (shape) => {
      const fake: FakeClaude = createFakeNpmClaude(parent, shape);
      fake.reset();
      const rule = "Bash(echo x & echo y %PATH% > z.txt)";
      const r = await runCli(["swarm", "--live", "--allowed-tools", `Read,${rule}`], {
        cwd: repo,
        fullEnv: envWith(fake.binDir),
      });
      expect(r.code, r.all).toBe(0);
      const [call] = fake.calls();
      expect(call.stdin).toBe(PROMPT);
      expect(call.stdinClosed).toBe(true);
      // A cmd.exe in the way would split on `&` and expand %PATH%.
      expect(call.argv).toContain(rule);
      expect(call.argv.join(" ")).not.toContain(gitOnlyPath());
      expect(path.basename(call.cwd)).toBe("agent-0");
      expect(fs.existsSync(path.join(call.cwd, "z.txt"))).toBe(false);
    }
  );

  it("still prefers a real claude.exe when both are in the same folder", () => {
    const dir = path.join(parent, "both");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "claude.exe"), "");
    fs.writeFileSync(path.join(dir, "claude.cmd"), "@echo off\r\n");
    const out = resolveAgentCommand("claude", ["-p"], { PATH: dir });
    expect(out).toEqual({ bin: path.join(dir, "claude.exe"), argv: ["-p"] });
  });

  it("reads PATH whatever its case, as Windows does", () => {
    const dir = path.join(parent, "cased");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "claude.exe"), "");
    expect(resolveAgentCommand("claude", [], { Path: dir }).bin).toBe(path.join(dir, "claude.exe"));
  });

  it("a batch file it cannot read fails with a reason, never through a shell", async () => {
    const dir = path.join(parent, "custom");
    fs.mkdirSync(dir, { recursive: true });
    const marker = path.join(repo, "ran-through-cmd.txt");
    fs.writeFileSync(path.join(dir, "claude.cmd"), `@echo off\r\necho ran > "${marker}"\r\n`);
    const r = await runCli(["swarm", "--live"], { cwd: repo, fullEnv: envWith(dir) });
    expect(r.code, r.all).toBe(1);
    expect(r.stderr).toMatch(/claude\.cmd/);
    expect(r.stderr).toMatch(/without a shell/);
    expect(r.all).not.toMatch(/\n\s+at\s/);
    expect(fs.existsSync(marker)).toBe(false);
  });

  it("a claude.exe committed to the repo does not run in place of a missing one", async () => {
    // spawn with a bare name looks in the child's cwd first on Windows, and the
    // cwd is a checkout of whatever repo the swarm is pointed at.
    const planted = createFakeNpmClaude(fs.mkdtempSync(path.join(base, "plant")), "exe");
    fs.copyFileSync(path.join(planted.dir, "claude.exe"), path.join(repo, "claude.exe"));
    fs.copyFileSync(path.join(planted.dir, "node-path.txt"), path.join(repo, "node-path.txt"));
    fs.copyFileSync(path.join(planted.dir, "fake-claude.cjs"), path.join(repo, "fake-claude.cjs"));
    fs.mkdirSync(path.join(repo, "calls"));
    fs.writeFileSync(path.join(repo, "calls", ".gitkeep"), "");
    fs.writeFileSync(path.join(repo, "behavior.json"), '{"default":"ok"}');
    git(repo, "add", "claude.exe", "node-path.txt", "fake-claude.cjs", "calls", "behavior.json");
    git(repo, "commit", "-q", "-m", "plant");

    const empty = path.join(base, "empty");
    fs.mkdirSync(empty);
    const r = await runCli(["swarm", "--live"], { cwd: repo, fullEnv: envWith(empty) });

    expect(r.code, r.all).toBe(1);
    expect(r.stderr).toMatch(/is Claude Code installed/);
    const wt = fs.readdirSync(path.join(repo, ".claude", "worktrees"))[0];
    const calls = path.join(repo, ".claude", "worktrees", wt, "agent-0", "calls");
    expect(fs.readdirSync(calls)).toEqual([".gitkeep"]);
  });
});

// A real install, when this machine has one. Only --help, which is local: no
// prompt, no account, no outside service.
describe("the flags we emit, against a real Claude Code", { timeout: 120000 }, () => {
  let help: string | null = null;
  let resolved: { bin: string; argv: string[] } | null = null;
  try {
    resolved = resolveAgentCommand("claude", ["--help"], process.env);
    const r = spawnSync(resolved.bin, resolved.argv, { encoding: "utf8", timeout: 60000 });
    if (r.status === 0) help = r.stdout;
  } catch {
    /* not installed here */
  }

  // Documented in the CLI reference as print-mode only, and absent from --help.
  const NOT_IN_HELP = new Set(["--max-turns"]);

  it.skipIf(help === null)("every long flag on the real argv is one claude --help lists", () => {
    const { argv } = buildClaudeArgv({
      sessionId: "00000000-0000-4000-8000-000000000000",
      workingDir: "/w",
      promptFile: "/p.md",
      mode: "work",
    });
    const flags = argv.filter((t) => t.startsWith("--") && !NOT_IN_HELP.has(t));
    expect(flags.length).toBeGreaterThan(5);
    for (const flag of flags) expect(help, `${flag} is not in claude --help`).toContain(flag);
  });

  it("the argv has no long flag outside the recorded list, which is checked above", () => {
    const { argv } = buildClaudeArgv({
      sessionId: "00000000-0000-4000-8000-000000000000",
      workingDir: "/w",
      promptFile: "/p.md",
      mode: "verify",
    });
    for (const t of argv.filter((x) => x.startsWith("--"))) {
      expect(CLAUDE_CLI_FLAGS).toContain(t);
    }
  });
});
