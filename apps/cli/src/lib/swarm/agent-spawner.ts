// agent-spawner.ts — the only module in the codebase that invokes
// `child_process.spawn` for Claude agents. Every swarm agent spawn
// funnels through `spawnClaudeAgent`, which:
//   1. Takes a pre-built argv array (never a string),
//   2. Calls spawn with shell:false (no shell interpretation),
//   3. Filters the child env to an allowlist (ledger row 7 — token leak via
//      child-process env),
//   4. Streams the prompt body to stdin rather than onto argv.
//
// swarm-live.test.ts checks all of this on what a fake `claude` really receives.
// The primary control is the API shape: the function signature does not expose
// a way to pass a shell string.

import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { auditArgv, isBlockingAudit } from "./safety-envelope.js";

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
  /**
   * Set if the prompt could not be written to the child's stdin, typically
   * because it exited without reading it. Valid once `proc` has closed.
   */
  promptError?: Error;
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

export interface ResolvedCommand {
  bin: string;
  argv: string[];
}

/**
 * The program a Windows .cmd shim written by npm starts, relative to the shim's
 * folder, or null if the file is not in that shape. Both shapes end in the quoted
 * target followed by %*, the arguments being forwarded:
 *   "%dp0%\node_modules\...\bin\claude.exe"   %*
 *   "%_prog%"  "%dp0%\node_modules\...\cli.js" %*
 */
export function parseCmdShimTarget(text: string): string | null {
  const m = text.match(/"%~?dp0%?[\\/]([^"\r\n]+)"[ \t]+%\*/i);
  return m ? m[1] : null;
}

function envPath(env: NodeJS.ProcessEnv): string {
  // A plain object is case-sensitive, and Windows spells this "Path".
  for (const [k, v] of Object.entries(env)) {
    if (k.toUpperCase() === "PATH" && typeof v === "string") return v;
  }
  return "";
}

/**
 * Turn the `claude` name into a program and argv that spawn can run with no
 * shell. Only Windows needs work, for two reasons:
 *  - spawn cannot run a .cmd without cmd.exe, which would re-parse argv, and an
 *    npm global install is only a .cmd on PATH. So the shim is read and the
 *    program it points at is started directly.
 *  - with a bare name, spawn looks in the child's cwd before PATH. The cwd is a
 *    checkout of whatever repo the swarm runs on, so a claude.exe committed there
 *    would run. PATH is searched here instead, absolute entries only.
 */
export function resolveAgentCommand(
  bin: string,
  argv: string[],
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform = process.platform
): ResolvedCommand {
  if (platform !== "win32") return { bin, argv };
  if (/[\\/]/.test(bin)) return { bin, argv };

  for (const raw of envPath(env).split(";")) {
    const dir = raw.trim().replace(/^"(.*)"$/, "$1");
    if (!path.isAbsolute(dir)) continue;
    // cmd.exe's own order for the default PATHEXT.
    for (const ext of [".com", ".exe", ".bat", ".cmd"]) {
      const candidate = path.join(dir, bin + ext);
      if (!existsSync(candidate)) continue;
      if (ext === ".com" || ext === ".exe") return { bin: candidate, argv };
      return resolveBatchShim(candidate, argv);
    }
  }
  throw new Error(`spawn ${bin} ENOENT: not found on PATH`);
}

function resolveBatchShim(file: string, argv: string[]): ResolvedCommand {
  const target = parseCmdShimTarget(readFileSync(file, "utf8"));
  const full = target ? path.join(path.dirname(file), target) : null;
  if (full && existsSync(full)) {
    if (/\.(?:exe|com)$/i.test(full)) return { bin: full, argv };
    if (/\.[cm]?js$/i.test(full)) return { bin: process.execPath, argv: [full, ...argv] };
  }
  throw new Error(
    `${file} is a batch file and its target could not be read, so it cannot be run without a shell. ` +
      "A shell would re-parse the agent's arguments. Put claude.exe on PATH instead."
  );
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
  if (isBlockingAudit(issue)) {
    // The bypass case is allowed iff the safety envelope gate passed.
    throw new Error(`agent-spawner: refusing to spawn — ${issue}`);
  }

  // Read first: an unreadable prompt must not leave a child already running.
  const body = readFileSync(promptFile, "utf8");

  const childEnv = filterChildEnv(env);
  const command = resolveAgentCommand(bin, argv, env);

  const proc = spawn(command.bin, command.argv, {
    cwd,
    env: childEnv,
    shell: false, // CRITICAL: never invoke a shell. argv is taken literally.
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });

  const agent: SpawnedAgent = { pid: proc.pid, proc };

  // Stream the prompt body into stdin and close. A child can exit without
  // reading it, and for a prompt larger than the pipe buffer that surfaces as
  // an 'error' on this stream. With no listener Node would turn it into an
  // uncaught exception and take the launcher and every sibling agent down.
  if (proc.stdin) {
    proc.stdin.on("error", (err: Error) => {
      agent.promptError = err;
    });
    proc.stdin.write(body);
    proc.stdin.end();
  }

  return agent;
}
