// swarm.ts — `antigravity swarm` command. In v1.1.0 the command ships with
// --dry-run as the primary, fully-tested path: it builds the complete plan
// (safety envelope, worktree paths, prompt assignments, budget limits) and
// prints it WITHOUT spawning any agents. Live execution uses the same plan
// builder under the hood; the TUI renderer is deliberately stubbed behind
// a --live flag so v1.1.0 ships with the security-critical parts proven
// while the TUI UX matures in v1.1.x.

import { Command } from "commander";
import pc from "picocolors";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { theme } from "../lib/theme.js";
import {
  buildClaudeArgv,
  type PermissionMode,
  type SwarmMode,
} from "../lib/swarm/safety-envelope.js";
import {
  discoverPrompts,
  type PromptDescriptor,
} from "../lib/swarm/prompt-browser.js";
import {
  worktreePathFor,
  createWorktree,
  type WorktreeHandle,
} from "../lib/swarm/worktree-manager.js";
import { spawnClaudeAgent } from "../lib/swarm/agent-spawner.js";
import { superviseAgent } from "../lib/swarm/agent-outcome.js";

export interface SwarmAgentPlan {
  index: number;
  sessionId: string;
  worktreePath: string;
  prompt: PromptDescriptor;
  argv: string[];
}

export interface SwarmPlan {
  id: string;
  mode: SwarmMode;
  count: number;
  agents: SwarmAgentPlan[];
}

function parseCount(raw: string | undefined, fallback = 1): number {
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 15) {
    throw new Error(
      `swarm: --count must be an integer in [1,15], got "${raw}"`
    );
  }
  return n;
}

function parseMode(raw: string | undefined): SwarmMode {
  if (raw === undefined || raw === "work") return "work";
  if (raw === "verify") return "verify";
  throw new Error(`swarm: --mode must be "work" or "verify", got "${raw}"`);
}

function parsePermissionMode(
  raw: string | undefined
): PermissionMode | undefined {
  if (raw === undefined) return undefined;
  if (raw === "plan" || raw === "acceptEdits" || raw === "bypassPermissions") {
    return raw;
  }
  throw new Error(
    `swarm: --permission-mode must be plan|acceptEdits|bypassPermissions, got "${raw}"`
  );
}

/**
 * Parse `--max-turns`. Must be a whole number >= 1. Invalid input is
 * refused instead of silently falling back to the default (before, "x" or
 * "0" became 20 turns and "1.5" was passed through to Claude Code as-is).
 */
export function parseMaxTurns(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const n = Number(raw.trim());
  if (raw.trim() === "" || !Number.isInteger(n) || n < 1) {
    throw new Error(
      `swarm: --max-turns must be a whole number >= 1, got "${raw}"`
    );
  }
  return n;
}

/**
 * Parse `--max-budget-usd`. Must be a plain decimal number >= 0.01 (use a
 * dot as the decimal separator). Invalid input is refused: before, values
 * such as "0,5", "0" or "abc" silently became the 5.00 default, i.e. a
 * higher spend cap than the operator asked for.
 */
export function parseMaxBudgetUsd(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  const n = Number(trimmed);
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(trimmed) || !Number.isFinite(n) || n < 0.01) {
    throw new Error(
      `swarm: --max-budget-usd must be a number >= 0.01 with a dot as decimal separator (e.g. 0.50), got "${raw}"`
    );
  }
  return n;
}

function parseList(raw: string | undefined): string[] | undefined {
  if (raw === undefined) return undefined;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function makeSwarmId(prefix: string | undefined): string {
  const base = prefix ?? "swarm";
  const ts = new Date()
    .toISOString()
    .replace(/[^0-9]/g, "")
    .slice(0, 14);
  // Keep the id within the [a-zA-Z0-9_-]{1,32} name regex.
  return `${base}-${ts}`.slice(0, 32);
}

/**
 * Build a fully-resolved swarm plan. Pure function: no spawns, no worktree
 * creation, no filesystem mutations.
 */
export function buildSwarmPlan(args: {
  count: number;
  mode: SwarmMode;
  prompts: PromptDescriptor[];
  sessionPrefix?: string;
  permissionMode?: PermissionMode;
  iUnderstand?: boolean;
  allowedTools?: string[];
  disallowedTools?: string[];
  maxTurns?: number;
  maxBudgetUsd?: number;
  repoRoot?: string;
}): SwarmPlan {
  const {
    count,
    mode,
    prompts,
    sessionPrefix,
    permissionMode,
    iUnderstand,
    allowedTools,
    disallowedTools,
    maxTurns,
    maxBudgetUsd,
    repoRoot,
  } = args;

  if (prompts.length === 0) {
    throw new Error(
      "swarm: no prompts discovered (default glob: .agents/prompts/*.md). " +
      "Scaffold some with `antigravity init` or pass --prompts."
    );
  }

  const swarmId = makeSwarmId(sessionPrefix);
  const agents: SwarmAgentPlan[] = [];

  for (let i = 0; i < count; i++) {
    // Round-robin over prompts if count > prompts.length.
    const prompt = prompts[i % prompts.length];
    const sessionId = randomUUID();
    const wtPath = worktreePathFor(swarmId, i, { repoRoot });

    const built = buildClaudeArgv({
      sessionId,
      workingDir: wtPath,
      promptFile: prompt.path,
      mode,
      permissionMode,
      iUnderstand,
      allowedTools,
      disallowedTools,
      maxTurns,
      maxBudgetUsd,
    });

    agents.push({
      index: i,
      sessionId,
      worktreePath: wtPath,
      prompt,
      argv: built.argv,
    });
  }

  return { id: swarmId, mode, count, agents };
}

/**
 * Print a deterministic, diff-friendly rendering of a plan. Used by both
 * the human-readable --dry-run and the golden-file tests.
 */
export function renderPlan(plan: SwarmPlan): string {
  const lines: string[] = [];
  lines.push(`swarm-id: ${plan.id}`);
  lines.push(`mode:     ${plan.mode}`);
  lines.push(`count:    ${plan.count}`);
  lines.push("");
  for (const a of plan.agents) {
    lines.push(`agent[${a.index}]`);
    lines.push(`  session-id:   ${a.sessionId}`);
    lines.push(`  worktree:     ${a.worktreePath}`);
    lines.push(`  prompt-id:    ${a.prompt.id}`);
    lines.push(`  prompt-path:  ${a.prompt.path}`);
    lines.push(`  argv:         ${JSON.stringify(a.argv)}`);
    lines.push("");
  }
  return lines.join("\n");
}

export const swarmCommand = new Command("swarm")
  .description("Launch a parallel Claude Code agent swarm (dry-run by default in v1.1.0)")
  .option("--count <n>", "Number of agents (1..15)", "1")
  .option("--prompts <dir>", "Prompts directory (default: .agents/prompts)")
  .option("--mode <work|verify>", "work = edits; verify = read-only review", "work")
  .option("--max-turns <n>", "Max conversational turns per agent")
  .option("--max-budget-usd <n>", "Max USD spend per agent")
  .option(
    "--permission-mode <mode>",
    "plan | acceptEdits | bypassPermissions (requires --i-understand)"
  )
  .option(
    "--allowed-tools <list>",
    'Comma-separated Claude Code permission rules to auto-approve (replaces the default, e.g. "Read,Edit,Bash(git:*)")'
  )
  .option(
    "--disallowed-tools <list>",
    'Comma-separated Claude Code deny rules (replaces the default, e.g. "Bash(rm:*),WebFetch"). Not a sandbox.'
  )
  .option("--session-prefix <str>", "Swarm id prefix (default: swarm)")
  .option(
    "--i-understand",
    "Required to use --permission-mode bypassPermissions",
    false
  )
  .option("--dry-run", "Print plan + per-agent argv, do not spawn", false)
  .option(
    "--live",
    "Opt-in live spawn mode (v1.1.0 experimental; TUI is minimal)",
    false
  )
  .action(async (opts) => {
    try {
      const count = parseCount(opts.count);
      const mode = parseMode(opts.mode);
      const permissionMode = parsePermissionMode(opts.permissionMode);
      const allowedTools = parseList(opts.allowedTools);
      const disallowedTools = parseList(opts.disallowedTools);
      const maxTurns = parseMaxTurns(opts.maxTurns);
      const maxBudgetUsd = parseMaxBudgetUsd(opts.maxBudgetUsd);

      const promptsDir = opts.prompts
        ? path.resolve(opts.prompts)
        : path.join(process.cwd(), ".agents", "prompts");
      const prompts = discoverPrompts({ dir: promptsDir });

      const plan = buildSwarmPlan({
        count,
        mode,
        prompts,
        sessionPrefix: opts.sessionPrefix,
        permissionMode,
        iUnderstand: opts.iUnderstand === true,
        allowedTools,
        disallowedTools,
        maxTurns,
        maxBudgetUsd,
      });

      const rendered = renderPlan(plan);

      // --dry-run is the default-safe path. --live is required to actually
      // spawn. If neither flag is set we behave like --dry-run but also
      // emit a hint so users know how to go live.
      if (!opts.live) {
        console.log(rendered);
        if (!opts.dryRun) {
          console.log(
            theme.muted(
              "\n(dry-run default. Pass --live to spawn agents. --dry-run silences this hint.)"
            )
          );
        }
        return;
      }

      // Live path. v1.1.0 TUI is deliberately minimal — per-agent stdout is
      // streamed with a [agent-N] prefix. Full node-pty + neo-blessed TUI
      // is tracked for v1.1.x (see docs/SWARM.md).
      console.log(pc.bold(theme.brand("Launching swarm (live)...")));
      console.log(rendered);

      const handles: WorktreeHandle[] = [];
      for (const a of plan.agents) {
        const h = createWorktree(plan.id, a.index, {});
        handles.push(h);
      }

      // Spawn every agent, then supervise each until its stdio closes. An
      // agent only succeeds when it exits 0, its stdout is valid stream-json
      // and it ends with a successful `result` event (see agent-outcome.ts).
      const outcomes = await Promise.all(
        plan.agents.map((a) => {
          const tag = theme.brand(`[agent-${a.index}]`);
          let proc;
          try {
            proc = spawnClaudeAgent({
              argv: a.argv,
              cwd: a.worktreePath,
              promptFile: a.prompt.path,
            }).proc;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return Promise.resolve({ ok: false, reason: `spawn refused: ${msg}` });
          }
          proc.stderr?.on("data", (buf: Buffer) => {
            for (const line of buf.toString("utf8").split(/\r?\n/)) {
              if (line.length > 0) console.error(`${tag} ${theme.warning(line)}`);
            }
          });
          return superviseAgent(proc, (line) => console.log(`${tag} ${line}`));
        })
      );

      const failures: string[] = [];
      outcomes.forEach((o, i) => {
        if (o.ok) return;
        const tag = theme.brand(`[agent-${plan.agents[i].index}]`);
        const hint =
          o.reason && /ENOENT/.test(o.reason)
            ? " — is Claude Code installed and on PATH? (https://docs.claude.com/claude-code)"
            : "";
        console.error(`${tag} ${theme.warning(`failed: ${o.reason}${hint}`)}`);
        failures.push(`agent-${plan.agents[i].index}: ${o.reason}`);
      });

      if (failures.length > 0) {
        console.error(
          theme.warning(
            `\nSwarm ${plan.id} FAILED: ${failures.length} of ${plan.agents.length} agent(s) did not finish successfully. ` +
              `Worktrees and swarm/${plan.id}/* branches are kept under .claude/worktrees/${plan.id}/ for inspection.`
          )
        );
        process.exit(1);
      }

      console.log(
        theme.success(
          `\nSwarm ${plan.id} complete: ${plan.agents.length} agent(s) succeeded. Worktrees retained under .claude/worktrees/${plan.id}/ for inspection.`
        )
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // The parsers already prefix their messages with "swarm:".
      const line = msg.startsWith("swarm:") ? msg : `swarm: ${msg}`;
      console.error(theme.warning(line));
      process.exit(1);
    }
  });
