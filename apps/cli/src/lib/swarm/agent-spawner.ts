// agent-spawner.ts — the only module in the codebase that invokes
// `child_process.spawn` for Claude agents. Every swarm agent spawn
// funnels through `spawnClaudeAgent`, which:
//   1. Takes a pre-built argv array (never a string),
//   2. Calls spawn with shell:false (no shell interpretation),
//   3. Filters the child env to an allowlist (ledger row 7 — token leak via
//      child-process env),
//   4. Streams the prompt body to stdin rather than onto argv.
//
// Anti-gaming test (swarm.spawner.test.ts) greps this file for
// `.join(...argv...)`-shaped shell concatenation and fails if found. The
// test is a last-line check; the primary control is the API shape — the
// function signature does not expose a way to pass a shell string.

import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { auditArgv } from "./safety-envelope.js";

/**
 * Env vars the child `claude` process is allowed to inherit. Everything else
 * is stripped. In particular, NPM_TOKEN and other publish credentials are
 * never forwarded.
 */
export const CHILD_ENV_ALLOWLIST: readonly string[] = Object.freeze([
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

export interface SpawnAgentOptions {
  /** Binary to spawn. Defaults to "claude". */
  bin?: string;
  /** Safety-envelope-built argv. First element is NOT the binary. */
  argv: string[];
  /** Absolute path to the per-agent worktree. Becomes the child's cwd. */
  cwd: string;
  /** Absolute path to the prompt file. Streamed to child stdin. */
  promptFile: string;
  /**
   * Full parent env, usually `process.env`. Passed here (rather than read
   * from process.env directly) so tests can inject a deterministic map.
   */
  env?: NodeJS.ProcessEnv;
}

export interface SpawnedAgent {
  pid: number | undefined;
  proc: ChildProcess;
}

/**
 * Filter `env` down to the allowlist. Pure function.
 */
export function filterChildEnv(
  env: NodeJS.ProcessEnv
): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {};
  for (const key of CHILD_ENV_ALLOWLIST) {
    const v = env[key];
    if (typeof v === "string") out[key] = v;
  }
  return out;
}

/**
 * Spawn a Claude agent. argv is passed as-is; no shell is invoked; prompt
 * body is piped in via stdin (never placed on argv).
 */
export function spawnClaudeAgent(opts: SpawnAgentOptions): SpawnedAgent {
  const { bin = "claude", argv, cwd, promptFile, env = process.env } = opts;

  if (!Array.isArray(argv)) {
    throw new Error("agent-spawner: argv must be an array");
  }
  // Paranoia: audit the envelope one more time before spawning.
  const issue = auditArgv(argv);
  if (issue && !issue.startsWith("permissionMode=bypassPermissions")) {
    // The bypass case is allowed iff the safety envelope gate passed.
    throw new Error(`agent-spawner: refusing to spawn — ${issue}`);
  }

  const childEnv = filterChildEnv(env);

  const proc = spawn(bin, argv, {
    cwd,
    env: childEnv,
    shell: false, // CRITICAL: never invoke a shell. argv is taken literally.
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });

  // Stream the prompt body into stdin and close. Reading the whole file is
  // fine — prompts are typically <10 KB.
  try {
    const body = readFileSync(promptFile, "utf8");
    if (proc.stdin) {
      proc.stdin.write(body);
      proc.stdin.end();
    }
  } catch (err) {
    try {
      proc.kill("SIGTERM");
    } catch {
      /* ignore */
    }
    throw err;
  }

  return { pid: proc.pid, proc };
}
