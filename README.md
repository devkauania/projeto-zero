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
- **`generate`** — materialises the config into a Claude Code native layout (`CLAUDE.md`, `.agents/<id>.md`, `skills/<id>/SKILL.md`, `.mcp/<connector>.json`)
- **`swarm`** — launches parallel Claude Code agents in isolated git worktrees, behind an anti-gaming safety envelope (`--i-understand` gate on `bypassPermissions`, env allowlist, argv-array spawn)
- **`info` / `reset`** — inspect and clear persisted config

Full user documentation: [`apps/cli/README.md`](apps/cli/README.md). Swarm safety defaults: [`docs/SWARM.md`](docs/SWARM.md).

## Layout

```
apps/cli/         # @projeto-zero/cli — the published package
docs/             # user-facing guides (SWARM, MIGRATION_1.0_to_1.1)
scripts/          # preflight, verdict, and static gate scripts
audit/            # security audit trail — vulnerability ledger + patch handoffs
.agents/          # Claude Code subagent definitions + session prompts
.github/          # CI + OIDC release workflows
```

## Engineering discipline

This repo is built under a mechanical gate system rather than LLM self-assessment:

- **preflight** — build + lint + test + seven static gates (manifest integrity, tarball sanity, metadata, unreplaced-token scan, self-dep guard, non-TTY connector default, single-family LLM lock)
- **verdict** — PRODUCTION-READY is a pure function of preflight; no "looks good to me"
- **session-gate** — anti-gaming tripwire: verification checkboxes must flip in human-authored commits (`git blame` vs `Co-Authored-By: Claude`)
- **audit/** — every closed vulnerability row has a patch handoff doc with reproduction and empirical evidence

See [`audit/vulnerability-ledger.md`](audit/vulnerability-ledger.md) for the ledger, [`audit/patches/`](audit/patches/) for the closeout docs, and [`CHANGELOG.md`](CHANGELOG.md) for the release history.

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
