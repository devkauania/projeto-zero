# `antigravity swarm` — Claude Code Agent Swarm Launcher

New in v1.1.0. Dispatches 1–15 parallel Claude Code agents against a shared
repo, each isolated inside a per-agent git worktree. Default mode is
**dry-run**: the CLI builds the full plan (argv, worktrees, prompt
assignments, budget limits) and prints it without spawning anything.
Pass `--live` to actually spawn.

---

## Quickstart

```bash
# Scaffold a project and drop some prompts into .agents/prompts/.
antigravity init

# Preview a 3-agent swarm run without spawning anything.
antigravity swarm --count 3

# Same thing, explicit:
antigravity swarm --count 3 --dry-run

# Spawn for real. Requires `claude --version` on PATH.
antigravity swarm --count 3 --live
```

Prompts live in `.agents/prompts/*.md`. The swarm reads every `.md` file
in that directory (sorted by filename), and round-robins them across your
`--count` agents. Frontmatter is stripped when selecting a first-line
summary for the plan output.

---

## Safety defaults (hardcoded, verified by tests)

Every spawned agent inherits the same safety envelope. These values come
from `apps/cli/src/lib/swarm/safety-envelope.ts` — a pure, tested function
that is the single source of truth. Changing a default requires editing
that file and updating the drift-guard tests.

Each agent runs `claude -p --verbose --output-format stream-json ...` in
non-interactive print mode. The prompt body is piped to the child's stdin and
the agent's worktree is the child's working directory (spawn `cwd`); neither
appears on argv. Every flag the envelope emits is checked by a contract test
against a recorded list of real Claude Code CLI flags
(`CLAUDE_CLI_FLAGS`, taken from the official CLI reference and
`claude --help`).

| Flag | Default | Why |
|---|---|---|
| `-p` / `--verbose` | always | Print (non-interactive) mode. `--output-format`, `--max-turns` and `--max-budget-usd` only work with `-p`, and `stream-json` under `-p` requires `--verbose`. |
| `--permission-mode` | `acceptEdits` (work) / `plan` (verify) | `bypassPermissions` requires both `--permission-mode bypassPermissions` AND `--i-understand` at the top-level CLI. Verify mode is always read-only. |
| `--allowed-tools` | `read_file,write_file,edit_file,bash(git:*),bash(npm:*)` | Tight allowlist. Verify mode collapses to `read_file,bash(git:diff*)`. |
| `--disallowed-tools` | `bash(rm:*),bash(curl:*),bash(wget:*),bash(ssh:*)` | Destructive and network-exfiltration shell commands. |
| `--max-turns` | `20` | Per-agent turn cap. |
| `--max-budget-usd` | `5.00` | Per-agent USD cap. |
| `--output-format` | `stream-json` | Machine-parseable. The live renderer streams each line with an `[agent-N]` prefix and also parses it to decide success (see below). The `--max-budget-usd` value is passed through to each child `claude` process; the launcher itself does not track spend. |
| working directory (spawn `cwd`) | `.claude/worktrees/<swarm-id>/agent-<n>` | Each agent starts in its own git worktree. This is a starting directory, not a sandbox: Claude Code can still be asked to touch paths outside it. |
| child env | Allowlist of 11 variables (`PATH`, `HOME`, `CLAUDE_CODE_OAUTH_TOKEN`, …) | `NPM_TOKEN`, `ANTHROPIC_API_KEY`, `GITHUB_TOKEN`, and every other parent env var are stripped before spawn. |

Claude Code has no `--temperature`, `--working-dir` or `--prompt-file`
flag. Releases up to 1.1.3 emitted all three (and no `-p`), so every live
agent died at argument parsing; they were removed, and `swarm --temperature`
no longer exists.

Prompt content is **never** placed on argv. It is read from the prompt
file and streamed to the child's stdin. A static test
(`apps/cli/src/__tests__/swarm-spawner.test.ts`) greps the spawner source
for `argv.join`, `exec(`, `execSync(`, and `shell: true`, failing the
build if any appear.

---

## Success and failure (live mode)

An agent counts as successful only if **all** of these hold:

1. the child exits with code 0 and was not killed by a signal;
2. every non-empty stdout line parses as JSON (stream-json);
3. a final `{"type":"result", ...}` event arrives; and
4. that event has `subtype: "success"` and `is_error` not `true`.

If any agent fails (including a spawn error such as `ENOENT`), the launcher
prints the reason per agent, prints `Swarm <id> FAILED: ...` and exits with
code 1. Only when every agent succeeds does it print `Swarm <id> complete`
and exit 0. Worktrees and `swarm/<id>/agent-<n>` branches are kept in both
cases.

---

## Per-agent isolation

Swarm startup creates one git worktree per agent under
`.claude/worktrees/<swarm-id>/agent-<n>`. Each agent is launched with
that path as its working directory. Worktrees are **kept after the run**
for forensic inspection; clean them up with:

```bash
# List current swarm worktrees
git worktree list | grep '\.claude/worktrees'

# Prune a specific one
git worktree remove --force .claude/worktrees/<swarm-id>/agent-<n>
```

Worktree and swarm names are validated against `^[a-zA-Z0-9_-]{1,32}$`
before any `git` shell-out — no path traversal, no metacharacters.

---

## Grid layout (v1.1.0 live mode)

v1.1.0 ships with a **minimal** live renderer: per-agent stdout is
streamed to the controlling terminal with a `[agent-N]` prefix. The full
`node-pty` + `neo-blessed` split-screen grid is tracked for v1.1.x. The
plan builder and safety envelope are identical between the minimal and
eventual full renderer, so upgrading is purely a UX win.

```
Planned grid (v1.1.x):
  1→1×1  |  2→1×2  |  3→1×3  |  4→2×2  |  5→2×3
  6→2×3  |  7-8→2×4  |  9→3×3  |  10→2×5  |  11-12→3×4  |  13-15→3×5
Each pane: agent id (corner), current prompt filename (top bar),
live stream-json body, status footer (running / awaiting / done /
error / over-budget). Global status bar: aggregate turns, aggregate
USD, elapsed.
```

---

## Verify mode (batch-2 review pass)

`--mode verify` spawns a read-only review agent. Permission mode is
forced to `plan`, the allowed-tools list collapses to
`read_file,bash(git:diff*)`, and the agent cannot write outside
`audit/swarm-<id>/`. Typical flow:

```bash
# 1. Work batch — three agents edit in their own worktrees.
antigravity swarm --count 3 --mode work --live

# 2. Review batch — three verifiers review each worktree's diff.
antigravity swarm --count 3 --mode verify --live
```

Output is collected to `audit/swarm-<id>/agent-<n>-review.md`.

---

## Adding prompt files

Prompts are plain markdown. Frontmatter (optional) is stripped when
picking a summary line:

```markdown
---
name: security-sweep
---
# Security sweep

Review the diff at <worktree> against HEAD. Flag any change that:
- introduces a new dependency
- changes a file under `.github/workflows/`
- adds a `bash(` call outside an existing allowlist
Output: markdown to stdout.
```

Drop the file in `.agents/prompts/` and it shows up in the next swarm run.

---

## `--i-understand` gate

`--permission-mode bypassPermissions` silently downgrades to
`acceptEdits` unless `--i-understand` is passed at the same invocation.
This is a deliberate anti-gaming tripwire: an LLM operator cannot enable
full bypass without the human operator's explicit consent in the shell
history. The safety-envelope test
(`swarm-safety-envelope.test.ts > refuses bypassPermissions unless
iUnderstand:true`) asserts this invariant; any change that breaks it
fails CI.

```bash
# This is downgraded to acceptEdits (no bypass).
antigravity swarm --count 1 --permission-mode bypassPermissions --live

# This actually passes bypassPermissions through.
antigravity swarm --count 1 --permission-mode bypassPermissions --i-understand --live
```

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `swarm: no prompts discovered` | `.agents/prompts/` is empty or missing. Run `antigravity init` first, or create `.md` files in that directory. |
| `swarm: invalid sessionId` | You overrode a session-prefix with non-`[a-zA-Z0-9_-]` characters. |
| `git worktree add failed` | A previous run's worktree wasn't cleaned up. `git worktree remove --force <path>` or `git worktree prune`. |
| Agent hangs without output | Confirm `claude --version` is on PATH and `CLAUDE_CODE_OAUTH_TOKEN` is set. Without the token the child exits silently. |
| `failed: spawn failed: spawn claude ENOENT` on Windows | The launcher spawns `claude` without a shell (no argv interpolation). An npm-installed Claude Code on Windows is only a `claude.cmd` shim, which cannot be spawned that way. Install the native Claude Code build so a real `claude.exe` is on PATH. |
| `failed: exited with code 1` | The child `claude` rejected its arguments or errored. Its stderr is shown with the `[agent-N]` prefix. |
| `failed: ... not stream-json` | The child printed something that is not stream-json on stdout, so the run cannot be trusted as a success. |

Full audit trail of swarm security controls:
[`audit/vulnerability-ledger.md`](../audit/vulnerability-ledger.md).
