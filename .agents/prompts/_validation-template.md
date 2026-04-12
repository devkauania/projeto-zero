# Prompt — Session <N>v (<ValidatorAgentName>) — Validation of Session <N>

> Skeleton for every VALIDATION session. Rule R11: the validator MUST run
> on a different model family than the implementation session it reviews
> (Claude → Gemini, Gemini → Claude).

## Before You Do Anything

Read in full, in order, and paste a 1-line summary of each in your first
response:
0. `.agents/prompts/_agent-mandate.md`
1. `.agents/prompts/_production-contract.txt`
2. `.agents/PROJECT_ROADMAP.md`
3. `<implementation session's handoff>` (the one you are validating)
4. `.agents/project-specs.md`

## Mission

You are READ-ONLY on implementation files. You may only create ONE file:
`.agents/validations/session-<N>-validation.md`. Any other edit is a
contract violation.

1. Run `node scripts/session-gate.mjs` FIRST and paste the full output
   into your validation report under a `## Gate Transcript` section.
2. Read the implementation session's Self-Grading Table. For each row,
   independently verify the claim by running the linked evidence
   (command, test, file) yourself. Do NOT trust the claim text.
3. For each row, record PASS or FAIL in your own independent grading
   table with an evidence link (file path + line, or command + output).
4. Produce a single GO or NO-GO verdict at the end of the report,
   computed mechanically: GO iff every row is PASS AND
   `scripts/session-gate.mjs` exited 0.

## Hard Constraints

- You may NOT modify any file under `apps/`, `scripts/`, `.agents/prompts/`,
  `.agents/PROJECT_ROADMAP.md`, or any existing handoff. To enforce this,
  run `git diff --name-only` before writing your report and assert that
  the only untracked/modified file is your validation report.
- You may NOT type "PRODUCTION-READY" or "NOT-READY" by hand. Paste the
  output of `node scripts/verdict.mjs` verbatim into your report (rule R14).
- Rule R9: if a bullet says "verify X", you verify it by EXECUTING the
  evidence, not by reading code.

## Deliverables

- `.agents/validations/session-<N>-validation.md` — required sections:
  1. Scope (what session is being validated, which model family you are)
  2. Gate Transcript (paste of `scripts/session-gate.mjs`)
  3. Verdict Transcript (paste of `scripts/verdict.mjs`)
  4. Independent Grading Table (one row per implementation bullet,
     reviewer PASS/FAIL, evidence link, commentary)
  5. Diff Guard (output of `git diff --name-only` proving read-only scope)
  6. Final Decision: **GO** or **NO-GO** (computed, not chosen)

## Validation of This Validation

None. Validation sessions are terminal. If the validator is wrong, the
next implementation session will notice because the gate will fail.
