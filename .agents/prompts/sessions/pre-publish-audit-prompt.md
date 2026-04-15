# Pre-Publish Audit — @projeto-zero/cli v1.0.0

**Agent identity:** `@PrePublishAuditor` (independent, adversarial)
**Model:** Claude Opus 4.6 (under `.agents/vendor-policy.json` — `policy: single-family`, `adversarialChecklistMandatory: true`)
**Tier:** High (final gate before irreversible npm publish)
**Deliverable:** `.agents/validations/pre-publish-audit-validation.md`
**Verdict rule:** you do NOT type "GO" or "NO-GO" by hand. The string must
be copy-pasted from `node scripts/verdict.mjs` output at the end of the
session. Typing it yourself is a mechanical contract violation (R14).

---

## Why this session exists

The previous chat prepared `@projeto-zero/cli@1.0.0` for publication to
npm: bumped the version, added LICENSE, refactored the CLI `--version`
to read from `package.json` (SSOT), wrote a changelog entry, tagged
`v1.0.0`. That agent also audited its own work and declared "ready to
publish."

Under the single-family vendor policy, same-family review is NOT an
exception — it is the declared operating mode, and the Adversarial
Checklist is the PRIMARY anti-gaming defense, replacing cross-family
separation. You are that defense. Your job is to independently prove
the package is safe, stable, and production-grade **before** the real
`npm publish` happens. Once published, v1.0.0 is effectively permanent
(npm's 72-hour unpublish window is discouraged in practice).

You are read-only on all project files **except** your own deliverable
at `.agents/validations/pre-publish-audit-validation.md`. You must NOT
run `npm publish` — even the dry-run was already executed and the
human explicitly holds that authority.

---

## 0. Environment sanity (run first, paste output verbatim)

Confirm you are in the right repo and on the right commit:

```
git rev-parse --abbrev-ref HEAD
git log --oneline -6
git tag --list v1.0.0 -n1
git status --short
node --version
npm --version
```

If `git status --short` is non-empty, STOP and report — the tree must
be clean before auditing. If HEAD does not contain a commit tagged
`v1.0.0`, STOP and report.

---

## 1. Required reading (read these files fully, in this order)

Before doing any verification, actually read these files. Do not rely
on filename inference. For each, paste a one-line summary of what it
actually says, to prove you read it:

1. `.agents/vendor-policy.json` — declares the operating policy for
   this project (single-family Claude).
2. `.agents/prompts/_production-contract.txt` — the R1–R17 contract
   you are bound by. Pay special attention to R9 (execute, never
   confirm), R10 (self-grading table), R14 (mechanical verdict), R15
   (gate before handoff), R16 (look for friends, not just enemies).
3. `.agents/antigravity-taxonomy.md` — §0 (vendor policy), §3 (model
   routing), §4 (R11 Compliance Matrix + Adversarial Checklist items).
4. `.agents/PROJECT_ROADMAP.md` — what sessions have run and what
   state they left the project in. Note: Session 17 (Publisher) is
   still `[ ]` because publish has not happened yet.
5. `apps/cli/README.md` — user-facing install & usage docs.
6. `CHANGELOG.md` — release notes.
7. `apps/cli/package.json` — ALL fields matter (name, version, bin,
   files, repository, license, publishConfig).
8. `.agents/handoffs/session-17-blockers.md` — halt record from
   the previous chat documenting any outstanding questions.

Your summary of each file is your proof-of-reading. Do not skip this
step. A summary that just restates the filename is not a summary.

---

## 2. Mission — every claim must be backed by literal command output

You are verifying four orthogonal axes:

### A. Safety — nothing catastrophic ships

- A1. Extract the published tarball bytes and list every shipped
  file. Command: `cd apps/cli && npm pack --silent` then extract the
  `.tgz` with tar, then walk the extracted `package/` directory.
  Alternatively run `node scripts/audit-tarball.mjs` from repo root
  (this script was added in the last commit and does exactly this).
  Paste the full file list with sizes.
- A2. Confirm `LICENSE` is in the shipped tarball (not just at repo
  root). If absent, that is a blocker.
- A3. Confirm NO secrets / credentials / tokens ship. Scan shipped
  files for `sk-ant-`, `ghp_`, `ghs_`, `npm_`, `Bearer `, `api_key`,
  `secret:`, `password:`, `.env`, `localhost:`, `example.com`. Paste
  scan output. Any hit in a shipped file is a blocker.
- A4. Confirm `bin.antigravity` actually survives in the **published**
  package.json (extract tarball, read `package/package.json`, confirm
  `bin.antigravity` exists and points at `./dist/index.js`). The
  dry-run prints a warning `"bin[antigravity]" script name ... was
  invalid and removed` — you must prove this is a cosmetic false
  alarm by showing the literal bin entry in the tarball's
  package.json.
- A5. Confirm `dist/index.js` has the `#!/usr/bin/env node` shebang so
  `antigravity` actually works after global install.
- A6. Confirm `publishConfig.access === "public"` in the tarball's
  package.json, so `npm publish` defaults to public (required —
  scoped packages default to private, and the `@projeto-zero` org is
  free-tier which disallows private packages).
- A7. Confirm `repository.url` points at a real reachable URL. It is
  fine if the URL normalizes to `git+https://...` in the registry;
  what matters is that the base `github.com/devkauania/projeto-zero`
  resolves.

### B. Stability — the code actually works

- B1. Run `npm install` from the repo root in a **clean** state
  (e.g. `rm -rf node_modules apps/cli/node_modules` first). Paste
  the last ~20 lines. Any install failure is a blocker.
- B2. Run `npm run preflight`. Paste the summary block. Must print
  `preflight: ALL PASS`. Any FAIL is a blocker.
- B3. Run `cd apps/cli && npm test`. Paste the vitest summary.
  Must show `Test Files 8 passed (8)` and `Tests 48 passed (48)`.
  Any failure is a blocker.
- B4. Run `cd apps/cli && node dist/index.js --version`. Must print
  `1.0.0`. Compare to `node -p "require('./package.json').version"`.
  They MUST match — if they do not, it means the hardcoded-version
  regression is back, which is a blocker.
- B5. Run `cd apps/cli && node dist/index.js --help`. Confirm all
  four commands (`init`, `generate`, `info`, `reset`) are listed.
- B6. Run `cd apps/cli && node dist/index.js info`. In an empty-state
  environment it must print a friendly "no configuration found"
  message and exit 0 (not throw). Use
  `ANTIGRAVITY_CONFIG_DIR=<fresh-tmpdir>` to guarantee empty state.
- B7. Seed a configuration via the programmatic path (do NOT try to
  drive the interactive prompts from a non-TTY shell — use the
  helper or the saveConfig lib). Then run `info` again and confirm
  the output reflects the seeded config. Then run
  `generate -d ./out-test-dir` and walk the generated tree. Then
  run `reset` and confirm `info` returns to empty.

### C. Correctness — what's claimed matches reality

- C1. Version consistency. Three locations declare a version. They
  must all match. Grep each and paste the line:
  - `apps/cli/package.json` → `"version": "1.0.0"`
  - `apps/cli/src/lib/banner.ts` or `dist/lib/banner.js` runtime
    output → `v1.0.0`
  - CLI `--version` flag → `1.0.0`
  - `CHANGELOG.md` → `## [1.0.0]` header present
- C2. Spec-by-spec diff. For every business requirement in
  `project-specs.md`, paste one line showing the requirement and
  the file path + line range of the code / test that satisfies it.
  Missing row = blocker.
- C3. Adversarial Checklist (§4 of taxonomy), all 5 items, executed
  against THIS session's work (not a narrative). See §6 below.
- C4. Cross-platform claims. The CHANGELOG and Session 15 report
  claim E2E was verified on Windows PowerShell, cmd.exe, and Linux
  node:20 Docker. You do NOT need to re-run all three platforms,
  but you MUST open `.agents/handoffs/cross-platform-report.md` (or the
  equivalent) and confirm each platform has literal command output
  attributed to it — not just a narrative "works on Linux".
- C5. Governance alignment. Confirm:
  - `.agents/vendor-policy.json` exists and declares
    `policy: single-family` + `adversarialChecklistMandatory: true`.
  - Production contract rules R11, R12, R17(c) are policy-aware
    (contain both `cross-family` and `single-family` branches).
  - `.agents/handoffs/session-17-blockers.md` exists in the
    `handoffs/` subdirectory (NOT at `.agents/` root), resolving
    the placeholder-scan self-trip (MF-1).

### D. Experience — the user journey makes sense

This is the axis the prior agent explicitly asked you to weight: the
user's first 10 minutes with the package.

- D1. README clarity. Simulate a first-time user reading `apps/cli/README.md`
  top-to-bottom. Report:
  - Can they install without asking questions? Quote the install
    instruction.
  - Do they know what `init` does vs `generate` vs `info` vs `reset`?
    Quote one line each.
  - Is the example trace plausible? If you actually ran the commands,
    does output structurally match the example?
  - Is `ANTIGRAVITY_CONFIG_DIR` documented with a concrete example?
  - Are troubleshooting entries addressing likely real problems
    (state mismatch, permissions, empty config), not straw-man
    issues?
- D2. Error messages. For the three most likely failure modes
  (`generate` with no prior `init`, `generate -d` with a read-only
  target, `init` with a corrupted config store), the CLI must:
  - Exit with non-zero code
  - Print a user-readable message (no stack trace dump)
  - Not leave the terminal in a broken state
  Exercise at least one of these with a real command and paste
  output. Do not fabricate what the output "should" be.
- D3. Interactive UX. Run `antigravity init` and send SIGINT (Ctrl-C)
  midway. It must exit 0 with no stack trace. Tests B3 cover this
  but confirm it works under a real shell too.
- D4. Typos / grammar / spelling. Scan `README.md`, `CHANGELOG.md`,
  and any user-visible string in `src/` for obvious typos or awkward
  phrasing. The prior chat already fixed "sanboxes" → "sandboxes";
  look for more. Quote any hits with file:line.
- D5. Visual rendering. Confirm the figlet banner renders (not garbled)
  and picocolors output applies color codes (does not print literal
  `\u001b[33m` etc). Paste banner output.

---

## 3. Hard constraints (tripwires — any trip = mechanical NO-GO)

1. **No hand-typed verdict.** The strings "GO" and "NO-GO" only appear
   in your deliverable as copy-pasted output from `node scripts/verdict.mjs`.
2. **No "I verified that..." without literal evidence.** Every claim
   you make must be followed by the exact command and the exact output
   (or a precise file:line reference). Summaries of output are not
   evidence.
3. **No skipped adversarial checklist item.** All 5 items in §6 must
   be executed with a verdict per item. A skipped item is an automatic
   NO-GO.
4. **No running `npm publish`.** Even `--dry-run` is already done. You
   are read-only on the registry.
5. **No modifying project files.** Your only write target is
   `.agents/validations/pre-publish-audit-validation.md`. If you need
   to create a sandbox to exercise the CLI, use the OS temp dir
   (`$TMPDIR` / `%TEMP%`), not the repo.
6. **Stop on first critical finding.** If A2/A3/A4/B2/B3/B4/C1 fails,
   stop the audit, document the failure, and emit NO-GO. Do not
   "work around" a safety failure.

---

## 4. Acceptance criteria — mechanical PASS matrix

Your deliverable must include this table, completed with literal
evidence. Any row not DONE blocks GO.

| Axis | Criterion | Evidence required |
|------|-----------|-------------------|
| A1 | Tarball contents enumerated | File list with sizes (43+ files) |
| A2 | LICENSE shipped | `grep LICENSE <file-list>` shows hit |
| A3 | No secrets in shipped files | Scan output, zero hits |
| A4 | bin.antigravity in published package.json | Extracted tarball's package.json, verbatim |
| A5 | Shebang on dist/index.js | `head -1 dist/index.js` = `#!/usr/bin/env node` |
| A6 | publishConfig.access=public | Extracted tarball's package.json |
| A7 | Repository URL resolves | URL pasted + reachability confirmed |
| B1 | Clean npm install works | Last 20 lines of `npm install` output |
| B2 | Preflight ALL PASS | Summary block |
| B3 | 48/48 tests pass | vitest summary |
| B4 | --version matches package.json | Both commands + outputs |
| B5 | --help lists 4 commands | Help text |
| B6 | info (empty) is friendly | CLI output |
| B7 | info → generate → reset round-trip | CLI output at each step |
| C1 | Version consistency across 4 locations | 4 greps + outputs |
| C2 | Spec-by-spec requirement map | Full map per project-specs.md |
| C3 | Adversarial checklist | §6 below |
| C4 | Cross-platform report has per-platform output | File path + quote |
| C5 | Governance alignment | 3 confirmations |
| D1 | README audit | Narrative + quotes |
| D2 | Error path exercised | Real command + output |
| D3 | SIGINT exits 0 | Terminal recording or test reference |
| D4 | Typo scan | Hit list or "zero hits" |
| D5 | Banner renders + colors apply | Pasted banner |

---

## 5. Deliverable format

Write to `.agents/validations/pre-publish-audit-validation.md`.
Use this structure — do not invent your own:

```markdown
# Pre-Publish Audit — @projeto-zero/cli v1.0.0

**Auditor:** @PrePublishAuditor
**Session:** Pre-Publish Audit
**Date:** <today>
**Policy:** single-family (per `.agents/vendor-policy.json`)
**Commit audited:** <git rev-parse HEAD>

## 0. Environment sanity
<paste the 6 commands from §0 + their output>

## 1. Required-reading summaries
<one line per file from §1, 8 files total>

## 2. Acceptance matrix
<copy the table from §4, fill in every row with DONE + evidence path>

## 3. Safety findings (Axis A)
### A1 — tarball contents
<literal file list>
### A2 — LICENSE ships
<evidence>
...continue for A3–A7

## 4. Stability findings (Axis B)
### B1 — clean install
<literal output>
...continue for B2–B7

## 5. Correctness findings (Axis C)
### C1 — version consistency
<4 greps + outputs>
...continue for C2–C5

## 6. Experience findings (Axis D)
### D1 — README audit
<quotes + narrative>
...continue for D2–D5

## 7. Adversarial Checklist (§4 of antigravity-taxonomy.md)
### Item 1 — Evidence Literality
<are all claims backed by pasted literal output? verdict: PASS | FAIL + why>
### Item 2 — File Existence
<picked N file-claims at random and ran `ls`/`cat`, results:>
### Item 3 — Anti-"technically compiles"
<do tests hit the real production runtime path, or do they mock it?>
### Item 4 — Per-Platform Output
<cross-platform claims backed by per-platform output?>
### Item 5 — Spec-by-Spec Diff
<every project-specs.md requirement mapped to real code + real test?>

## 8. Gate transcript (R15)
<paste the full output of `node scripts/session-gate.mjs`>

## 9. Verdict
<paste the full output of `node scripts/verdict.mjs` verbatim>

## 10. Open questions / follow-ups
<anything the publishing agent should know but that doesn't block GO>
```

---

## 6. Adversarial Checklist (MANDATORY — single-family policy)

Execute and report each of the 5 items in §4 of
`.agents/antigravity-taxonomy.md`. Do NOT skip — under single-family
policy this is the primary anti-gaming defense, equivalent to what
cross-family separation would provide in a cross-family setup.

1. **Evidence Literality** — Pick 3 claims at random from your own
   deliverable. Are they backed by the literal command + output, or
   by narrative? Any narrative-only claim must be downgraded or
   evidenced.
2. **File Existence** — Pick 3 file paths referenced in your
   deliverable. Run `ls` / `test -f` and paste the result. Missing
   file = blocker.
3. **Anti-"technically compiles"** — Pick 3 tests from
   `apps/cli/src/__tests__/`. Read them. Do they exercise the real
   `dist/` runtime path or mock their way to green? Mocked = suspect.
4. **Per-Platform Output** — Open `.agents/handoffs/cross-platform-report.md`.
   For each declared platform (Windows PS, cmd.exe, Linux), does the
   report contain a block of literal shell output attributed to that
   platform? Missing = contract violation per R9.
5. **Spec-by-Spec Diff** — Read `.agents/project-specs.md`. For every
   numbered or bulleted requirement, locate
   the satisfying code in `apps/cli/src/` and the satisfying test in
   `apps/cli/src/__tests__/`. Produce a map: requirement → code-path
   → test-path. Unmapped row = blocker.

---

## 7. What "GO" means vs "NO-GO"

**GO** = every row in the acceptance matrix is DONE, every adversarial
checklist item is PASS, the gate transcript is clean, and
`node scripts/verdict.mjs` prints the PRODUCTION-READY verdict.

**NO-GO** = any row is not DONE, or any adversarial item is FAIL, or
the verdict script prints anything other than the GO line. In the
NO-GO case, your report must include a remediation list precise
enough for the previous chat to action without asking clarifying
questions.

---

## 8. One last anti-gaming note

You may be tempted to declare rows DONE because "the prior agent
already proved it" or "the code obviously works." This is the exact
failure mode the Session 11 post-mortem documented and the Session
12 contract was written to prevent. Your job is not to co-sign the
prior chat's work — it is to independently re-derive every claim.
If a claim collapses under re-derivation, that is a critical finding,
not a nuisance.

Begin.
