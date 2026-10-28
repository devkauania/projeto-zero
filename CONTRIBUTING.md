# Contributing

Thanks for taking the time to look at projeto-zero. Bug reports, docs fixes
and small, focused pull requests are all welcome.

By taking part you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).
Security problems go through [SECURITY.md](SECURITY.md), not public issues.

## Setup

Requirements: Node.js 20 or newer (CI runs Node 20 on Ubuntu and Windows)
and git. Claude Code is only needed if you want to try `swarm --live`.

```bash
git clone https://github.com/devkauania/projeto-zero.git
cd projeto-zero
npm ci
npm run build
npm test
```

Run the CLI from your checkout without installing it:

```bash
node apps/cli/dist/index.js --help
```

The CLI keeps its config in a per-user store. Point it at a throwaway
directory while you experiment so you do not touch your real one:

```bash
ANTIGRAVITY_CONFIG_DIR="$(mktemp -d)" node apps/cli/dist/index.js init
```

## Repository map

| Path | What lives there |
|---|---|
| `apps/cli/src/commands/` | One file per command (`init`, `generate`, `info`, `reset`, `swarm`). |
| `apps/cli/src/lib/` | Config store, scaffolder, and the swarm modules (`safety-envelope`, `agent-spawner`, `worktree-manager`, `agent-outcome`). |
| `apps/cli/src/__tests__/` | Vitest suites. Some spawn the built CLI, so build before testing. |
| `scripts/` | Release gates run by `preflight`, plus `record-demo.mjs`. |
| `docs/` | Architecture walkthrough, swarm safety defaults, release process. |
| `audit/` | Vulnerability ledger and patch write-ups. |

[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) explains the design
decisions with the relevant code inline. Read it before changing anything
under `lib/swarm/`.

## Before you open a pull request

Run the same gate CI runs:

```bash
node scripts/preflight.mjs
```

It builds, type-checks (`npm run lint` is `tsc --noEmit`), runs the tests
and then the static checks: package manifest and tarball contents, package
metadata, the leftover-token scan (`npm run scan:placeholders`), the
self-dependency guard, the non-TTY connector default, the Claude-only
wording guard and the workflow hardening check. A pull request is ready
when preflight ends with `preflight: ALL PASS`.

Also:

- **Fixes come with a test** that fails before the fix and passes after it.
- **Add a line to `CHANGELOG.md`** under `## [Unreleased]` for anything a
  user would notice.
- **Keep docs honest.** If the README or `docs/` describe behaviour you
  changed, update them in the same pull request. Do not add numbers or
  claims you have not measured.
- **Keep the safety envelope intact.** `swarm` must keep spawning with an
  argv array and `shell: false`, keep prompts off argv, keep the env
  allowlist, and keep `bypassPermissions` behind `--i-understand`. Tests
  enforce each of these; do not weaken them to make a change pass.
- If you change what `swarm --dry-run` or `init`/`generate` print, refresh
  the README demo with `npm run build && node scripts/record-demo.mjs`.

## Commit messages

Commits follow [Conventional Commits](https://www.conventionalcommits.org/):
`type(scope): summary`, for example `fix(swarm): ...`, `docs(cli): ...`,
`ci(release): ...`. Explain the why in the body. One logical change per
commit.

## Releases

Releases are cut by the maintainer by pushing a `v*.*.*` tag; the release
workflow publishes to npm with provenance. See
[`docs/RELEASING.md`](docs/RELEASING.md).
