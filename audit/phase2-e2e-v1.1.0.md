# Phase 2 E2E Recon — v1.1.0 End-User Install Validation

**Date:** 2026-04-16
**Trigger:** User directive post-verdict — "Make sure every bit of the
program is working for any user that installs the application.
Everything needs to follow the strict rules system you are built on,
everything needs to be tested and also safe."
**Purpose:** Simulate a real end-user install from the packed tarball,
exercise every CLI command end-to-end, verify security-critical paths
under realistic conditions (not only unit-test mocks).

This is complementary to `audit/phase1-recon-v1.1.0.md`. Phase 1 is a
static code-surface review; Phase 2 is dynamic install-and-run.

---

## Method

1. `npm pack` on `apps/cli` → `projeto-zero-cli-1.1.0.tgz` (40 kB).
2. Fresh temp directory → `npm init -y` → `npm install <tarball>`.
3. Invoke CLI via the installed `dist/index.js` (not the monorepo source).
4. For each command: capture stdout, stderr, exit code. Inspect
   generated filesystem artifacts. Verify env-var overrides.

No mocks; no vitest harness; real child processes talking to real `conf`
storage on real disk.

---

## Commands exercised

| Command | Scenario | Result |
|---|---|---|
| `--version` | Print version | PASS — prints `1.1.0` |
| `--help` | Root help | PASS — lists init/generate/info/reset/swarm |
| `init --help` | Subcommand help | PASS |
| `generate --help` | Subcommand help | PASS — shows `-d, --dir <path>` |
| `swarm --help` | Subcommand help | PASS — shows all 13 flags incl. `--i-understand` |
| `info` (pre-init) | No config present | PASS — "No setup configuration found" hint |
| `init` (non-TTY, 3 lines piped) | `printf 'proj\ncoder designer auditor mcp\ny\n'` | PASS — config saved; ledger row 2 verified: `mcpConnectors: (none)` not "all" |
| `info` (post-init) | Renders saved config | PASS — all fields printed correctly |
| `generate` (target `.`) | Scaffolds 10 artifacts | PASS — CLAUDE.md + 4 subagents + 4 skills + `.agents/prompts/.gitkeep` |
| `swarm --dry-run --count 3` (work mode) | 3-agent plan, round-robin prompts | PASS — argv-array includes `--permission-mode acceptEdits` |
| `swarm --dry-run --count 2 --mode verify` | Verify mode downgrades to plan | PASS — argv-array includes `--permission-mode plan`, allowed-tools shrunk to `read_file,bash(git:diff*)` |
| `swarm --dry-run --permission-mode bypassPermissions` (NO `--i-understand`) | Anti-gaming gate | **PASS — silently downgrades to acceptEdits** (ledger row 4 verified) |
| `swarm --dry-run --permission-mode bypassPermissions --i-understand` | Explicit opt-in | PASS — argv carries bypassPermissions verbatim |
| `reset` (non-TTY) | TTY-only guard | PASS — "Reset requires an interactive terminal" + no destructive action |

### Scaffolded artifact shape

All 8 Markdown artifacts have the correct YAML frontmatter:

- `.agents/<id>.md` → `name` + `description` + `tools`
- `skills/<id>/SKILL.md` → `name` + `description`

This is the Claude Code native layout contracted in the scaffolder's
drift-guard tests (`scaffolder.test.ts` → "template drift guard" suite).
Not shipped in this run: `.mcp/<connector>.json` — because the
non-TTY init path intentionally provisions zero connectors (ledger row
2 fix). A TTY install with the `mcp` agent selected would add
`.mcp/supabase.json`, etc.

---

## Findings

One defect surfaced that did not reach Phase 1 static recon:

### Finding E2E-1 — `info` / `generate` / `reset` surfaced raw Node stack trace on config-dir scope reject

**Severity:** Low (UX only — security already correct).
**Component:** `apps/cli/src/commands/{info,generate,reset}.ts`.

When `ANTIGRAVITY_CONFIG_DIR` was set to a path outside `$HOME` /
`$TMPDIR` (e.g. `C:\ProgramData\something`), the hardened
`validateConfigDir()` correctly threw, but the three read-side
commands propagated the throw as a raw Node crash:

```
file:///.../lib/config.js:61
        throw new Error(`ANTIGRAVITY_CONFIG_DIR: ...
              ^
Error: ANTIGRAVITY_CONFIG_DIR: "..." is outside the allowed scope...
    at validateConfigDir (file:///.../lib/config.js:61:15)
    at getStore (...)
    at loadConfig (...)
    ...
Node.js v24.14.0
```

`init` already handled this gracefully through its existing
`try { saveConfig(...) }` wrapper, so the defect was limited to the
read-side commands.

**Fix (patch 06):** wrap `loadConfig()` in each of the three read-side
commands with a try/catch that mirrors the init pattern, printing the
error message via the command's log surface and exiting 1 with no
stack frames.

**Regression test:** `config-dir-errors.test.ts` spawns the built CLI
with an out-of-scope env var set and asserts exit 1 + stack-trace
absence across `info` and `generate`.

---

## Mechanical gates — all PASS post-fix

```
$ node scripts/verdict.mjs
...
preflight summary
  build                PASS
  lint                 PASS
  test                 PASS
  files-exist          PASS
  pack-sanity          PASS
  repo-metadata        PASS
  placeholder-scan     PASS
  check-no-self-dep    PASS
  check-non-tty-connec PASS
  check-no-multi-llm   PASS
PRODUCTION-READY
```

Test total after patch 06: **97 passing** across 13 files (was 95/12).
Tarball: **40.0 kB / 72 files** (no file count change; size delta from
inline try/catch in 3 files).

---

## Phase 2 recon verdict

**CLEAN** after patch 06. One Low-severity UX finding surfaced by the
dynamic install-and-run test, fixed with a regression test and a
patch handoff doc. Security-critical behavior was already correct —
this was presentation only.

All v1.1.0 in-repo gates remain green. Remaining OPEN items are the
same two operational gates from Phase 1:

- Row 3 — user token revoke (credentials; no code to ship)
- Row 10 — `npm publish --provenance` via GitHub Actions OIDC
  (engaged at publish, not in the tarball)

Signed: `scripts/verdict.mjs` → PRODUCTION-READY at HEAD post-patch-06.
