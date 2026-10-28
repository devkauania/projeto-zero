# Projeto Zero

[![CI](https://github.com/devkauania/projeto-zero/actions/workflows/ci.yml/badge.svg)](https://github.com/devkauania/projeto-zero/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@projeto-zero/cli.svg)](https://www.npmjs.com/package/@projeto-zero/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Scaffolder and swarm launcher for [Claude Code](https://docs.claude.com/claude-code) agent workspaces. Ships as `@projeto-zero/cli` on npm.

> **Code reviewers, start here:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — a guided tour of the interesting engineering decisions with code embedded inline (argv-array spawn, env allowlist, anti-gaming `--i-understand` gate, worktree path containment, config-dir hardening, mechanical gates).

```bash
npx @projeto-zero/cli init
```

## What it does

- **`init`** — interactive wizard that writes a project config (agents, MCP connectors, prompt templates)
- **`generate`** — materialises the config into a workspace scaffold: `CLAUDE.md`, `.agents/<id>.md` (subagent definitions with `name`/`description`/`tools` frontmatter), `.agents/prompts/.gitkeep`, `skills/<id>/SKILL.md`, and one `.mcp/<connector>.json` descriptor per selected connector (`id`, `label`, `description`, `tools`). See [What `generate` writes](#what-generate-writes) for how this maps to Claude Code's own discovery paths.
- **`swarm`** — launches parallel Claude Code agents in isolated git worktrees, behind an anti-gaming safety envelope (`--i-understand` gate on `bypassPermissions`, env allowlist, argv-array spawn)
- **`info` / `reset`** — inspect and clear persisted config

Full user documentation: [`apps/cli/README.md`](apps/cli/README.md). Swarm safety defaults: [`docs/SWARM.md`](docs/SWARM.md).

## What `generate` writes

The file shapes come from `apps/cli/src/lib/scaffolder.ts`. They are **not** the paths Claude Code discovers automatically:

| Written by `generate` | Claude Code's project-level discovery path |
|---|---|
| `CLAUDE.md` | `CLAUDE.md` (same) |
| `.agents/<id>.md` | `.claude/agents/<id>.md` |
| `skills/<id>/SKILL.md` | `.claude/skills/<id>/SKILL.md` |
| `.mcp/<connector>.json` (`id`, `label`, `description`, `tools`) | root `.mcp.json` with `{"mcpServers": {...}}`, each entry carrying `command`/`args` (stdio) or `type`/`url` (remote) |

The subagent and skill files already use the frontmatter Claude Code reads (`name`, `description`, plus `tools` for subagents), so copying them into `.claude/agents/` and `.claude/skills/` is enough to use them. The `.mcp/*.json` files describe which connector you picked. They contain no launch command or URL, so they can't be turned into `.mcp.json` entries automatically. Add servers with `claude mcp add --scope project`.

## Layout

```
apps/cli/         # @projeto-zero/cli — the published package
docs/             # user-facing guides (SWARM, MIGRATION_1.0_to_1.1)
scripts/          # preflight, verdict, and static gate scripts
audit/            # security audit trail — vulnerability ledger + patch handoffs
.agents/          # Claude Code subagent definitions + session prompts
.github/          # CI (ci.yml) + tag-triggered npm release (release.yml)
```

## Engineering discipline

This repo is built under a mechanical gate system rather than LLM self-assessment:

- **preflight** — build + lint + test + seven static gates (manifest integrity, tarball sanity, metadata, unreplaced-token scan, self-dep guard, non-TTY connector default, single-family LLM lock)
- **verdict** — PRODUCTION-READY is a pure function of preflight; no "looks good to me"
- **session-gate** — anti-gaming tripwire: verification checkboxes must flip in human-authored commits (`git blame` vs `Co-Authored-By: Claude`)
- **audit/** — every closed vulnerability row has a patch handoff doc with reproduction and empirical evidence

See [`audit/vulnerability-ledger.md`](audit/vulnerability-ledger.md) for the ledger, [`audit/patches/`](audit/patches/) for the closeout docs, and [`CHANGELOG.md`](CHANGELOG.md) for the release history.

## Security model

- **Swarm child processes**: one argv array, `shell: false`, prompt piped through stdin, and an 11-variable env allowlist (`apps/cli/src/lib/swarm/agent-spawner.ts`). `bypassPermissions` needs `--i-understand` (`safety-envelope.ts`). Each agent runs in its own git worktree, and worktree names are checked against a regex (`worktree-manager.ts`).
- **Config store**: `ANTIGRAVITY_CONFIG_DIR` must sit under home or tmp and can't be a symlink. On POSIX the file is `chmod 0600` (`apps/cli/src/lib/config.ts`).
- **Release**: `.github/workflows/release.yml` runs on `v*.*.*` tags. It runs preflight, checks that the tag matches `apps/cli/package.json`, then runs `npm publish --provenance`. npm authenticates with the `NPM_TOKEN` repository secret (`NODE_AUTH_TOKEN`). GitHub Actions OIDC (`id-token: write`) only signs the provenance attestation, not the publish itself (no npm Trusted Publisher). Release 1.1.3 has a SLSA provenance attestation on the npm registry. 1.1.0 was published without one.
- **Open items**: [`audit/vulnerability-ledger.md`](audit/vulnerability-ledger.md) lists every finding and its status, including the ones still open. For a code walkthrough of these controls, see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Local development

```bash
npm ci
npm run build
npm test
node scripts/preflight.mjs   # run all gates
node scripts/verdict.mjs     # PRODUCTION-READY check
```

## License

MIT — see [`LICENSE`](LICENSE).

## Repository layout

| Path | What it is |
|---|---|
| `apps/cli/` | The published CLI (`@projeto-zero/cli`) and its tests. |
| `scripts/` | Release gates run in CI (`preflight`, `verdict`, leftover-text and dependency checks). |
| `docs/` | Architecture, swarm safety defaults, migration notes. |
| `audit/` | Security process: vulnerability ledger, patches, and dated recon reports. |
| `.agents/` | Agent definitions and prompts used by the CLI, **plus the build history** of this project: session handoffs and validations from building it with AI coding agents. Kept on purpose as an audit trail of how the tool was made and verified. |
