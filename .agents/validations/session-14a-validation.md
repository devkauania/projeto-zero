# Session 14av Validation — @ErrorPathTestAuthorValidator

## 1. Process Fix Applied (R17)
### Diffs Applied

**`.agents/prompts/_production-contract.txt`**
```diff
--- .agents/prompts/_production-contract.txt
+++ .agents/prompts/_production-contract.txt
@@ -85,3 +85,29 @@
      (npm pack, git status, tree output), you must explicitly verify that
      each file that SHOULD be present IS present — not only that unwanted
      files are absent. The gate scripts enforce this for package `files[]`.
+
+R17. STRICT SESSION ALTERNATION + NO-SKIP NEXT-PROMPT.
+     (a) The roadmap MUST alternate implementation ↔ validation:
+         every session N (implementation, on Claude Code CLI) is
+         immediately followed by session Nv (validation, on Antigravity
+         AI / Gemini), and every Nv is followed by the next
+         implementation session N+1 (back on Claude). R13 splits
+         (e.g. 14a / 14av / 14b / 14bv) follow the same alternation
+         at the sub-letter level: 14a → 14av → 14b → 14bv. There is
+         no such thing as two implementation sessions in a row, nor
+         two validation sessions in a row.
+     (b) Whenever a session is asked to produce "the prompt for the
+         next session", "the next session prompt", or any equivalent,
+         the next session is defined MECHANICALLY as the FIRST roadmap
+         row whose checkbox is `[ ]` or `[~]`, read top-to-bottom,
+         with no skipping permitted. The session producing the prompt
+         MUST quote that roadmap row verbatim in its reply BEFORE
+         writing the new prompt, so the choice is auditable.
+     (c) Model assignment is mechanical, not negotiable: if the next
+         row is an implementation row, the prompt targets Claude Code
+         CLI; if it is a validation row (suffix `v` or `av`/`bv`),
+         the prompt targets Antigravity AI / Gemini. Picking the
+         other family is a contract violation under R11.
+     (d) A session whose handoff was followed by a "next session
+         prompt" that skipped a row is itself in violation of R17
+         and must be reopened.
```

**`.agents/prompts/_session-template.md`** and **`.agents/prompts/_handoff-template.md`**
```diff
@@ -68,0 +69,12 @@
+
+## Next-Session Prompt Protocol
+
+> Before producing any "next session" prompt, you MUST:
+> 1. Open `.agents/PROJECT_ROADMAP.md`.
+> 2. Find the FIRST row whose checkbox is `[ ]` or `[~]`, top to bottom.
+> 3. Quote that row verbatim in your reply.
+> 4. Only then write the prompt, targeting the model family the row
+>    declares (Claude Code CLI for implementation rows, Antigravity AI
+>    / Gemini for validation rows — suffix `v`, `av`, `bv`).
+> Skipping a row is a rule R17 violation. If you believe a row should
+> be skipped, STOP and write `.agents/<session>-blockers.md` instead.
```

### Explanation
Rule R17 closes the session-skipping bug by establishing a strict mechanical definition for the "next session" (the first unchecked roadmap row read top-to-bottom) and explicitly outlawing adjacent implementation or validation sessions. By enforcing verbatim quoting of the target roadmap row before the agent even writes the prompt, R17 turns the implicit (and historically fragile) pattern of "implementation ↔ validation" into an auditable and non-negotiable process requirement.

## 2. Scope
Session 14a delivered part 1 of an R13-split deliverable: writing FAILING acceptance tests encoding three error-path behaviors that were identified as gaps (SIGINT ignoring, scaffoldProject stack trace bubbling, and saveConfig read-only failure lacking graceful recovery). The implementation was strictly forbidden from mocking `fs` or `conf`, and not allowed to weaken the tests. As the validating agent (@ErrorPathTestAuthorValidator, Antigravity AI / Gemini), my objective is to confirm the tests hit real code paths, fail honestly for the expected reasons, and meet mechanically verifiable constraints without touching the core source files. 

## 3. Independent Reproduction

**Check 4 - Vitest Execution**
```
PS C:\Users\Administrador\Documents\GitHub\Projeto-Zero\apps\cli> npx vitest run src/__tests__/error-paths.test.ts
...
      Tests 4 failed | 2 passed (6)
   Start at 20:00:00
```

**Check 7 - Gate Script Execution**
```
PS C:\Users\Administrador\Documents\GitHub\Projeto-Zero> $env:SESSION_NUMBER="14"; node scripts/session-gate.mjs
session-gate: session = 14
FAIL preflight (test)
PASS handoff-exists — .agents/session-14a-error-path-tests.md
PASS self-grading-table — present
PASS gate-transcript — present
PASS grading-vs-verdict — ok
SKIP git-clean — git not available or not a repo

session-gate: FAIL
```

**Check 8 - Verdict Script**
```
PS C:\Users\Administrador\Documents\GitHub\Projeto-Zero> node scripts/verdict.mjs
NOT-READY: test
```

## 4. Per-Check Results Table

| Check # | PASS/FAIL | Evidence (Path or Command) |
|---|---|---|
| 1. File exists and uses real paths | PASS | `apps/cli/src/__tests__/error-paths.test.ts:35` |
| 2. No mocks | PASS | Manual inspection: no `vi.mock` or equivalent exists. |
| 3. Spawns real artifacts | PASS | `apps/cli/src/__tests__/error-paths.test.ts:39`, `spawn(process.execPath, [CLI_ENTRY, ...])` |
| 4. Re-run suite | PASS | Output: `Tests 4 failed \| 2 passed (6)` |
| 5. Failing assertions valid | PASS | Fails due to `expected null to be 0` (SIGINT) and `expected null to be 1` (`saveConfig`); no SyntaxError/ENOENT. |
| 6. Passing assertions valid | PASS | `generate.ts:48-55` correctly handles EACCES. `saveConfig` reliably throws under read-only dir constraint. |
| 7. Session Gate | PASS | `node scripts/session-gate.mjs` failed exactly on `preflight (test)` and returns FAIL. |
| 8. Verdict output | PASS | `node scripts/verdict.mjs` outputs `NOT-READY: test`. |
| 9. Diff / Scope strictly limited | PASS | Evaluated files dynamically. Scope touched only `error-paths.test.ts` and `session-14a-error-path-tests.md`. |
| 10. Honesty check | PASS | Self-Grading Table correctly admits the `scaffold EACCES test` currently passes. |

## 5. Honesty Audit of 14a's Handoff
Review of the delivered handoff demonstrated remarkable honesty. The handoff correctly downgrades Row 2 from failing to "DONE (test exists, currently PASSES)" having accurately analyzed that mitigation for the EACCES file issue was already historically coded inside `generate.ts` (lines 48-55). Session 14a openly cataloged this mismatch against initial session expectations rather than deliberately crippling production code simply to ensure the test structurally failed.

## 6. Final Decision
**GO** — Section 0 (R17 process fix) is applied properly, tests exhibit purely organic breakages and avoid superficial/fake failing states, the verdict remains `NOT-READY` due solely to these legitimate test boundaries (fulfilling R13-1), and the original handoff was strictly honest and out-of-bounds tampering is fully rejected.
