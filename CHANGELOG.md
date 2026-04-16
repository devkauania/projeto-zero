# Changelog

All notable changes to this project will be documented in this file.

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
