# Phase 1 Recon — v1.1.0 Clean Cycle

**Date:** 2026-04-16
**Plan:** private planning doc `fuzzy-conjuring-puppy.md` (not in repo) § Stage 6 "final recon cycle"
**Purpose:** Re-run the Stage 4 Phase 1 attack-surface analysis on the code
that will ship as `@projeto-zero/cli@1.1.0`. Gate per rule 7 of Phase 3:
the v1.1.0 tag is only cut after one clean recon cycle — no new Critical
or High findings beyond those already tracked in the ledger.

---

## Scope (same surface as `audit/phase1-recon.md`, updated for HEAD)

| Path | Attack surface | Status at v1.1.0 HEAD |
|---|---|---|
| `apps/cli/src/commands/init.ts` | User prompt → filesystem writes | Non-TTY asymmetry fixed (ledger row 2). Static tripwire (`check-non-tty-connectors.mjs`) enforces the shape. |
| `apps/cli/src/commands/generate.ts` | Config → disk | Unchanged. Verified row 8 README artifact count matches. |
| `apps/cli/src/commands/info.ts` | Reads Conf; prints summary | Dead fields (`scaffoldAgentsDir` / `scaffoldPromptsDir`) removed. |
| `apps/cli/src/commands/reset.ts` | Clears Conf | Unchanged. |
| `apps/cli/src/commands/swarm.ts` | **NEW.** Parses argv, plans spawns | Uses `buildSwarmPlan()` + `buildClaudeArgv()` — argv-array only. `--i-understand` gates `bypassPermissions`. Dry-run is default-safe. |
| `apps/cli/src/lib/scaffolder.ts` | Template literals → disk | Hardcoded templates; drift-guard tests lock frontmatter key shape. No user input flows into template bodies. |
| `apps/cli/src/lib/config.ts` | Conf store + `ANTIGRAVITY_CONFIG_DIR` | Symlink rejection + `$HOME`/`$TMPDIR` scope confinement + POSIX 0600 chmod. Ledger rows 8, 11 closed. |
| `apps/cli/src/lib/swarm/safety-envelope.ts` | **NEW.** Single source of truth for child argv | Pure function. Verify mode forces read-only. bypass-permissions gate is tested. |
| `apps/cli/src/lib/swarm/agent-spawner.ts` | **NEW.** `spawn()` of `claude` | `shell: false`; prompt body via stdin; env filtered to 11-entry allowlist. Static tests grep for `shell: true`, `argv.join`, `exec(`, `execSync(`. |
| `apps/cli/src/lib/swarm/worktree-manager.ts` | **NEW.** `git worktree` shell-outs | Name regex `^[a-zA-Z0-9_-]{1,32}$`; paths confined to `.claude/worktrees/<swarm-id>/agent-<n>` under repo root. `shell: false` on all git invocations. |
| `apps/cli/src/lib/swarm/prompt-browser.ts` | **NEW.** Reads `.md` from `.agents/prompts/` | Read-only directory walk; no globbing outside the target dir; frontmatter stripped safely. |
| `apps/cli/src/lib/swarm/budget-meter.ts` | **NEW.** Pure data / accounting | Rejects negative USD deltas, duplicate registrations, unknown agent ids. |
| `scripts/*.mjs` | Dev harness | `audit-tarball.mjs` converted to argv-array. Other `shell: true` sites use argv arrays — safe (table in patch 05). |
| `.agents/**` | Repo's internal planning material | Not shipped (package `files` = `["dist", "README.md"]`). Excluded from `check-no-multi-llm.mjs` by design. |
| `apps/cli/package.json` | Dep list / metadata | No self-dep. Description aligned with Claude-only scope. Keywords updated. |
| `apps/cli/package-lock.json` | Lockfile | Registry-only (`registry.npmjs.org`). |

---

## Mechanical gates — all PASS at HEAD (`a500dfd`)

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

Test total: **95 passing** across 12 files. No skips. Duration ~3.5 s.

Tarball: **39.9 kB / 72 files** — well under the 2 MB plan budget.

---

## Ledger status at v1.1.0

| # | Severity | Status | Evidence |
|---|---|---|---|
| 1 | High     | CLOSED | patch 02 + `check-no-self-dep.mjs` |
| 2 | High     | CLOSED | patch 01 + `check-non-tty-connectors.mjs` |
| 3 | Critical | OPEN (user action) | token revoke + Granular+BypassMFA policy |
| 4 | Critical | CLOSED | Stage 3 `safety-envelope.ts` + spawner grep tests |
| 5 | High     | CLOSED | Stage 3 worktree isolation |
| 6 | Medium   | CLOSED | Stage 2b drift-guard tests |
| 7 | High     | CLOSED | Stage 3 `CHILD_ENV_ALLOWLIST` + test |
| 8 | Medium   | CLOSED | patch 03 |
| 9 | Medium   | CLOSED | patch 05 + audit table |
| 10 | Medium  | OPEN (at-publish) | requires `npm publish --provenance` from GitHub Actions OIDC |
| 11 | Low     | CLOSED | patch 04 |
| 12 | Low     | CLOSED | `check-no-multi-llm.mjs` guard |

**Open rows:** 3 (user action — no code to ship) and 10 (CI-only — engaged
at publish-time in the GitHub Actions workflow, not in the tarball). Per
Phase 3 rule 7 these two do not block the clean-recon verdict — they are
operational gates at the release boundary, not code defects.

---

## New findings in this recon cycle

**None** in the Critical/High band. One observation tracked informally for
v1.1.x (below the Low bar that the ledger admits):

- `apps/cli/src/lib/swarm/agent-spawner.ts` synchronously reads the full
  prompt file into memory before streaming to stdin. This is fine for the
  current prompt size envelope (≤10 KB), but a future prompt-generator that
  emits large bodies would benefit from `createReadStream().pipe(stdin)`.
  No current exploitation theory — logged for UX rather than security.

---

## Recon verdict

**CLEAN.** One recon cycle completed with no new Critical or High findings.
Per Phase 3 rule 7, v1.1.0 is cleared for tag pending the two OPEN
operational items (row 3 user action, row 10 at-publish CI wiring).

Signed: `scripts/verdict.mjs` → PRODUCTION-READY at HEAD `a500dfd`.
