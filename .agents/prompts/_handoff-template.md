# Session <N> Handoff — <AgentName>

> Mandatory structure. All six sections required. Rule R10 + R14 + R15.

## 1. Scope

One paragraph: what this session was asked to do, what is explicitly out
of scope. If scope changed mid-session, say so.

## 2. Files Touched

Bullet list of every file created, modified, or deleted. Out-of-list edits
are a contract violation — list them honestly and flag them.

## 3. Self-Grading Table

One row per numbered Mission bullet from the session prompt. Status must
be one of DONE, PARTIAL, SKIPPED, BLOCKED.

| # | Bullet                          | Status | Evidence                  |
|---|---------------------------------|--------|---------------------------|
| 1 | <copy bullet 1 verbatim>        | DONE   | `<path or command proof>` |
| 2 | <copy bullet 2 verbatim>        | DONE   | `<path or command proof>` |

If any row is not DONE, the Verdict section below CANNOT show
PRODUCTION-READY (rule R10 + R14 enforced by `scripts/session-gate.mjs`).

## 4. Gate Transcript

Paste the full, unedited output of `node scripts/session-gate.mjs` here
in a fenced block. Rule R15.

```
<paste>
```

## 5. Verdict

Paste the full, unedited output of `node scripts/verdict.mjs` here in a
fenced block. Rule R14 — never type this by hand.

```
<paste>
```

## 6. Errors Encountered and How They Were Fixed

Honest log. If none, say "none" — but be very sure. Contract rule 6.

- <error 1> → <fix>
- <error 2> → <fix>

## 7. Known Gaps for the Next Session

What you did not close, and which session (by number) is responsible.
Used by the next session's prompt author to scope the follow-up.

- <gap 1> → Session <M>
- <gap 2> → Session <M>

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
