# Changelog

All notable changes to this project will be documented in this file.

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
