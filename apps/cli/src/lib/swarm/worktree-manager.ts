// worktree-manager.ts — thin wrappers around `git worktree` for swarm
// isolation. Per-agent worktrees are how we prevent two agents from racing
// the same file (ledger row 5 — filesystem race across parallel agents).
//
// Security constraints:
//   - Worktree names are validated against a tight regex (max 32 chars,
//     alnum + _ + -). No path traversal, no shell metacharacters.
//   - All git shell-outs use argv-array spawn with shell:false.
//   - Paths resolve inside the repo root; anything pointing elsewhere is
//     rejected.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const NAME_RE = /^[a-zA-Z0-9_-]{1,32}$/;

/**
 * Worktrees live under .claude/worktrees/<swarm-id>/agent-<n>. The swarm-id
 * is also name-validated. Agent index is a positive integer.
 */
export interface WorktreeHandle {
  swarmId: string;
  agentIndex: number;
  /** Absolute path inside the repo. */
  path: string;
  /** Branch created for this worktree (detached by default). */
  ref: string;
}

export interface WorktreeManagerOptions {
  /** Repo root. Defaults to process.cwd(). */
  repoRoot?: string;
  /** Base ref to branch worktrees from. Defaults to HEAD. */
  baseRef?: string;
}

function runGit(
  args: string[],
  cwd: string
): { ok: boolean; stdout: string; stderr: string; code: number } {
  const res = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    ok: res.status === 0,
    stdout: res.stdout || "",
    stderr: res.stderr || "",
    code: res.status ?? -1,
  };
}

function assertName(kind: string, value: string): void {
  if (!NAME_RE.test(value)) {
    throw new Error(
      `worktree-manager: invalid ${kind} "${value}" — must match ${NAME_RE}`
    );
  }
}

function resolveRoot(opts: WorktreeManagerOptions | undefined): string {
  return path.resolve(opts?.repoRoot ?? process.cwd());
}

/**
 * Create a new worktree at the canonical location and return its handle.
 * Caller is responsible for cleanup via `removeWorktree` (or
 * `antigravity swarm clean` later).
 */
export function createWorktree(
  swarmId: string,
  agentIndex: number,
  opts: WorktreeManagerOptions = {}
): WorktreeHandle {
  assertName("swarmId", swarmId);
  if (!Number.isInteger(agentIndex) || agentIndex < 0 || agentIndex > 99) {
    throw new Error(
      `worktree-manager: agentIndex must be an integer in [0,99], got ${agentIndex}`
    );
  }

  const repoRoot = resolveRoot(opts);
  const baseRef = opts.baseRef ?? "HEAD";

  const wtPath = path.join(
    repoRoot,
    ".claude",
    "worktrees",
    swarmId,
    `agent-${agentIndex}`
  );

  // Safety: the resolved path must still live inside the repo.
  const rel = path.relative(repoRoot, wtPath);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(
      `worktree-manager: refusing to create worktree outside repo root: ${wtPath}`
    );
  }

  const branch = `swarm/${swarmId}/agent-${agentIndex}`;
  const res = runGit(
    ["worktree", "add", "-b", branch, wtPath, baseRef],
    repoRoot
  );
  if (!res.ok) {
    throw new Error(
      `worktree-manager: git worktree add failed (code ${res.code}): ${res.stderr.trim()}`
    );
  }

  return { swarmId, agentIndex, path: wtPath, ref: branch };
}

/**
 * Force-remove a worktree. Safe to call on a path that no longer exists —
 * returns `false` in that case, `true` on successful removal.
 */
export function removeWorktree(
  handle: WorktreeHandle,
  opts: WorktreeManagerOptions = {}
): boolean {
  const repoRoot = resolveRoot(opts);
  if (!existsSync(handle.path)) return false;
  const res = runGit(
    ["worktree", "remove", "--force", handle.path],
    repoRoot
  );
  return res.ok;
}

/**
 * List every worktree currently registered for a swarm id.
 */
export function listWorktreesForSwarm(
  swarmId: string,
  opts: WorktreeManagerOptions = {}
): WorktreeHandle[] {
  assertName("swarmId", swarmId);
  const repoRoot = resolveRoot(opts);
  const res = runGit(["worktree", "list", "--porcelain"], repoRoot);
  if (!res.ok) return [];

  const out: WorktreeHandle[] = [];
  const blocks = res.stdout.split(/\r?\n\r?\n/);
  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    const wtLine = lines.find((l) => l.startsWith("worktree "));
    const branchLine = lines.find((l) => l.startsWith("branch "));
    if (!wtLine) continue;
    const p = wtLine.slice("worktree ".length).trim();
    const ref = branchLine ? branchLine.slice("branch ".length).trim() : "";
    const match = p.match(/[\\/]worktrees[\\/]([^\\/]+)[\\/]agent-(\d+)$/);
    if (!match || match[1] !== swarmId) continue;
    out.push({
      swarmId,
      agentIndex: Number(match[2]),
      path: p,
      ref,
    });
  }
  return out;
}

/**
 * Resolve the canonical worktree path for a (swarmId, agentIndex) pair
 * without touching git. Used by dry-run to preview paths.
 */
export function worktreePathFor(
  swarmId: string,
  agentIndex: number,
  opts: WorktreeManagerOptions = {}
): string {
  assertName("swarmId", swarmId);
  const repoRoot = resolveRoot(opts);
  return path.join(
    repoRoot,
    ".claude",
    "worktrees",
    swarmId,
    `agent-${agentIndex}`
  );
}
