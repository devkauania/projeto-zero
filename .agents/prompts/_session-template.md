# Prompt — Session <N> (<AgentName>)

> Skeleton for every IMPLEMENTATION session prompt. Read rules R9–R16 in
> `.agents/prompts/_production-contract.txt` before instantiating.

## Before You Do Anything

Read in full, in order, and paste a 1-line summary of each in your first
response proving you actually read them:
0. `.agents/prompts/_agent-mandate.md`
1. `.agents/prompts/_production-contract.txt`
2. `.agents/project-specs.md`
3. `.agents/PROJECT_ROADMAP.md`
4. `<previous session handoff>`
5. `<any other handoff this session depends on>`

Do NOT begin work until the summaries are posted.

## Mission

Numbered bullets. Each bullet becomes one row in the Self-Grading Table
(rule R10), so phrase each as an atomic, checkable outcome.

1. <bullet one>
2. <bullet two>
3. ...

## Hard Constraints

- No edits outside the declared files list (see Deliverables).
- No new runtime dependencies unless explicitly listed in Deliverables.
- Rule R12: if anything is ambiguous — URL, name, version, scope — STOP
  and write `.agents/session-<N>-blockers.md`. Do not invent placeholders.
- Rule R9: the word "confirm" is banned. Execute the check or write the
  test. Reading code is not verification.

## Acceptance Criteria (mechanical)

- `node scripts/preflight.mjs` exits 0 at end of session (or the remaining
  failures are pre-existing and explicitly listed under Known Gaps).
- `node scripts/session-gate.mjs` exits 0 (rule R15).
- Every Mission bullet appears as a DONE row in the Self-Grading Table
  (rule R10). Non-DONE rows block a PRODUCTION-READY verdict.

## Deliverables

List exact file paths that will be created or modified. Paths not on this
list are out of scope.

- `<path 1>`
- `<path 2>`

## Handoff Format

Follow `.agents/prompts/_handoff-template.md` exactly. All six sections
are required. The verdict is a paste of `node scripts/verdict.mjs` output
— do not type it by hand (rule R14).

## Validation

After this session completes, run the validation prompt
`.agents/prompts/_validation-template.md` as
**Sessão <N>v** on a different model family:
- Claude implementation → Gemini validator
- Gemini implementation → Claude validator

Only mark Session <N>'s roadmap row `[x]` after BOTH this session and its
validation report under `.agents/validations/session-<N>-validation.md`
are green (rule R11).

## Next-Session Prompt Protocol

> Before producing any "next session" prompt, you MUST:
> 1. Open `.agents/PROJECT_ROADMAP.md`.
> 2. Find the FIRST row whose checkbox is `[ ]` or `[~]`, top to bottom.
> 3. Quote that row verbatim in your reply.
> 4. Only then write the prompt, targeting the model family the row
>    declares (Claude Code CLI for implementation rows, Antigravity AI
>    / Gemini for validation rows — suffix `v`, `av`, `bv`).
> Skipping a row is a rule R17 violation. If you believe a row should
> be skipped, STOP and write `.agents/<session>-blockers.md` instead.
