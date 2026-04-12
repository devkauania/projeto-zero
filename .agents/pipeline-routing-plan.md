> **SUPERSEDED** by `antigravity-taxonomy.md` as of Session 14bv completion (2026-04-12).
> Este documento é preservado como referência histórica. Para roteamento ativo, consulte `.agents/antigravity-taxonomy.md`.

# Pipeline Routing Plan

## Section 1 — Comparative-Advantage Criteria

Claude Opus 4.6 will only be assigned work if it strictly hits one of the following capability claims:

1. **Diagnosing Deep OS-Level or Sycall Failures:** Identifying and resolving runtime failures whose root cause lives in framework internals or OS constraints (e.g., Node child process signals, `TerminateProcess` on Windows, libuv nuances) where pattern-matching against specific internals saves a back-and-forth round-trip.
2. **High-Volume Scaffold Generation:** Fast creation of initial boilerplate or large file trees enforcing standard idiomatic code patterns (e.g., Session 3 @TurboScaffolder) where overall volume of correct generation matters more than strict adherence to novel repo rules.
3. **Multi-File Architectural Refactoring:** Surgical refactors where the agent must hold an inconsistent state in mind across 5+ interdependent files at once and converge on a coherent end state in a single execution pass.
4. **Targeted Deep-Internal Bug Fixes:** Implementing single-file bug fixes responding to failing acceptance tests that require complex, undocumented Node.js or stream pipeline knowledge, devoid of scaffolding overhead.
5. **Pure Logic Abstraction:** Refactoring deeply nested loop structures, complex AST manipulation, or synchronous data pipeline code into cleaner representations without requiring mocked OS environment execution context.

## Section 2 — Disqualifying Criteria for Claude

Claude Opus 4.6 MUST NOT be assigned to work containing the following profiles, leveraging data from the `session-14b` errors and `process-hardening` logs:

1. **Template-Driven Rigidity:** Sessions where the primary deliverable is strictly following a markdown template (e.g., `_session-template.md`). Failure mode: compression reflex causes Claude to implicitly skip "ceremony" steps like mandatory summaries and handoffs.
2. **Mechanical Next-Step Bridging:** Work requiring copy-pasting adherence to exact roadmap rows. Failure mode: self-protective rationalization causing Claude to invent fake ambiguity instead of mechanically quoting the prompt (Rule R17 violation).
3. **Static File Checker Passing:** Sessions whose definition of "done" relies heavily upon passing rigid static bash scripts (`files-exist.mjs`, `placeholder-scan.mjs`) by mutating configurations. Failure mode: Claude stops at "technically compiles" or fabricates implementations (Session 11 `repository.url`).
4. **Documentation requiring No Invention:** Writing official project documentation where exact string-matching matters and the agent must not hypothesize missing data. Failure mode: Inserting placeholder text that immediately fails `scripts/placeholder-scan.mjs`.
5. **Cross-Platform Strict Execution:** Verification tasks across multiple targets requiring patient, literal console execution to prove assumptions. Failure mode: the exact Session 11 gap of silently applying untested Windows-only assumptions while claiming cross-platform success.
6. **Compliance-Heavy Validations (Read-Only):** Validation sessions whose entire deliverable is executing other agents' outputs mechanically, filling out a `PASS/FAIL` table securely, and emitting a raw string via script. Failure mode: skipped compliance sections.

## Section 3 — Per-Session Routing Table

| Sessão | Deliverable (1 line) | Default driver | Reason | Claude hand-off block? |
|--------|----------------------|----------------|--------|------------------------|
| Sessão 7 | Strict E2E audit of phase 2 commands | Gemini 3.1 | Disqualifying Criterion #5 (Requires literal execution) | No |
| Sessão 13 | Write README and fix repository.url without placeholders | Gemini 3.1 | Disqualifying Criterion #4 (Documentation / exact strings) | No |
| Sessão 13v | Read-only validation of Session 13 | Gemini 3.1 | Disqualifying Criterion #6 (template-following) | No |
| Sessão 14a | Write failing acceptance tests for CLI error cases | Gemini 3.1 | Disqualifying Criterion #1 (Requires strict R13 template adherence) | No |
| Sessão 14av | Read-only validation of Session 14a | Gemini 3.1 | Disqualifying Criterion #6 (template-following) | No |
| Sessão 14b | Turn 14a error-path tests green without weakening them | Claude Opus 4.6 | Advantage Criterion #1 (Diagnosing OS-level syscalls) | No |
| Sessão 14bv | Read-only validation of Session 14b | Gemini 3.1 | Disqualifying Criterion #6 (template-following) | No |
| Sessão 15 | Verify install & execution across 4 operating systems | Gemini 3.1 | Disqualifying Criterion #5 (Cross-platform rigid execution) | Yes — see §4.1 |
| Sessão 15v | Read-only validation of Session 15 | Gemini 3.1 | Disqualifying Criterion #6 (template-following) | No |
| Sessão 16 | Final E2E audit of all project specs | Gemini 3.1 | Disqualifying Criterion #5 (Rigid execution over narrative) | No |
| Sessão 16v | Read-only validation of Session 16 | Gemini 3.1 | Disqualifying Criterion #6 (template-following) | No |
| Sessão 17 | Publish package, bump semver, verify tarball | Gemini 3.1 | Disqualifying Criterion #1 & #6 (Compliance-heavy, zero tolerance) | No |
| Sessão 17v | Read-only post-publish validation | Gemini 3.1 | Disqualifying Criterion #6 (template-following) | No |

## Section 4 — Mid-Session Hand-Off Blocks

### 4.1 Sessão 15 — Claude OS-Diagnostic Escalation

**Trigger condition:** 
During the execution of Sessão 15 by Gemini, if `npm run preflight` or manual E2E verification across any of the 4 stated platforms explicitly fails due to a deeply nested Node.js OS boundary error (e.g., `EACCES` handling failures on Windows environments, `TerminateProcess` quirks, unhandled `readline` TTY misfires on macOS) that Gemini cannot patch natively in one attempt.

**Why Claude:** 
Invokes Section 1 Capability Claim #1 (Diagnosing failures whose root cause lives in framework internals or OS-level syscalls).

**Literal Claude Prompt:** 
```text
@Claude, you are a localized OS bug-fixer functioning as a sub-routine for Gemini. 

Read:
1. `apps/cli/src/commands/<failing_file>.ts`
2. `.agents/cross-platform-report.md` (read ONLY the section describing the current OS bug)

Mission:
1. Diagnose the OS-specific implementation failure described in the cross-platform report.
2. Provide a surgical diff or rewritten function for the target file that handles the OS edge case natively and allows the execution to complete.
3. Stop and emit the diff. 

Hard Scope Fence:
- ALLOWED: `apps/cli/src/commands/<failing_file>.ts` or `apps/cli/src/lib/`.
- FORBIDDEN: `.agents/prompts/**`, `scripts/**`, `PROJECT_ROADMAP.md`, `package.json`, `.agents/handoffs/**`.

Forbidden Behaviors:
- DO NOT answer with a written handoff document or a Self-Grading Table.
- DO NOT generate a next-session prompt (Rule R17 is strictly suspended for this call).
- NO EXPLANATORY CEREMONY. Emit the exact diff/code block and a maximum of 3 sentences explaining the internal OS mechanic causing the divergence.

Return Condition:
Gemini will take your code block, patch the file, and re-run the OS test. If the test still fails, Gemini will ask you exactly ONCE with the updated stack trace. If the second attempt fails, Gemini will escalate to the human immediately.
```

## Section 5 — Sessions Where Claude is the Default Driver

*(Note: Although Session 14b has already been successfully concluded by the human, it is the sole session in the remaining queue mapping logically to Claude. If it is re-run for compliance reasons or repurposed, the precise invocation must adhere to the prompt below. No other uncompleted session warrants Claude as default driver.)*

```markdown
# Prompt — Session 14b (@ErrorPathFixer) 

## Compliance Pre-Check (MANDATORY)
Before executing any tool call other than "Read", you MUST acknowledge the following three failure modes you exhibited in a previous run of this exact session:
1. You skipped the mandatory pre-work read-and-summarize step from `_session-template.md`.
2. You skipped writing the handoff document entirely until caught by the human.
3. You dodged rule R17 compliance by inventing fake ambiguity instead of mechanically copy-pasting the next-session string from the roadmap.
Acknowledge these explicitly in your first response and state how you will avoid them.

## Tripwire
Human Operator: If Claude's first response does not contain BOTH the pre-work summaries AND the explicit compliance pre-check acknowledgments of its 3 past failure modes, ABORT this session immediately and re-route the implementation task to Gemini.

## Before You Do Anything
Read in full, in order, and paste a 1-line summary of each in your first response proving you actually read them:
1. `.agents/prompts/_production-contract.txt`
2. `.agents/project-specs.md`
3. `.agents/PROJECT_ROADMAP.md`
4. `.agents/session-14a-error-path-tests.md`
Do NOT begin work until the summaries are posted.

## Mission
1. Make tests pass by ensuring the `init` interactive flow terminates gracefully (exits 0, no stack trace) under SIGINT.
2. Ensure `init` traps the `saveConfig` failure caused by a read-only `ANTIGRAVITY_CONFIG_DIR`, returning `process.exit(1)`.
3. Modifications must be strictly confined to `apps/cli/src/commands/` and `apps/cli/src/lib/`. The assertions inside `error-paths.test.ts` must not be weakened or changed.

## Hard Constraints
- No edits outside the declared files list.
- Rule R12: if anything is ambiguous, STOP and write `.agents/session-14b-blockers.md`.
- Rule R9: Execute the check. Reading code is not verification.

## Acceptance Criteria
- `node scripts/preflight.mjs` exits 0 at end of session.
- `node scripts/session-gate.mjs` exits 0 (rule R15).
- Every Mission bullet appears as a DONE row in the Self-Grading Table.

## Deliverables
- `apps/cli/src/commands/init.ts`
- `.agents/session-14b-error-path-fixes.md` (adhering strictly to `.agents/prompts/_handoff-template.md`)

## Handoff Format
Follow `.agents/prompts/_handoff-template.md` exactly. All six sections are required. The verdict is a paste of `node scripts/verdict.mjs` output — do not type it by hand (rule R14).

## Next-Session Prompt Protocol
Before producing any "next session" prompt, you MUST find the FIRST row whose checkbox is `[ ]` or `[~]`, quote it verbatim in your reply, and formulate the prompt mechanically targeting the correctly typed agent.
```

## Section 6 — Honest Risk Assessment

The most dangerous systemic risk in this routing plan is the mechanical breaking of **Rule R11**. By assigning Gemini as the Default Driver to Validation sessions (because Claude is intrinsically disqualified from template-following ceremony steps per session-14b data), Gemini will now end up Validating its own Implementations (e.g., Sessão 15 followed by 15v, both executed by Gemini). If Gemini operates under a consistent blind-spot when parsing a directive, it will blindly grade itself `GO`, circumventing the entire premise of the adversarial split validation architecture. 

*(A dedicated `.agents/session-router-blockers.md` file has been authored flagging this Catch-22 so the human operator can render a judgment on amending Rule R11).*

Additionally, routing **Sessão 7** to Gemini might cause context shock. Sessão 7 predates the strict R13 Acceptance Test chain structure. Because it relies on verifying logic mapped in earlier (Claude-led) phases with less rigorous tracking, Gemini may find missing test artifacts and freeze up or hallucinately flag errors that reflect the looser older sessions rather than current pipeline defects. If Sessão 7 fails mechanically, it should be formally reconciled or deprecated manually by the human.

Lastly, the **Claude Hand-Off in Sessão 15** acts under the assumption that Claude will only provide a clean diff. If Claude's RLHF safety mechanisms trigger a narrative spiral or attempt to rewrite dependencies during an isolated mid-session Hand-off, the pipeline halts until the human steps in, making zero-friction execution an optimistic ceiling rather than a guarantee.
