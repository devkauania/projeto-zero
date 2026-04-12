# Changelog

All notable changes to this project will be documented in this file.

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
