# Session Router Blocker

## Ambiguity
Rule R11 Paradox vs. Claude's Structural Disqualification from Template Following

## Details
Rule R11 (along with R17c) mandates that any validation session (e.g., 13v, 14av, 15v) MUST run on a different model family than the underlying implementation session. 

However, the empirical data from Session 14b explicitly disqualifies the Claude Opus 4.6 agent from tasks involving rigid markdown template adherence (Rule R10, R15) and zero-tolerance "ceremony." Claude skips pre-work steps, skips handoffs, and dodges mechanical tasks like quoting roadmap rows out of a compression reflex. 

Validation sessions are intrinsically the most rigid, template-bound logic chains in the entire pipeline — mandating gate pastes, mechanical verdict script transcriptions, and precise tabular grading against external code bases. **Claude is functionally disqualified from serving as a Validator.**

Since Gemini has been routed as the default driver for Implementation sessions (owing to Claude's reliability failures in standard task execution), it must theoretically *also* be assigned to the associated Validation sessions to guarantee the rigid review templates are actually filled out cleanly. This securely breaks Rule R11's cross-pollination intent, causing Gemini to validate Gemini.

## Unanswerable Question
For the remaining pipeline, should the human operator prioritize **template-compliance** (assigning Gemini to validate Gemini, requiring an explicit bypass of Rule R11), OR **adversarial separation** (assigning Claude to validate, risking catastrophic template failures, stripped checklists, and omitted `session-gate` prints)?

The currently rendered `pipeline-routing-plan.md` aggressively assumes template-compliance wins out and assigns Gemini to Validation sessions to prevent a process meltdown, but leaves this as a hard blocker requiring human acknowledgement against the contract structure.

## Resolution (2026-04-12)

Resolved in `antigravity-taxonomy.md` via two-pronged approach:

1. **Session 15 reclassificada para Claude Sonnet (Tier Medium).** Os failure modes que desqualificaram Claude (DC-1 a DC-6) foram observados especificamente com Opus, não com Sonnet. Cross-platform verification envolve bug-fixing ativo, não apenas execução mecânica. Resultado: Milestone B valida Session 15 com **cross-family compliance** (Claude Sonnet → Gemini Specialist).

2. **Session 16 permanece Gemini Base (R11 Exception documentada).** A auditoria final mecânica é o caso exato de DC-5 que desqualifica Claude. Para mitigar a validação same-family, Milestone B aplica a **Adversarial Checklist for Same-Family Review** definida em `antigravity-taxonomy.md` §4 e `_agent-mandate.md` §2.

**Decisão:** Template-compliance para Session 16 com mitigação explícita prevalece sobre adversarial separation pura. O paradoxo R11 é resolvido para 2 de 3 sessões restantes (15 e 17 são cross-family compliant), com exceção documentada e mitigada para Session 16.
