# `@projeto-zero/cli` v1.1.0 — End-to-End Verification Plan

**Purpose.** Before Projeto-Zero's orchestrator cedes authority to any
scaffolded workspace, every externally observable behavior of
`@projeto-zero/cli` must be exercised by a human operator. This artifact is
the mechanical evidence that verification happened.

**Scope.** Repo-only artifact. Not packed for npm publish (the
`apps/cli/package.json` `files` allowlist contains only `dist` and
`README.md`).

---

## How to use this file

1. Work through the rows top-to-bottom. For each row, run the **Invocation**
   and compare what you observe against **Expected observable**.
2. Flip the row's boxes:
   - `[x]` in **Feels right?** if the observed behavior matches — *and you
     commit that flip in a commit authored by you with no `Co-Authored-By:
     Claude` trailer*. The session-gate enforces this by `git blame` (anti-
     gaming tripwire — an LLM cannot self-certify its own verification).
   - `[!]` in **Bug?** if you found a defect. You **must** add an issue
     reference or URL in **Notes** on the same row, otherwise the gate fails.
3. Rows marked `[ ]` on both columns are unverified. The gate does not fail
   on unverified rows (you may be partway through a session), but a v1.1.0
   tag requires all rows to be `[x]` or `[!]` (with linked issue).

## Legend

| Mark | Meaning |
|---|---|
| `[ ]` | not yet verified |
| `[x]` | verified by user in a non-LLM commit |
| `[!]` | bug found — Notes must link an issue |
| `BLOCKED` in Notes | feature not yet implemented; defer row |

---

## Rows

| # | Feature | Invocation | Expected observable | Source | Feels right? | Bug? | Notes |
|---|---|---|---|---|---|---|---|
| 1 | Banner + version | `antigravity --version` | Prints `1.1.0` | `apps/cli/src/cli.ts` | `[ ]` | `[ ]` |  |
| 2 | Help text | `antigravity --help` | Lists `init\|generate\|info\|reset\|swarm` | `apps/cli/src/cli.ts` | `[ ]` | `[ ]` |  |
| 3 | `init` TTY happy path | `antigravity init` in empty dir; complete the prompts | Creates `.agents/`, `skills/`, `CLAUDE.md`, `.mcp/` | `apps/cli/src/commands/init.ts` | `[ ]` | `[ ]` |  |
| 4 | `init` non-TTY defaults | `echo "" \| antigravity init --yes` | `.mcp/` is empty unless `mcp` in agents (fixed in Stage 5 — patch 01) | `apps/cli/src/commands/init.ts:~183` | `[ ]` | `[ ]` | Regression guard: `scripts/check-non-tty-connectors.mjs` |
| 5 | `init` agent selection (TTY) | Select only `coder` + `auditor` | Only those templates written to `.agents/` / `skills/` | `apps/cli/src/commands/init.ts:~215` | `[ ]` | `[ ]` |  |
| 6 | `init` SIGINT handling | Start `antigravity init`; hit Ctrl-C mid-prompt | Clean exit 0, no partial files | `apps/cli/src/commands/init.ts:17` (SIGINT trap) | `[ ]` | `[ ]` |  |
| 7 | `init` idempotency | Run `init` twice in same dir | Second run prompts before overwrite | `apps/cli/src/commands/init.ts` | `[ ]` | `[ ]` |  |
| 8 | `generate` happy path | `antigravity generate coder` after `init` | 4 artifacts written (confirmed commit `8816c59`) | `apps/cli/src/commands/generate.ts:57` | `[ ]` | `[ ]` |  |
| 9 | `info` | `antigravity info` | Prints Conf store path + current settings | `apps/cli/src/commands/info.ts` | `[ ]` | `[ ]` |  |
| 10 | `reset` | `antigravity reset --yes` | Clears Conf; scaffolded files on disk preserved | `apps/cli/src/commands/reset.ts` | `[ ]` | `[ ]` |  |
| 11 | Config persistence | `init` → close shell → new shell → `info` | Persisted agent list matches what was selected | `apps/cli/src/lib/config.ts` | `[ ]` | `[ ]` |  |
| 12 | `ANTIGRAVITY_CONFIG_DIR` override | Set env var → `info` | `info` shows override path | `apps/cli/src/lib/config.ts` | `[ ]` | `[ ]` |  |
| 13 | Connector filter | TTY `init` → select only `github` | Only `.mcp/github.json` written | `apps/cli/src/lib/connectors.ts` | `[ ]` | `[ ]` |  |
| 14 | **Known bug**: self-dep | `npm ls @projeto-zero/cli` in fresh `npm i @projeto-zero/cli@1.0.0` install | v1.0.0 shows recursive dep; v1.1.0 does not | `apps/cli/package.json` | `[ ]` | `[ ]` | Fixed in Stage 5 — patch 02; guard: `scripts/check-no-self-dep.mjs` |
| 15 | **Known bug**: non-TTY connector default | `printf "x\ncoder\ny\n" \| node apps/cli/dist/index.js init` | `.mcp/` must be absent/empty | `apps/cli/src/commands/init.ts:~183` (source; `dist/commands/init.js:164` in v1.0.0 build) | `[ ]` | `[ ]` | Fixed in Stage 5 — patch 01 |
| 16 | `swarm --dry-run` | `antigravity swarm --dry-run --count 3 --prompts test/fixtures/prompts/*.md` | Prints argv per agent, no spawns | `apps/cli/src/commands/swarm.ts` (new) | `[ ]` | `[ ]` | BLOCKED BY STAGE 3 |
| 17 | `swarm --count 2` E2E | 2 fixture prompts; requires `CLAUDE_CODE_OAUTH_TOKEN` | Two worktrees created under `.claude/worktrees/`; both get file changes | `apps/cli/src/lib/swarm/*` | `[ ]` | `[ ]` | BLOCKED BY STAGE 3 |
| 18 | `swarm --mode verify` | As row 17 with `--mode verify` | No writes outside `audit/swarm-<id>/` | same | `[ ]` | `[ ]` | BLOCKED BY STAGE 3 |
| 19 | Windows PS 5.1 smoke | Run rows 1-13 on PowerShell 5.1 | All pass | Stage 5 row 3 | `[ ]` | `[ ]` | Evidence → `audit/cross-platform-1.1.0.md` |
| 20 | Windows PS 7+ smoke | Run rows 1-13 on PowerShell 7.4 | All pass | Stage 5 row 3 | `[ ]` | `[ ]` | Evidence → `audit/cross-platform-1.1.0.md` |
| 21 | Linux bash smoke | Run rows 1-13 on Linux bash | All pass | Stage 5 row 3 | `[ ]` | `[ ]` | Evidence → `audit/cross-platform-1.1.0.md` |

---

## Gate integration

`scripts/session-gate.mjs` includes a `verification-artifact` check that:

1. **Passes** when this file does not exist (pre-Stage-1 state) or when all
   rows are unverified.
2. **Fails** when any row is marked `[!]` in **Bug?** with no issue reference
   (`#\d+` or URL) in **Notes**.
3. **Fails** when any `[x]` in **Feels right?** was introduced by a commit
   whose message contains `Co-Authored-By: Claude`. Anti-gaming tripwire —
   only the human operator can legitimately flip this box.

Run locally with: `node scripts/session-gate.mjs`.

---

## Release gate (v1.1.0)

The v1.1.0 tag is only issued when:

- No row has `[ ]` in both **Feels right?** *and* **Bug?** columns (i.e., every
  row has been exercised), **AND**
- No row is `[!]` without a linked issue that has been closed, **AND**
- `scripts/session-gate.mjs` exits 0 on HEAD.
