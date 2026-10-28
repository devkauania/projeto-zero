# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Fixed
- `swarm --live` could never run an agent and still reported success. The
  safety envelope emitted `--temperature`, `--working-dir` and
  `--prompt-file`, which do not exist in Claude Code (the child exits 1 with
  "unknown option"), and it never passed `-p`. The argv is now
  `claude -p --verbose --output-format stream-json --permission-mode ...
  --allowed-tools ... --disallowed-tools ... --max-turns ... --max-budget-usd
  ... --session-id ...`; the prompt goes through stdin and the worktree is the
  spawn `cwd`. A contract test checks every emitted flag against a recorded
  list of real Claude Code flags.
- `swarm --live` no longer reports a false success. An agent now only counts
  as successful if it exits 0, its stdout is valid stream-json and it ends
  with a successful `result` event. Otherwise the run prints the reason per
  agent, says `FAILED` and exits 1 (previously only spawn errors counted).
- Swarm tool allow/deny lists used names Claude Code does not know
  (`read_file`, `write_file`, `edit_file`, lowercase `bash(rm:*)`, ...), so
  Claude Code ignored every rule and the rm/curl/wget/ssh deny-list never
  applied. Defaults are now real, case-sensitive Claude Code rules: allow
  `Read Write Edit Bash(git:*) Bash(npm:*)`; deny `Bash(rm:*) Bash(curl:*)
  Bash(wget:*) Bash(ssh:*) WebFetch WebSearch`; verify mode allows
  `Read Grep Glob Bash(git diff:*)`. User-supplied `--allowed-tools` /
  `--disallowed-tools` rules are validated and malformed ones are refused.
- `generate` could write outside the target directory. Connector ids from the
  saved config became file names (`.mcp/<id>.json`) unchecked, so an id such
  as `../../ESCAPED` wrote `ESCAPED.json` outside `-d` while still reporting
  success. Ids must now match `^[a-z0-9_-]{1,32}$` (all seed ids do);
  `loadConfig()` and `scaffoldProject()` both refuse anything else before
  writing, and the write itself is checked to stay inside `.mcp/`. `reset`
  can still clear a config that fails this check.

### Security
- `package-lock.json` refreshed with `npm audit fix` (no `--force`). Before:
  2 high advisories in the production tree (figlet < 1.11.3, fast-uri
  < 3.1.9) and 9 in the full tree (vite, vitest, turbo, postcss, nanoid,
  source-map-js). After: `npm audit` reports 0. Neither production advisory
  was reachable from the CLI, and npm consumers never receive this lockfile;
  this protects developer and CI machines that run `npm ci`.
- `release.yml` now runs `npm audit --omit=dev --audit-level=high` before
  publishing, so a release is blocked by a high/critical advisory in the
  shipped dependency tree. Dev-only advisories do not block.

### Removed
- `swarm --temperature`: Claude Code has no temperature flag, so the option
  never had any effect other than breaking `--live`.
- `apps/cli/src/lib/swarm/budget-meter.ts`: dead code. Only its own unit test
  imported it, and the swarm launcher never used it. Per-agent spend is still
  bounded by the `--max-budget-usd` flag passed to each child `claude` process.

### Docs
- `docs/SWARM.md` now says plainly that the tool lists are a speed bump, not
  a sandbox (Bash prefix rules are easy to get around; `Bash(npm:*)` runs
  arbitrary package scripts), and points to Claude Code's sandbox or a
  container for hard limits. Removed the claim that verify mode writes
  review files to `audit/swarm-<id>/`; the launcher never did that.
- README: describes exactly what `generate` writes and how it maps to Claude
  Code's discovery paths, adds a Security model section, and states that npm
  publish authenticates via the `NPM_TOKEN` secret (OIDC is used only for
  provenance).

## [1.1.3] - 2026-04-17

Re-release of v1.1.2 content. The v1.1.2 tag passed `npm ci`, preflight,
build, test, and provenance signing, but the final `npm publish` PUT
returned 404 because Trusted Publisher was never configured on npmjs.com
for this scope (deferred from v1.1.0 release — ledger row 10). Setting
up Trusted Publisher via the npm web UI requires the account 2FA
security key, which is not available.

Fallback: the `Release` workflow's publish step now authenticates via
`NPM_TOKEN` repo secret (granular access token with bypass-2FA + scope
write). Provenance attestation is retained — the OIDC identity for
provenance is independent of npm auth.

### Fixed
- `.github/workflows/release.yml`: publish step now sets `NODE_AUTH_TOKEN`
  from `secrets.NPM_TOKEN` so auth does not depend on the npm Trusted
  Publisher binding that could not be configured due to the 2FA security
  key blocker.

### Notes
- Trusted Publisher remains the preferred long-term auth method — when
  the security key availability is resolved, the `env: NODE_AUTH_TOKEN`
  block can be deleted and the workflow will fall back to OIDC with no
  other changes.
- v1.1.1 and v1.1.2 tags remain in the repo as markers of the two
  failed publish attempts (ENOENT on stale lockfile, and the 404 above).
  Neither was ever on npm, so no back-compat promise was made.

## [1.1.2] - 2026-04-16

Re-release of the v1.1.1 content. The v1.1.1 tag was pushed but the OIDC
publish workflow failed at `npm ci` because the root `package-lock.json`
still referenced a pre-publish self-dep `file:projeto-zero-cli-0.1.0.tgz`
(a tarball that had been deleted from the repo tree). Lockfile regenerated
from a clean `npm install`, resolving 112 packages with integrity hashes.
No product-logic changes on top of the v1.1.1 intended content below.

### Fixed
- `package-lock.json`: regenerated to remove stale `file:projeto-zero-cli-0.1.0.tgz`
  self-dep reference that caused CI `npm ci` to ENOENT on the v1.1.1 tag.
- Workspace version in lockfile now tracks `apps/cli/package.json` (1.1.2).

## [1.1.1] - 2026-04-16 (unreleased - CI failed, superseded by 1.1.2)

Post-release E2E polish pass. Docs-and-copy patch surfaced by a fresh
`npx -y @projeto-zero/cli@1.1.0 init/generate/swarm` sandbox run on Windows
PowerShell 5.x. No product-logic changes, no public API changes.

### Changed
- Wizard copy: the `includeTemplates` prompt now reads "Include Claude Code
  subagent + skill template files?" (was "Generate .agents/ prompt templates?",
  which misleadingly suggested it would populate `.agents/prompts/*.md` when it
  actually controls whether `.agents/<id>.md` and `skills/<id>/SKILL.md` are
  written).
- `apps/cli/README.md` invocation examples now lead with
  `npx -y @projeto-zero/cli <cmd>` as the primary form. The `antigravity`
  binary is still shipped (back-compat) and documented as an alias available
  after a global install.
- `apps/cli/README.md` example trace corrected to "Created 6 artifacts" for the
  two-agent (`coder` + `auditor`) + templates-enabled flow (formula: `2 + 2N`).
  Prior README said 4, which did not match the shipped `generate` output.
- `scaffoldProject` renders `CLAUDE.md` with ASCII hyphens instead of em-dashes
  so the file displays correctly under Windows PowerShell 5.x's default
  Windows-1252 decoder (the file was always valid UTF-8; this is a render-time
  compatibility fix for the most common Windows shell).

### Notes
- `ANTIGRAVITY_CONFIG_DIR` env var name retained for back-compat with existing
  CI pipelines. Renaming is tracked as a breaking change for a future major.
- `.agents/*.md` and `skills/*/SKILL.md` template contents still contain
  em-dashes; a fresh `Get-Content` on those in PowerShell 5.x will show the
  same mojibake. Scope-limited to `CLAUDE.md` for v1.1.1 — full ASCII sweep
  deferred.

## [1.1.0] — 2026-04-16

### Added
- `antigravity swarm` command — parallel Claude Code agent launcher (1–15 agents)
  with per-agent git worktree isolation (`.claude/worktrees/<swarm-id>/agent-<n>`)
- Swarm safety envelope (`apps/cli/src/lib/swarm/safety-envelope.ts`) — single
  source of truth for child-process argv; `--permission-mode bypassPermissions`
  is gated by `--i-understand` (verified by unit test)
- Swarm supporting libs: `agent-spawner.ts` (argv-array spawn, 11-entry env
  allowlist), `worktree-manager.ts` (regex-validated names),
  `prompt-browser.ts`, `budget-meter.ts`
- `docs/SWARM.md` — swarm quickstart, safety defaults, `--i-understand` gate
- `docs/MIGRATION_1.0_to_1.1.md` — migration guide from v1.0.x scaffolds
- `scripts/check-no-multi-llm.mjs` — CI guard enforcing the Claude-only lock
  across live product surface
- `scripts/check-no-self-dep.mjs` — CI guard preventing self-referential deps
- `scripts/check-non-tty-connectors.mjs` — static tripwire on non-TTY default
- `apps/cli/VERIFICATION.md` + `session-gate` hook — anti-gaming check
  requiring human-authored `[x]` flips (via `git blame` vs `Co-Authored-By: Claude`)
- `audit/phase1-recon.md`, `audit/vulnerability-ledger.md`, `audit/patches/01-05`
- Config dir hardening: `ANTIGRAVITY_CONFIG_DIR` symlink rejection and
  `$HOME`/`$TMPDIR` scope confinement (vulnerability-ledger row 8)
- Conf data file `chmod 0600` on POSIX (vulnerability-ledger row 11)

### Changed
- **Breaking (template shape):** scaffolder now emits Claude Code native
  layout — `CLAUDE.md` at root, `.agents/<id>.md` subagents with YAML
  frontmatter, `skills/<id>/SKILL.md` skills, `.mcp/<connector>.json`.
  v1.0.x `src/` starter and `.claude/settings.project.json` no longer emitted.
  Migration: see `docs/MIGRATION_1.0_to_1.1.md`.
- Agent identifiers renamed: `ClaudeCoder` → `coder`, `AntigravityDesigner` →
  `designer`, `AntigravityAuditor` → `auditor`, `MCPConfigurator` → `mcp`.
- Package description → "CLI scaffolder and swarm launcher for Claude Code
  agent workspaces"; added keywords `claude-code`, `anthropic`, `mcp`, `subagent`.
- `init` non-TTY path: connectors list is now a concrete `string[]` in both
  branches (fixes v1.0.0 bug where `echo "" | antigravity init --yes` wrote
  every connector to `.mcp/`).
- `scripts/audit-tarball.mjs` converted from `execSync(templateLiteral)` to
  argv-array `spawnSync` (vulnerability-ledger row 9).
- `ScaffoldDefaults` narrowed to `{ targetDir }` — dead fields
  `scaffoldAgentsDir` / `scaffoldPromptsDir` removed.

### Fixed
- v1.0.0 self-dependency in `apps/cli/package.json` (CI guard now enforces).
- v1.0.0 README artifact count mismatch (already patched in 8816c59).
- `info`, `generate`, and `reset` now surface a friendly one-line error
  (no stack trace) when `ANTIGRAVITY_CONFIG_DIR` is set to a path outside
  `$HOME` or `$TMPDIR`. The scope-confinement throw (ledger row 8) was
  already correct; this completes the UX side. Caught in Phase 2 E2E
  recon (`audit/phase2-e2e-v1.1.0.md`); see `audit/patches/06`.
- `swarm --live` now wires a `'error'` listener on each spawned agent,
  so a missing `claude` binary (ENOENT) produces a friendly per-agent
  message with an install-hint URL and a non-zero exit — instead of
  hanging the Promise.all while Node printed an unhandled-error warning.
  Empirically verified by `swarm-spawner.test.ts` (ENOENT shape) and
  documented in `audit/patches/07-swarm-enoent-handler.md`.

### Security
- Vulnerability ledger rows 4, 5, 6, 7, 8, 9, 11, 12 all closed with patch
  handoff docs in `audit/patches/`. Rows 3 (leaked tokens — user action)
  and 10 (provenance — requires OIDC wiring at publish) remain open.

## [1.0.0] — 2026-04-14

### Added
- First public release on npm as `@projeto-zero/cli`
- Vendor policy configuration (`.agents/vendor-policy.json`) — project declares `single-family` (Claude) with mandatory Adversarial Checklist on every review session
- Policy-aware R11 and R17(c) in `_production-contract.txt`
- Milestone C routing updated to Claude Opus 4.6 under single-family policy

### Changed
- Rules R11, R12, R17(c) reformulated as policy-aware (see `_production-contract.txt`)
- Adversarial Checklist (taxonomy §4) promoted from "mitigation for same-family EXCEPTION" to "primary anti-gaming defense under single-family policy"
- Session 17 blockers moved from `.agents/` root to `.agents/handoffs/` (resolves MF-1 placeholder-scan)

### Validated
- Sessions 15 + 16 consolidated validation via Milestone B — verdict GO post-remediation
- 48/48 tests passing, preflight ALL PASS, cross-platform E2E (Windows PowerShell, cmd.exe, Linux Docker node:20) verified

## [0.1.0] — 2026-04-12

### Added
- Interactive CLI wizard with 4 commands: `init`, `generate`, `info`, `reset`
- Agent selection: ClaudeCoder, AntigravityDesigner, AntigravityAuditor, MCPConfigurator
- MCP connector registry: Supabase, Vercel, Stripe, Figma, Netlify
- Configuration persistence via `conf` package with `ANTIGRAVITY_CONFIG_DIR` override
- ASCII art banner via `figlet` with `picocolors` semantic theme
- Graceful SIGINT handling (exits 0 with no stack trace)
- Non-TTY stdin support for CI/automated pipelines
- Error path handling: EACCES on scaffold, read-only config dir recovery
- Cross-platform filesystem operations via `path.join()` throughout
- Mechanical gate scripts: preflight, verdict, session-gate, files-exist, pack-sanity, repo-metadata-check, placeholder-scan
