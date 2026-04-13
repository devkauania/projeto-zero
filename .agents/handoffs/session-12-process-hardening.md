# Session 12 Handoff — @ProcessHardener

**Agent:** @ProcessHardener (Session 12 — META)
**Date:** 2026-04-07
**Status:** Machinery installed. Retroactive scan of Session 11 catches the predicted failures. Awaiting Session 12v validation (Gemini).

## 1. Scope

Session 12 is a META session. No product code was touched. The mission was
to make Session 11's five failure modes (code-review-only error audit, no
error-path tests, missing declared `README.md`, fabricated
`repository.url`, silently Windows-only cross-platform scope) mechanically
impossible for every future session in this pipeline — and to prove the
machinery works by pointing it at Session 11's output and recording what
it catches.

Out of scope by explicit instruction: writing the README, fixing the
`repository.url`, adding error-path tests, touching `apps/cli/src/**`.
Those belong to Sessions 13, 14a, 14b, 15.

## 2. Files Touched

Created:
- `.agents/prompts/_session-template.md`
- `.agents/prompts/_validation-template.md`
- `.agents/prompts/_handoff-template.md`
- `scripts/placeholder-scan.mjs`
- `scripts/placeholder-allowlist.txt`
- `scripts/files-exist.mjs`
- `scripts/pack-sanity.mjs`
- `scripts/repo-metadata-check.mjs`
- `scripts/preflight.mjs`
- `scripts/verdict.mjs`
- `scripts/session-gate.mjs`
- `.agents/process-hardening.md` (this file)

Modified:
- `.agents/prompts/_production-contract.txt` — added rules R9–R16 and the
  Session 12 preamble pointing at `release-engineering.md §8`.
- `package.json` (root) — added `preflight`, `verdict`, `gate`,
  `scan:placeholders` scripts. No new dependencies.
- `.agents/PROJECT_ROADMAP.md` — reverted Session 11 from `[x]` to `[~]`
  with a pointer to this file, inserted Session 12 + 12v, renumbered
  OLD 12→13 (DocsAuthor, now Gemini), OLD 13→14a/14b (ErrorPathTester
  split per rule R13), OLD 14→15 (CrossPlatform), OLD 15→16 (FinalAudit),
  OLD 16→17 (Publisher), and added paired `Nv` validation rows for each
  per rule R11 (model family alternated Claude↔Gemini).

Out-of-list edits: none.

## 3. Self-Grading Table

| # | Deliverable                                                                 | Status | Evidence |
|---|-----------------------------------------------------------------------------|--------|----------|
| 1 | Rewrite `_production-contract.txt` with rules R9–R16 and Session 12 preamble | DONE   | `.agents/prompts/_production-contract.txt` |
| 2 | Six gate scripts under `scripts/` (plus verdict.mjs = 7 total)              | DONE   | `scripts/{placeholder-scan,files-exist,pack-sanity,repo-metadata-check,preflight,verdict,session-gate}.mjs` |
| 3 | Session / validation / handoff templates                                    | DONE   | `.agents/prompts/_session-template.md`, `_validation-template.md`, `_handoff-template.md` |
| 4 | Root `package.json` wiring for `preflight`/`verdict`/`gate`/`scan:placeholders` | DONE | `package.json` scripts block |
| 5 | Roadmap: Session 11→[~], new Session 12 row, renumber 12-16→13-17 with validation sub-rows | DONE | `.agents/PROJECT_ROADMAP.md` Etapa 4 |
| 6 | Retroactive Session 11 scan catching the three predicted failures           | DONE   | `## Session 11 Retroactive Scan` below |
| 7 | This handoff, per `_handoff-template.md`                                    | DONE   | `.agents/process-hardening.md` |

Rationale for the 14a/14b split (rule R13): Session 11's error-path
"audit" failed specifically because it was code-review-only. R13 says
"done is defined by the test going green, not by narrative", which
requires a failing-test-first session followed by a fix session. Sessions
13 (DocsAuthor) and 15 (CrossPlatformVerifier) were NOT split because
their deliverables are directly inspectable by the gate scripts
(`files-exist`, `repo-metadata`, `placeholder-scan`, and manual E2E
transcripts respectively); their completion is mechanical already.

## 4. Gate Transcript

`SESSION_NUMBER=12 node scripts/session-gate.mjs` output after this
handoff file was written. The gate exits non-zero because the Session 11
preflight failures are still present on disk — that is expected and is
the whole point of this session. Sessions 13–15 are responsible for
clearing them. Rerun after writing this handoff:

```
session-gate: session = 12
=== preflight: build ===    PASS
=== preflight: lint ===     PASS
=== preflight: test ===     PASS (34/34)
=== preflight: files-exist ===
FAIL files-exist: 1 declared file(s) missing from disk:
  apps/cli/README.md
=== preflight: pack-sanity ===
FAIL pack-sanity: 1 issue(s):
  declared files[] entry missing from pack: README.md
=== preflight: repo-metadata ===
FAIL repo-metadata: 1 issue(s):
  repository.url 'https://github.com/projeto-zero/cli.git' matches placeholder regex (rule R12)
=== preflight: placeholder-scan ===
FAIL placeholder-scan: 1 hit(s):
  apps/cli/package.json:27: github.com/projeto-zero — "url": "https://github.com/projeto-zero/cli.git"

=== preflight summary ===
check                status   ms
----------------------------------------
build                PASS     935
lint                 PASS     910
test                 PASS     879
files-exist          FAIL     151
pack-sanity          FAIL     983
repo-metadata        FAIL     152
placeholder-scan     FAIL     167

preflight: FAILED (files-exist, pack-sanity, repo-metadata, placeholder-scan)
FAIL preflight — preflight failed (see above)
PASS handoff-exists — .agents/process-hardening.md
PASS self-grading-table — present
PASS gate-transcript — present
PASS grading-vs-verdict — ok (verdict is NOT-READY, not PRODUCTION-READY)
SKIP git-clean — git not available or not a repo (this working tree is not a git repo)

session-gate: FAIL (due to Session 11 leftovers under preflight — expected and documented)
```

Note on `git-clean`: the working directory reports no git repo, so the
gate `SKIP`s it. The gate's `PASS`/`FAIL` verdict is driven by `preflight`
+ handoff structure only in this environment.

## 5. Verdict

`node scripts/verdict.mjs` output, captured mechanically per rule R14. Do
not interpret this as a failure of Session 12 — Session 12's deliverable
was to install the machinery that produces this exact output when pointed
at Session 11's work:

```
NOT-READY: files-exist, pack-sanity, repo-metadata, placeholder-scan
```

Per rule R14, this is the only legitimate source of the verdict string.
No agent typed it.

### Verdict interpretation

The four failing checks correspond 1-to-1 with four of Session 11's five
unreported failure modes:

| Failing check        | Session 11 failure mode caught                                     | Predicted in prompt? |
|----------------------|---------------------------------------------------------------------|----------------------|
| `files-exist`        | `apps/cli/package.json` `files: ["dist","README.md"]` but no README | YES                  |
| `pack-sanity`        | Same — "look for friends" R16 catches it from the pack list angle   | BONUS (R16 working)  |
| `repo-metadata`      | `repository.url` is a fabricated placeholder                        | YES                  |
| `placeholder-scan`   | Same placeholder caught by the string regex                         | YES                  |

All three predicted failures caught, plus a fourth corroborating catch
from the independent pack-sanity angle. The fifth Session 11 failure mode
(silently Windows-only cross-platform coverage) is a RUN-TIME gap that
cannot be detected by static scans — it is enforced by Session 15's
four-platform execution requirement and by rule R9 (EXECUTE, NEVER
CONFIRM).

## 6. Errors Encountered and How They Were Fixed

- **Placeholder scan had too broad a blast radius on first run.** The
  initial scan produced 18 hits, including self-referential matches in
  the gate scripts themselves (which contain the pattern source), the
  `scan:placeholders` npm script name in root `package.json`, agent
  prompts under `.agents/prompts/` that legitimately discuss placeholders,
  Session 10/11 narrative handoffs, and the `@clack/prompts` library's
  `placeholder:` API field used in `init.ts` / `generate.ts`.
  **Fix:** three surgical changes in `scripts/placeholder-scan.mjs`:
    (a) extended `IGNORED_FILES` to cover the gate scripts, root
        `package.json`, and the pre-existing narrative handoffs,
    (b) added `IGNORED_DIR_PREFIXES = [.agents/prompts, .agents/validations]`
        so the agent-facing prompt library and validator reports are
        exempt (their job is to discuss these terms),
    (c) added two entries to `scripts/placeholder-allowlist.txt` with
        justification comments: `placeholder:\s*["']` for the `@clack`
        API field, and `"\(none\)" placeholder` for a test comment.
  **Result:** scan now reports exactly one hit — `apps/cli/package.json:27`,
  the real Session 11 bug. This is the intended behavior.
- **`.claude/settings.local.json` contained the literal command
  `"Bash(node scripts/placeholder-scan.mjs)"`** which matched `placeholder`.
  **Fix:** added `.claude` to `IGNORED_DIRS`.
- **Initial `IGNORED_FILES` entry for the contract file had an invisible
  zero-width-space character** from a paste artifact. **Fix:** removed it
  and kept the clean `join(".agents","prompts","_production-contract.txt")`.

## 7. Known Gaps for the Next Session

- **The four preflight failures are intentionally left in place.** Session
  13 (@DocsAuthor, Gemini) is responsible for clearing three of them —
  write `apps/cli/README.md`, fix `repository.url` to a real value (per
  rule R12, Session 13 MUST ASK rather than invent; if the owner/repo
  slug is unknown, write `.agents/session-13-blockers.md` and halt) — at
  which point `files-exist`, `pack-sanity`, `repo-metadata`, and
  `placeholder-scan` should all flip to PASS in a single pass.
- **Git hooks are NOT installed by this session.** The prompt explicitly
  excluded them because they affect the user's machine state. A future
  "Session 12b infrastructure" could wire `scripts/session-gate.mjs` into
  a pre-push hook. Not in scope now. → no assigned session.
- **`scripts/session-gate.mjs`'s `git-clean` check SKIPs when not in a git
  repo.** This working tree is not a git repo, so the check is latent. It
  will activate automatically once the repo is initialized. → no assigned
  session.
- **`session-gate.mjs` detects the session number by scanning the roadmap
  for the highest `Sessão <N>` mention.** This works now (max=17), but a
  session explicitly validating an OLDER session must override with
  `SESSION_NUMBER=N`. Documented in `_validation-template.md`.
- **Error-path runtime validation (Session 11 gap #1) is deferred to the
  Session 14a/14b split per rule R13.** Session 14a writes the failing
  tests; Session 14b makes them pass. Neither can be skipped without
  failing the gate.
- **Cross-platform coverage (Session 11 gap #5) is deferred to Session 15
  (@CrossPlatformVerifier) with the explicit four-platform requirement
  and the rule-R9 "execute, never confirm" constraint.**
- **Session 12 itself is validated by Session 12v (Gemini).** The
  validator will re-run `npm run gate`, independently review every new
  script, re-run the retroactive scan, and produce
  `.agents/validations/session-12-validation.md` with GO/NO-GO. Per rule
  R11, Session 12's roadmap row should only be considered fully closed
  after 12v returns GO.

---

## Session 11 Retroactive Scan

This is the proof that the machinery works. Command:

```bash
npm run preflight
```

Full output (captured 2026-04-07, before any remediation):

```
> preflight
> node scripts/preflight.mjs


=== preflight: build ===
 Tasks:    1 successful, 1 total (cached)

=== preflight: lint ===
 Tasks:    1 successful, 1 total (cached)

=== preflight: test ===
 Test Files  5 passed (5)
      Tests  34 passed (34)
 Tasks:    1 successful, 1 total (cached)

=== preflight: files-exist ===
FAIL files-exist: 1 declared file(s) missing from disk:
  apps/cli/README.md

=== preflight: pack-sanity ===
FAIL pack-sanity: 1 issue(s):
  declared files[] entry missing from pack: README.md

=== preflight: repo-metadata ===
FAIL repo-metadata: 1 issue(s):
  repository.url 'https://github.com/projeto-zero/cli.git' matches placeholder regex (rule R12)

=== preflight: placeholder-scan ===
FAIL placeholder-scan: 1 hit(s):
  apps/cli/package.json:27: github.com/projeto-zero — "url": "https://github.com/projeto-zero/cli.git"

=== preflight summary ===
check                status   ms
----------------------------------------
build                PASS     974
lint                 PASS     924
test                 PASS     862
files-exist          FAIL     148
pack-sanity          FAIL     1037
repo-metadata        FAIL     145
placeholder-scan     FAIL     164

preflight: FAILED (files-exist, pack-sanity, repo-metadata, placeholder-scan)
```

### What the scan caught vs. what it predicted

Predicted in the Session 12 prompt:
1. `files-exist.mjs` → README.md declared in `files[]` but missing. **CAUGHT.**
2. `repo-metadata-check.mjs` → `repository.url` matches placeholder regex. **CAUGHT.**
3. `placeholder-scan.mjs` → `github.com/projeto-zero` hit in package.json. **CAUGHT.**

Bonus catch not predicted: `pack-sanity.mjs` independently catches the
missing README from the other direction — it inspects the actual
`npm pack --dry-run` output and notices that the declared `files[]` entry
`README.md` is absent from the pack list. This is rule R16 ("look for
friends, not just enemies") working as intended, and it means the
missing-README failure mode is covered by two independent checks. Either
alone would have blocked Session 11.

### What the scan did NOT catch

- **Code-review-only error-path audit (Session 11 gap #1).** Static
  scanning cannot distinguish "I ran the SIGINT path" from "I read the
  code and reasoned about it." Enforcement moves to rule R9 + Sessions
  14a/14b (acceptance-test-first split per R13).
- **Silently Windows-only cross-platform coverage (Session 11 gap #5).**
  Also a runtime-environment gap, not a static one. Enforcement moves to
  Session 15's explicit four-platform requirement with command-output
  pastes as evidence (rule R9).

These two gaps are the reason rule R9 ("EXECUTE, NEVER CONFIRM") exists
alongside the static gates. Static gates catch declared-vs-reality drift;
R9 catches reasoning-vs-execution drift. Together they cover all five
Session 11 failure modes.
