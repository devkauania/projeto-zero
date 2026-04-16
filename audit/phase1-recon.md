# Phase 1 — Reconnaissance (v1.1.0 Security Audit)

**Purpose.** Per-file attack-surface analysis for `@projeto-zero/cli` and its
(new) swarm launcher. Populated in parallel with Stage 2 coding, revisited
after Stage 3 implementation.

**Plan reference:** `~/.claude/plans/fuzzy-conjuring-puppy.md` § Stage 4 Phase 1.

---

## Threat-model baseline

1. The CLI runs on user-trusted developer machines and CI runners. It has
   filesystem write authority inside `cwd` and reads configuration from
   `ANTIGRAVITY_CONFIG_DIR` / Conf defaults.
2. The upcoming swarm launcher spawns `claude` child processes with
   per-agent worktrees. Every spawned process inherits a restricted env
   and argv-array invocation (no shell string concat).
3. Primary adversary classes:
   - **Supply chain** — malicious dep, tampered tarball, registry hijack.
   - **Prompt-reachable** — template content reaching agents that can
     execute tools; untrusted input landing in file paths.
   - **Developer-environment** — leaked tokens, `ANTIGRAVITY_CONFIG_DIR`
     pointed at symlink, worldreadable Conf file.
4. Out-of-scope for this phase: Claude API-side controls (user's
   responsibility); Anthropic service availability.

---

## Per-file attack surface

| Path | Attack surface | Hunt for |
|---|---|---|
| `apps/cli/src/cli.ts` | argv → command dispatch | Unknown command → graceful error; help output cannot be used to leak env (tests in error-paths) |
| `apps/cli/src/commands/init.ts` | User input → filesystem writes; SIGINT handling; non-TTY stdin drain | Path traversal in projectName; argv injection; unvalidated prompts; non-TTY connector default (closed — patch 01) |
| `apps/cli/src/commands/generate.ts` | Config → template emit → disk | Template injection; overwrite races; path escape via `--dir` |
| `apps/cli/src/commands/info.ts` | Reads Conf + env | Env-echo leak; printing tokens that may live in Conf |
| `apps/cli/src/commands/reset.ts` | Destructive config clear | Accidental invocation; lack of confirmation under `--yes` flag |
| `apps/cli/src/lib/scaffolder.ts` | Template rendering → disk; hardcoded templates | Template-injection via user fields (projectName); overwrite races |
| `apps/cli/src/lib/config.ts` | Conf store, `ANTIGRAVITY_CONFIG_DIR` override | Symlink traversal, file-mode (0600 on POSIX), accidental secrets in store |
| `apps/cli/src/lib/connectors.ts` | MCP JSON → `.mcp/` | Payload validation; default-ALL bug (closed — patch 01); connector name path traversal |
| `apps/cli/src/lib/fs-utils.ts` | Shared fs primitives | Path normalization; symlink following vs `lstat`; ensureDir races |
| `apps/cli/src/lib/banner.ts` | Figlet render | Prototype pollution via figlet options (low) |
| `apps/cli/src/lib/theme.ts` | picocolors wrap | Harmless |
| `apps/cli/src/lib/swarm/agent-spawner.ts` (**new — Stage 3**) | Spawns `claude` | argv-array only; prompt via stdin/file, never argv; env allowlist; timeout/budget |
| `apps/cli/src/lib/swarm/pty-pool.ts` (**new — Stage 3**) | node-pty / ConPTY | Shell quoting; env-var filter (`NPM_TOKEN`, `ANTHROPIC_API_KEY` stripped); cwd confinement |
| `apps/cli/src/lib/swarm/worktree-manager.ts` (**new — Stage 3**) | `git worktree` shell-outs | Worktree name regex `^[a-zA-Z0-9_-]{1,32}$`; path inside repo |
| `apps/cli/src/lib/swarm/safety-envelope.ts` (**new — Stage 3**) | Default argv builder (SSOT) | Must never build `--permission-mode bypassPermissions` without `--i-understand`; unit-test tripwire |
| `apps/cli/src/lib/swarm/budget-meter.ts` (**new — Stage 3**) | Per-agent + aggregate USD/turn tracking | Integer overflow; accurate turn counting; guard against hook-report spoofing |
| `apps/cli/src/lib/swarm/tui-grid.ts` (**new — Stage 3**) | neo-blessed render | ANSI injection from agent stream-json output; control-char sanitization |
| `apps/cli/src/lib/swarm/prompt-browser.ts` (**new — Stage 3**) | `.agents/prompts/*.md` listing | Path escape; glob expansion; read perms |
| `scripts/*.mjs` | Dev scripts | `&&` interpolation; `shell:true` use (noted in preflight.mjs — acceptable for controlled argv, flagged otherwise) |
| `scripts/session-gate.mjs` | Enforces R15 + verification artifact | git-blame parsing; regex escape for shas; cannot be self-bypassed |
| `scripts/preflight.mjs` | Runs all gate checks | `shell:true` — safe since argv is controlled (static `CHECKS` array) |
| `.agents/` templates | Content reaches agents | Prompt-injection — templates must be hardcoded; snapshot-tested for drift in Stage 2 rewrite |
| `apps/cli/package.json` | Dep list | Self-dep (closed — patch 02); range pins; postinstall scripts (none today) |
| `apps/cli/package-lock.json` | Does not exist at apps/cli scope (monorepo uses root) | N/A locally; root `package-lock.json` must show `registry.npmjs.org` only — verified in Stage 0 |
| `package-lock.json` (root) | Monorepo lockfile | SHA-256 recorded in `audit/STAGE_0_SIGNOFF.md`; only `registry.npmjs.org` URLs |

---

## Exploitation-theory sketches

### 1. Non-TTY connector default-ALL (closed)
CI pipeline runs `echo "" | antigravity init --yes` expecting a minimal
scaffold. Bug wrote every MCP connector to `.mcp/`, silently enlarging the
attack surface (extra connector JSON files that may carry credentials the
user never intended). **Fixed in Stage 5 patch 01.** Guard:
`scripts/check-non-tty-connectors.mjs`.

### 2. Self-referential dep (closed, historical)
v1.0.0 tarball shipped with `@projeto-zero/cli` in its own `dependencies`.
Downstream `npm install` could trigger recursive resolution. Fixed at HEAD
(reverted in Stage 0). Guard: `scripts/check-no-self-dep.mjs`.

### 3. argv injection in swarm spawner (pending — Stage 3)
If swarm prompts were concatenated into a shell string, an attacker-controlled
prompt file containing `"$(rm -rf ~)"` would execute at spawn. Mitigation:
spawn with argv array, pass prompt via stdin or `--prompt-file`. Unit test
in Stage 3 greps `agent-spawner.ts` for forbidden `shell:true` / string
concat patterns.

### 4. Filesystem race across parallel agents (pending — Stage 3)
15 agents writing the same `package.json` in shared cwd = data loss. Mitigation:
per-agent git worktree (user-approved isolation strategy).

### 5. Prompt injection via templates (pending)
Scaffolded `.agents/<id>.md` files become agent input. If a future template
pulls content from a remote URL at scaffold time, attacker-controlled content
could carry jailbreak instructions. Mitigation: hardcode templates; snapshot
tests freeze the literal content; ADR forbids remote fetch without signing.
Reinforced by Stage 2 template rewrite (all literals).

### 6. Token leak via child-process env (pending — Stage 3)
A malicious MCP in the agent's config could read `NPM_TOKEN`,
`ANTHROPIC_API_KEY`, etc. from `process.env`. Mitigation: the swarm spawner
builds a minimal env allowlist: `PATH`, `HOME`/`USERPROFILE`,
`CLAUDE_CODE_OAUTH_TOKEN` only.

### 7. Config dir symlink traversal (pending)
`ANTIGRAVITY_CONFIG_DIR=/tmp/evil-symlink` where the symlink targets
`~/.ssh`. Mitigation: `lstat` the override path; reject symlinks and paths
that escape `$HOME` (configurable allowlist).

### 8. Leaked npm tokens (out-of-band)
Two tokens leaked in chat history on 2026-04-15. **User action required**
(Stage 0 §0.1) — revoke + generate granular token with Bypass-2FA scope.
Not a code-level fix. Tracked in `audit/STAGE_0_SIGNOFF.md` §0.1.

---

## Next checkpoints

- After Stage 2 lands: re-scan `apps/cli/src/lib/scaffolder.ts` for
  template literal drift (snapshot test should catch it).
- After Stage 3 lands: full re-recon of `apps/cli/src/lib/swarm/` subtree
  with updated ledger rows.
- Before v1.1.0 tag: one clean recon cycle with no new Critical/High
  findings (release rule).
