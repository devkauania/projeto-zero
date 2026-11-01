# `@projeto-zero/cli` 1.1.x: manual verification checklist

**What this is.** A checklist a person can work through to try the CLI by hand
before a release. It records human judgement ("does this feel right?"), which
the automated suite cannot.

**What this is not.** A control. Nothing enforces it: CI does not read this file
and releases are not gated on it. Versions up to 1.1.3 shipped with every row
unverified. What actually gates a release is `scripts/preflight.mjs`, which CI
and `release.yml` both run.

Most rows also have automated coverage, named in **Covered by**. A row with
*manual only* has none.

Not packed for npm: the `files` list in `apps/cli/package.json` contains only
`dist` and `README.md`.

---

## How to use this file

Run each **Invocation** and compare with **Expected**, then flip the row:

- `[x]` in **Feels right?** if it matches. Commit that yourself, with no
  `Co-Authored-By: Claude` trailer. `npm run gate` (`scripts/session-gate.mjs`,
  local only) fails on an `[x]` from a co-authored commit, so an LLM cannot tick
  its own work.
- `[!]` in **Bug?** if you found a defect, with an issue reference or URL in
  **Notes**. The same local gate fails on a `[!]` without one.

`[ ]` on both means not tried yet.

---

## Rows

Run these with `ANTIGRAVITY_CONFIG_DIR` pointing at a throwaway folder unless the
row is about the real store.

| # | Feature | Invocation | Expected | Covered by | Feels right? | Bug? | Notes |
|---|---|---|---|---|---|---|---|
| 1 | Version | `projeto-zero --version` | Prints the version in `apps/cli/package.json` | `scripts/pack-smoke.mjs` | `[ ]` | `[ ]` |  |
| 2 | Both commands | `antigravity --version` | Same version | `scripts/pack-smoke.mjs` | `[ ]` | `[ ]` |  |
| 3 | Help | `projeto-zero --help` | Lists `init`, `generate`, `info`, `reset`, `swarm` | `scripts/pack-smoke.mjs` | `[ ]` | `[ ]` |  |
| 4 | `init` in a terminal | `projeto-zero init`, answer the prompts | Saves the config. Writes no project files | `interactive.test.ts` | `[ ]` | `[ ]` |  |
| 5 | `init` agent selection | Select `coder` and `mcp`, then two connectors | `info` shows exactly those | `interactive.test.ts` | `[ ]` | `[ ]` |  |
| 6 | `init` Ctrl-C | Press Ctrl-C at any prompt | Exit 0, nothing saved, no stack trace | `interactive.test.ts` | `[ ]` | `[ ]` |  |
| 7 | `init` from stdin | `printf 'demo\ncoder auditor\ny\n' \| projeto-zero init` | Exit 0; no connectors saved | `init-non-tty.test.ts` | `[ ]` | `[ ]` |  |
| 8 | `init` incomplete stdin | `printf 'demo\n' \| projeto-zero init` | Exit 1, says 3 lines were expected, nothing saved | `init-non-tty.test.ts` | `[ ]` | `[ ]` |  |
| 9 | `generate` | `projeto-zero generate -d out` after `init` | Writes `CLAUDE.md`, `.agents/`, `skills/` into `out` | `generate-existing.test.ts` | `[ ]` | `[ ]` |  |
| 10 | `generate` keeps your files | Edit `out/CLAUDE.md`, run row 9 again | Your edit stays; output lists it as skipped | `generate-existing.test.ts` | `[ ]` | `[ ]` |  |
| 11 | `generate --force` | Add `--force` to row 10 | `CLAUDE.md` is replaced | `generate-existing.test.ts` | `[ ]` | `[ ]` |  |
| 12 | `generate` with no config | `generate -d out` with an empty store | Exit 1, says to run `init` | `generate-command.test.ts` | `[ ]` | `[ ]` |  |
| 13 | Generated files in Claude Code | Copy into `.claude/` as the README describes, open Claude Code | Subagents and skills are picked up | *manual only* | `[ ]` | `[ ]` |  |
| 14 | `info` | `projeto-zero info` | Prints the saved settings | `info-command.test.ts` | `[ ]` | `[ ]` |  |
| 15 | `reset` | `projeto-zero reset`, answer Yes | Config cleared; scaffolded files stay | `interactive.test.ts` | `[ ]` | `[ ]` |  |
| 16 | `reset` default | `projeto-zero reset`, press Enter | Config kept | `interactive.test.ts` | `[ ]` | `[ ]` |  |
| 17 | Damaged store | Write `{bad` to `config.json`, run `info`, then `reset` | `info` exits 1 and names the file; `reset` clears it | `config-store.test.ts`, `interactive.test.ts` | `[ ]` | `[ ]` |  |
| 18 | `swarm` dry run | `projeto-zero swarm --count 2` with two prompts | Prints two agents and their argv; nothing spawned | `swarm-live.test.ts` | `[ ]` | `[ ]` |  |
| 19 | `swarm --live` with real Claude Code | Two small prompts, signed in to Claude Code | Two worktrees under `.claude/worktrees/`, each with its own changes; exit 0 | *manual only*: tests use a fake `claude` | `[ ]` | `[ ]` |  |
| 20 | `swarm --live` limits on real Claude Code | `--max-turns 1` on a prompt that needs more | Run reports the agent failed, exit 1 | *manual only* | `[ ]` | `[ ]` |  |
| 21 | `swarm --mode verify` on real Claude Code | `--mode verify --live` | The agent changes no file | *manual only*: plan mode is Claude Code's behaviour | `[ ]` | `[ ]` |  |
| 22 | npm-installed Claude Code on Windows | `--live` with only `claude.cmd` on PATH | The agent starts, with no shell in between | `swarm-windows-launch.test.ts` drives a fake in that shape; run it once with the real one | `[ ]` | `[ ]` |  |
