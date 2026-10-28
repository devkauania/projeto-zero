// safety-envelope.ts — single source of truth for the argv passed to every
// spawned `claude` agent in a swarm run. Centralizing this here is the
// anti-gaming tripwire: every spawn in the codebase goes through
// `buildClaudeArgv()`, and `buildClaudeArgv()` refuses to emit
// `--permission-mode bypassPermissions` unless the operator opted in via
// `--i-understand` at the top-level CLI. A unit test asserts this invariant.
//
// Threat model (ledger row 4 — argv injection in swarm spawner):
//   - Prompt content is NEVER placed on argv. The spawner streams the prompt
//     file's body to the child's stdin (`claude -p` reads the prompt from
//     stdin when no positional prompt is given).
//   - The agent's working directory is the spawn `cwd`, not a flag.
//
// Every flag emitted here must exist in the real Claude Code CLI. The list of
// flags we rely on is recorded in CLAUDE_CLI_FLAGS below and checked by
// swarm-safety-envelope.test.ts. Reference (verified 2026-10-28 against
// https://code.claude.com/docs/en/cli-reference and `claude --help` of
// Claude Code 2.1.310): `-p/--print`, `--verbose`, `--output-format`,
// `--permission-mode`, `--allowed-tools`, `--disallowed-tools`,
// `--max-turns`, `--max-budget-usd`, `--session-id`. Claude Code has NO
// `--temperature`, `--working-dir` or `--prompt-file` flag; passing any of
// them makes the CLI exit 1 with "unknown option".
//   - The returned argv is an array. Callers MUST pass it directly to
//     `child_process.spawn(cmd, argv, { shell: false })`. Callers MUST NOT
//     concatenate argv into a shell string.
//   - A separate test in swarm.spawner.test.ts greps `agent-spawner.ts` for
//     `.join(` on the argv variable and fails if present.

export type PermissionMode = "plan" | "acceptEdits" | "bypassPermissions";
export type SwarmMode = "work" | "verify";

/**
 * Inputs to the argv builder. Every field is validated — callers cannot
 * bypass defaults by passing `undefined`; they must either omit the field
 * (and get the safe default) or pass a concrete value.
 */
export interface SafetyEnvelopeInput {
  /** UUID the spawner passes via --session-id. Must match /^[a-f0-9-]{8,64}$/i. */
  sessionId: string;

  /** Absolute path to the per-agent git worktree. Spawner sets cwd to this path. */
  workingDir: string;

  /**
   * Path to the prompt file. NOT placed on argv: the spawner streams its body
   * to the child's stdin. Kept here so the plan records which prompt an agent
   * gets.
   */
  promptFile: string;

  /** work = acceptEdits; verify = plan (read-only). */
  mode: SwarmMode;

  /**
   * Only respected when `iUnderstand: true` AND mode=work. Otherwise forced
   * to `acceptEdits` (work) or `plan` (verify).
   */
  permissionMode?: PermissionMode;

  /** Gate flag for permissionMode=bypassPermissions. Default: false. */
  iUnderstand?: boolean;

  /** Tool allowlist override. Empty array = use safe default. */
  allowedTools?: string[];

  /** Tool denylist override. Empty array = use safe default. */
  disallowedTools?: string[];

  /** Max conversational turns per agent. Default: 20. */
  maxTurns?: number;

  /** Max USD spend per agent. Default: 5.00. */
  maxBudgetUsd?: number;
}

export interface BuiltEnvelope {
  /** Argv array to pass to child_process.spawn. First element is NOT the binary. */
  argv: string[];
  /** Resolved, effective values — what will actually be enforced at runtime. */
  effective: {
    permissionMode: PermissionMode;
    allowedTools: string[];
    disallowedTools: string[];
    maxTurns: number;
    maxBudgetUsd: number;
    mode: SwarmMode;
  };
}

/** Hardcoded safe defaults. Exported for tests to diff against. */
export const DEFAULT_ALLOWED_TOOLS = Object.freeze([
  "read_file",
  "write_file",
  "edit_file",
  "bash(git:*)",
  "bash(npm:*)",
]);

export const DEFAULT_DISALLOWED_TOOLS = Object.freeze([
  "bash(rm:*)",
  "bash(curl:*)",
  "bash(wget:*)",
  "bash(ssh:*)",
]);

export const DEFAULT_MAX_TURNS = 20;
export const DEFAULT_MAX_BUDGET_USD = 5.0;

/**
 * Long flags of the real Claude Code CLI that this envelope is allowed to
 * emit. `--max-turns` is documented in the CLI reference (print mode only)
 * even though `claude --help` does not list it. Exported for the contract
 * test; extend it only after checking the official CLI reference.
 */
export const CLAUDE_CLI_FLAGS = Object.freeze([
  "-p",
  "--print",
  "--verbose",
  "--output-format",
  "--permission-mode",
  "--allowed-tools",
  "--disallowed-tools",
  "--max-turns",
  "--max-budget-usd",
  "--session-id",
]);

/** Verify mode is strictly read-only regardless of what the caller asked for. */
const VERIFY_ALLOWED_TOOLS = Object.freeze(["read_file", "bash(git:diff*)"]);

const SESSION_ID_RE = /^[a-f0-9-]{8,64}$/i;

/**
 * Build the canonical argv for a Claude Code agent spawn. Pure function.
 * No filesystem access, no process.env reads — deterministic from inputs.
 */
export function buildClaudeArgv(input: SafetyEnvelopeInput): BuiltEnvelope {
  if (!SESSION_ID_RE.test(input.sessionId)) {
    throw new Error(
      `safety-envelope: invalid sessionId "${input.sessionId}" (must match ${SESSION_ID_RE})`
    );
  }
  if (!input.workingDir || typeof input.workingDir !== "string") {
    throw new Error("safety-envelope: workingDir is required");
  }
  if (!input.promptFile || typeof input.promptFile !== "string") {
    throw new Error("safety-envelope: promptFile is required");
  }
  if (input.mode !== "work" && input.mode !== "verify") {
    throw new Error(`safety-envelope: invalid mode "${input.mode}"`);
  }

  // Resolve permission mode. Verify mode is always `plan`. Work mode defaults
  // to `acceptEdits` and only escalates to `bypassPermissions` if BOTH the
  // explicit flag AND the iUnderstand gate are set.
  let permissionMode: PermissionMode;
  if (input.mode === "verify") {
    permissionMode = "plan";
  } else if (
    input.permissionMode === "bypassPermissions" &&
    input.iUnderstand === true
  ) {
    permissionMode = "bypassPermissions";
  } else if (input.permissionMode === "plan") {
    permissionMode = "plan";
  } else {
    permissionMode = "acceptEdits";
  }

  // Tool lists. Verify mode forces the read-only list regardless of caller.
  const allowedTools =
    input.mode === "verify"
      ? [...VERIFY_ALLOWED_TOOLS]
      : input.allowedTools && input.allowedTools.length > 0
        ? [...input.allowedTools]
        : [...DEFAULT_ALLOWED_TOOLS];

  const disallowedTools =
    input.disallowedTools && input.disallowedTools.length > 0
      ? [...input.disallowedTools]
      : [...DEFAULT_DISALLOWED_TOOLS];

  const maxTurns =
    typeof input.maxTurns === "number" && input.maxTurns > 0
      ? input.maxTurns
      : DEFAULT_MAX_TURNS;

  const maxBudgetUsd =
    typeof input.maxBudgetUsd === "number" && input.maxBudgetUsd > 0
      ? input.maxBudgetUsd
      : DEFAULT_MAX_BUDGET_USD;

  // Argv construction. Arrays only. Prompt body is NEVER on argv — the
  // spawner pipes it to stdin, and the worktree is the spawn cwd.
  // `-p` (print / non-interactive) is required: --output-format,
  // --max-turns and --max-budget-usd only work with it, and stream-json
  // output under -p requires --verbose. Each tool rule is its own argv
  // element (the CLI's --allowed-tools/--disallowed-tools take a variadic
  // list), so a rule containing a space such as `Bash(git diff:*)` is never
  // split.
  const argv: string[] = [
    "-p",
    "--verbose",
    "--output-format",
    "stream-json",
    "--permission-mode",
    permissionMode,
    "--allowed-tools",
    ...allowedTools,
    "--disallowed-tools",
    ...disallowedTools,
    "--max-turns",
    String(maxTurns),
    "--max-budget-usd",
    maxBudgetUsd.toFixed(2),
    "--session-id",
    input.sessionId,
  ];

  return {
    argv,
    effective: {
      permissionMode,
      allowedTools,
      disallowedTools,
      maxTurns,
      maxBudgetUsd,
      mode: input.mode,
    },
  };
}

/**
 * Sanity assertion for external callers and dry-run output. Returns the
 * offending flag if the argv contains a forbidden shape, `null` otherwise.
 * Used by the CLI to double-check envelopes before spawning.
 */
export function auditArgv(argv: readonly string[]): string | null {
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (tok === "--permission-mode" && argv[i + 1] === "bypassPermissions") {
      // By the time we get here, buildClaudeArgv already enforced the
      // iUnderstand gate — so seeing this pair in `auditArgv` means the
      // caller went through the gate. Still, we surface it for logging.
      return "permissionMode=bypassPermissions (gated by --i-understand)";
    }
    // Shell-metacharacter heuristic on each argv token. Real shells are not
    // invoked (spawn({shell:false}) is required), but a surprise
    // interpolation upstream would still be visible here.
    if (typeof tok === "string" && /[`$]|(\|\|)|&&|;(?!$)/.test(tok)) {
      return `suspicious shell metacharacter in argv[${i}]: "${tok}"`;
    }
  }
  return null;
}
