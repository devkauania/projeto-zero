# Session 17 Blockers (@Publisher)

> **Date:** 2026-04-14
> **Filed under:** Rule R12 (ASK, don't placeholder) + Rule R17 (strict alternation, no skip).
> **Status:** BLOCKED — session did not execute any mutation. No `git add`, no
> version bump, no tag, no `npm publish`, no `npm publish --dry-run`.

## 1. Why this file exists

Session 17 (`.agents/prompts/sessions/session-17-prompt.md`) was dispatched
to me immediately after Session 16 (`d416fc8 docs: add Session 16 final audit
deliverable`) landed. Before touching any file, the Compliance Pre-Check
surfaced three independent blockers that must be resolved by a human
decision. Per R12 I am consolidating them into this single file rather than
guessing my way through them.

## 2. Blocker A — R17 no-skip violation

Reading `.agents/PROJECT_ROADMAP.md` top-to-bottom, the first `[ ]`/`[~]`
row after the most recently completed row is:

```
- [ ] **Milestone B [ Gemini 3.1 Pro ]:** `@MilestoneReviewer` —
  validação consolidada de Sessions 15 e 16. Substitui 15v e 16v.
  Escopo: (1) Verificar cross-platform report de Session 15 com output
  literal de cada plataforma. (2) Cross-check auditoria final de Session 16
  contra `project-specs.md`. (3) Rodar `npm run gate` e colar transcript.
  (4) Executar adversarial checklist para Session 16 (same-family review
  per `antigravity-taxonomy.md` §4). (5) Emitir GO/NO-GO consolidado.
  **Tier:** Gemini Specialist (Gemini 3.1 Pro).
```

The Session 17 row is strictly downstream and is gated on Milestone B:

```
- [ ] **Sessão 17 [ Claude Code CLI (Haiku) ]:** `@Publisher` —
  **only runs if Milestone B returns GO.** Bump version in
  `apps/cli/package.json` per semver, update `CHANGELOG.md`, tag the
  release, `npm publish` (dry-run first, then real)...
```

Running Session 17 now skips Milestone B. R17(b) forbids skipping.
R17(d) says a session whose next-prompt skipped a row is itself in
violation and must be reopened.

Session 16's own handoff (`.agents/handoffs/session-16-final-audit.md`
§ Next-Session Prompt Protocol) explicitly quotes Milestone B as the
next mechanical row, not Session 17.

## 3. Blocker B — R12 missing-artifact trigger

The Session 17 prompt's Compliance Pre-Check requires me to read
`.agents/validations/milestone-b-validation.md` and paste a 1-line
summary. That file does not exist on disk. Contents of
`.agents/validations/` at the time of dispatch:

```
milestone-a2-validation.md
session-12-validation.md
session-13-validation.md
session-14a-validation.md
session-14b-validation.md
```

No `milestone-b-validation.md`, no `session-15-validation.md`, no
`session-16-validation.md`. Milestone B was designed to consolidate
the last two — and it has not run yet.

R12 requires me to STOP and file this question rather than invent a
plausible GO verdict.

## 4. Blocker C — Model / tier mismatch (unauthorized escalation)

The Session 17 prompt header explicitly declares:

```
Modelo: Claude Haiku 4.6 (claude-haiku-4-6) | Tier: Low
Escalacao: NAO escalar — operacoes de string/metadata apenas.
```

The prompt is currently executing on **Claude Opus 4.6** (Tier High),
not Haiku. Per `.agents/prompts/_agent-mandate.md §1`, Tier High sessions
carry additional protocol obligations (plan-and-execute cycle). Per the
prompt's own scope fence, executing this on Opus is itself a scope
violation — operations like `npm publish` should be performed by the
cheapest competent model so that the orchestration cost stays aligned
with the mechanical taxonomy in `antigravity-taxonomy.md §3`.

## 5. Anti-gaming observation

The user's persistent memory (`feedback_llm_distrust.md`) records that
the user distrusts LLM goal-optimization and requires mechanical
anti-gaming tripwires in every session prompt. The canonical failure
mode here is:

  > An LLM, given a prompt ending in `npm publish`, optimizes for
  > "complete the task" and either (a) publishes without milestone
  > validation or (b) fabricates a human-confirmation event to
  > satisfy AC-7.

This file is the mechanical refusal required by the tripwires the
user asked for. The publish gate stays closed until all three blockers
are resolved by the human operator.

## 6. What the human needs to decide

Pick one:

**Option 1 — Correct path (recommended).** Dispatch Milestone B to
Gemini 3.1 Pro using `.agents/prompts/sessions/milestone-b-prompt.md`.
If Milestone B returns GO, re-dispatch Session 17 to Claude Haiku 4.6
(the declared tier). The session prompt file does not need to change.

**Option 2 — Intentional skip.** The human explicitly overrides R17
to publish now. Even in that case, the tier-mismatch blocker (Claude
Opus running a Haiku-tier session) should be corrected by re-dispatch
to Haiku. An override audit trail should be added to
`.agents/PROJECT_ROADMAP.md` documenting the R17 exception and the
reason.

**Option 3 — Scope change.** The human wants Session 17 to become an
internal-only release (no `npm publish`, just version bump + tag +
changelog). Rewrite the Session 17 prompt to remove the publish
bullets, keep bullets 1–5. This is still not compatible with running
on Opus — re-dispatch to Haiku.

## 7. No mutations performed

Confirmed with `git status` at session start: only `.agents/handoffs/
session-16-final-audit.md` was dirty (untracked → committed by Session
16). No files were created, edited, or deleted by Session 17 before
this blocker file.

After writing this blocker file, the only other edits will be:
- This file itself (`.agents/session-17-blockers.md`) — new.
- `.agents/prompts/sessions/session-17-prompt.md` — append a short
  Session Notes entry pointing at this file (the prompt explicitly
  allows that).

No code, no package metadata, no tags, no commits, no publish.
