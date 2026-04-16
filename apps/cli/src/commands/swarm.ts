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
  temperature?: number;
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
    temperature,
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
      temperature,
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
  .option("--allowed-tools <list>", "Comma-separated tool allowlist")
  .option("--disallowed-tools <list>", "Comma-separated tool denylist")
  .option("--temperature <n>", "Sampling temperature (0..2)")
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
      const maxTurns = opts.maxTurns ? Number(opts.maxTurns) : undefined;
      const maxBudgetUsd = opts.maxBudgetUsd
        ? Number(opts.maxBudgetUsd)
        : undefined;
      const temperature = opts.temperature
        ? Number(opts.temperature)
        : undefined;

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
        temperature,
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

      const processes = plan.agents.map((a) => {
        const s = spawnClaudeAgent({
          argv: a.argv,
          cwd: a.worktreePath,
          promptFile: a.prompt.path,
        });
        const tag = theme.brand(`[agent-${a.index}]`);
        s.proc.stdout?.on("data", (buf: Buffer) => {
          for (const line of buf.toString("utf8").split(/\r?\n/)) {
            if (line.length > 0) console.log(`${tag} ${line}`);
          }
        });
        s.proc.stderr?.on("data", (buf: Buffer) => {
          for (const line of buf.toString("utf8").split(/\r?\n/)) {
            if (line.length > 0) console.error(`${tag} ${theme.warning(line)}`);
          }
        });
        return s;
      });

      // Wait for each agent's terminal event — whichever of "exit" or
      // "error" fires first. Without the "error" branch, a missing
      // `claude` binary (ENOENT on spawn) would leave Promise.all
      // hanging forever while Node printed an unhandled-error warning.
      // ledger row 4 envelope is still intact either way — the binary
      // never runs — but the UX must be a friendly exit, not a hang.
      const failures: string[] = [];
      await Promise.all(
        plan.agents.map(
          (a, i) =>
            new Promise<void>((resolve) => {
              const s = processes[i];
              const tag = theme.brand(`[agent-${a.index}]`);
              let settled = false;
              const done = () => {
                if (settled) return;
                settled = true;
                resolve();
              };
              s.proc.on("exit", done);
              s.proc.on("error", (err: Error) => {
                const hint =
                  /ENOENT/.test(err.message) && /claude/i.test(err.message)
                    ? ` — is Claude Code installed and on PATH? (https://docs.claude.com/claude-code)`
                    : "";
                console.error(
                  `${tag} ${theme.warning(`spawn failed: ${err.message}${hint}`)}`
                );
                failures.push(`agent-${a.index}: ${err.message}`);
                done();
              });
            })
        )
      );
      if (failures.length > 0) {
        console.error(
          theme.warning(
            `\nSwarm ${plan.id} finished with ${failures.length} spawn failure(s).`
          )
        );
        process.exit(1);
      }

      console.log(
        theme.success(
          `\nSwarm ${plan.id} complete. Worktrees retained under .claude/worktrees/${plan.id}/ for inspection.`
        )
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(theme.warning(`swarm: ${msg}`));
      process.exit(1);
    }
  });
