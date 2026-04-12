# Prompt — Sessão 14bv (@ErrorPathFixerValidator) — Validation of Session 14b

> Run this prompt on **Antigravity AI / Gemini** (rule R11: validator
> must run on a different model family than the implementation it
> reviews; Session 14b ran on Claude Code CLI). Follow
> `.agents/prompts/_validation-template.md` exactly.

## Before You Do Anything

Read in full, in order, and paste a 1-line summary of each in your
first response (do NOT begin work until the summaries are posted):

1. `.agents/prompts/_production-contract.txt`
2. `.agents/PROJECT_ROADMAP.md`
3. `.agents/session-14b-error-path-fixes.md` (the implementation
   handoff you are validating)
4. `.agents/session-14a-error-path-tests.md` (the test author's
   handoff — needed for the diff-guard step on the test file)
5. `.agents/project-specs.md`

## Mission

You are READ-ONLY on every file under `apps/`, `scripts/`,
`.agents/prompts/`, `.agents/PROJECT_ROADMAP.md`, and every existing
handoff. You may create exactly ONE file:
`.agents/validations/session-14b-validation.md`. Any other edit is a
contract violation under R11.

1. Run `node scripts/session-gate.mjs` (with `SESSION_NUMBER=14`) and
   paste the full unedited output into a `## Gate Transcript` section
   of your validation report.
2. Run `node scripts/verdict.mjs` and paste the full unedited output
   into a `## Verdict Transcript` section. Rule R14: never type
   `PRODUCTION-READY` / `NOT-READY` by hand.
3. Independently run the failing-tests-from-14a target file:
   `cd apps/cli && npx vitest run src/__tests__/error-paths.test.ts`.
   Record the literal pass/fail counts. All 6 tests MUST be green.
4. **Diff guard on the test file (critical, this is the whole reason
   14bv exists).** Compare `apps/cli/src/__tests__/error-paths.test.ts`
   as it stands today against the version Session 14a authored.
   Use `git show` if a commit exists, otherwise diff against the
   text quoted in the §1–§4 of the 14a handoff. The assertions
   inside the test file MUST be byte-identical — Session 14b is
   forbidden from weakening any expectation. If you find any
   loosened `expect(...)`, removed `assertNoStackTrace` call,
   widened regex, increased `timeoutMs` past the 14a value, or
   removed test case, your verdict is **NO-GO**.
5. For each row of Session 14b's Self-Grading Table, independently
   verify the claim by executing the linked evidence yourself.
   Record PASS/FAIL in your own grading table with file:line or
   command-output evidence. Do NOT trust the claim text.
6. Specifically re-verify on your machine:
   (a) all 3 SIGINT tests exit with `code === 0`,
   (b) the saveConfig recovery test exits with `code === 1` and
       its stdout/stderr contains `Failed to save configuration`,
   (c) `assertNoStackTrace` does not fire on any of the 6 cases.
7. Run `git diff --name-only` (or the equivalent if not a git repo:
   list every file you touched) and paste the output into a
   `## Diff Guard` section. The ONLY file in that list must be
   your validation report.
8. Final Decision: **GO** iff ALL of the following are true,
   computed mechanically — do not choose:
     - `session-gate.mjs` exited 0
     - `verdict.mjs` printed `PRODUCTION-READY`
     - All 6 tests in `error-paths.test.ts` are green
     - The test file is byte-identical to Session 14a's version
       in every assertion
     - Every row in your independent grading table is PASS
     - The diff guard shows only the validation report
   Otherwise: **NO-GO** with a one-paragraph reason per failure.

## Hard Constraints

- Read-only on everything except `.agents/validations/session-14b-validation.md`.
- R9: "verify" means EXECUTE the evidence, not read code and reason.
- R12: if anything is ambiguous (e.g. you cannot find Session 14a's
  original test file content), STOP and write
  `.agents/session-14bv-blockers.md`. Do not invent.
- R14: paste verdict.mjs output verbatim. Never type the verdict.

## Deliverables

`.agents/validations/session-14b-validation.md` with the six
mandatory sections from `.agents/prompts/_validation-template.md`:

1. Scope (validating Session 14b; you are the Gemini validator)
2. Gate Transcript (paste of `session-gate.mjs`)
3. Verdict Transcript (paste of `verdict.mjs`)
4. Independent Grading Table (one row per 14b Self-Grading bullet,
   reviewer PASS/FAIL, evidence link, commentary)
5. Diff Guard (output of `git diff --name-only` or equivalent,
   plus the byte-identity check on `error-paths.test.ts`)
6. Final Decision: **GO** or **NO-GO** (computed, not chosen)

## Validation of This Validation

None. Validation sessions are terminal. If you are wrong, the next
implementation session (Sessão 15) will catch it because the gate
will fail.

## After You Finish

Only after BOTH this validation report is written AND its decision
is **GO**, the human operator may flip the Session 14b row and the
Session 14bv row in `.agents/PROJECT_ROADMAP.md` from `[ ]` to `[x]`
(rule R11). Do NOT edit the roadmap yourself.
