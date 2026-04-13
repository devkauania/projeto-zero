# Milestone B — @MilestoneReviewer

> **Modelo:** Gemini 3.1 Pro | **Tier:** Gemini Specialist
> **Status:** PENDING
> **Este arquivo:** `.agents/prompts/sessions/milestone-b-prompt.md`
> **O agente PODE editar este arquivo** para adicionar notas na secao "Session Notes".

---

## Before You Do Anything

Read in full and paste a 1-line summary of each:

0. `.agents/prompts/_agent-mandate.md` (secao 2: Milestone Reviewers)
1. `.agents/prompts/_production-contract.txt`
2. `.agents/PROJECT_ROADMAP.md`
3. `.agents/handoffs/session-15-cross-platform.md`
4. `.agents/handoffs/session-16-final-audit.md`
5. `.agents/final-audit.md`
6. `.agents/antigravity-taxonomy.md` (secao §4: Adversarial Checklist)

---

## Mission — Validacao Consolidada de Sessions 15 + 16

Este Milestone substitui as validacoes individuais 15v e 16v. Cross-family para Session 15 (Claude Sonnet -> Gemini Specialist = COMPLIANT). Same-family para Session 16 (Gemini Base -> Gemini Specialist = EXCEPTION com adversarial checklist). Regra R9: EXECUTAR cada check, nao raciocinar sobre ele.

| # | Bullet |
|---|--------|
| 1 | Rodar `npm run gate` — colar output completo. |
| 2 | Rodar `npm run verdict` — colar output completo. |
| 3 | Ler handoff de Session 15 (`.agents/handoffs/session-15-cross-platform.md`). Para CADA row na Self-Grading Table, verificar independentemente que a evidencia e real (grep, ls, ou rerun do comando). |
| 4 | Ler handoff de Session 16 (`.agents/final-audit.md`). Para CADA row na tabela de requisitos, verificar que o PASS e sustentado por evidencia literal (nao narrativa). |
| 5 | **Adversarial Checklist para Session 16 (same-family):** (a) Verificar que outputs sao literais e nao genericos. (b) `ls ./audit-output` confirma arquivos existem. (c) Buscar padrao "technically compiles" — claims sem execution evidence. (d) Verificar que cross-platform outputs em Session 15 mostram prompts de cada shell individualmente. |
| 6 | Emitir GO / NO-GO consolidado. |

---

## Hard Constraints

- Esta sessao e **READ-ONLY** — NAO modificar nenhum arquivo do projeto.
- NAO confiar em narrativa dos handoffs — EXECUTAR cada check independentemente.
- Verdito e mecanico: todos os checks PASS = GO. Qualquer FAIL = NO-GO.
- **R11 Exception Handling**: Session 16 e same-family (Gemini Base -> Gemini Specialist). O adversarial checklist (bullet 5) e OBRIGATORIO para mitigar.

---

## Adversarial Checklist Detail (Same-Family Review — Session 16)

O reviewer DEVE executar TODOS estes checks ao revisar output de Gemini Base:

1. **Evidence Literality** — Para cada teste descrito como "executado" no handoff de Session 16, verificar se o output literal completo foi colado (nao apenas "all tests pass" ou "verified").
2. **File Existence** — Para cada arquivo descrito como "criado" ou "verificado", executar `ls` para confirmar existencia real no disco.
3. **Anti-"Technically Compiles"** — Buscar claims de completude sem evidencia de execucao E2E real. Comparar contra o padrao da Session 11.
4. **Per-Platform Output** — Para claims cross-platform, exigir output separado de CADA plataforma individualmente. Generalizacoes como "works on all platforms" sao automaticamente FAIL.
5. **Spec-by-Spec Diff** — Verificar que cada requirement em `project-specs.md` tem um PASS com evidencia, nao apenas um checkmark narrativo.

---

## Acceptance Criteria

```
[ ] AC-1:  `npm run gate` exit 0 — output colado
[ ] AC-2:  `npm run verdict` output colado
[ ] AC-3:  Session 15 — cada row da Self-Grading Table verificada independentemente
[ ] AC-4:  Session 16 — cada row da tabela de requisitos verificada
[ ] AC-5:  Adversarial Checklist completa (5 items) — cada com resultado explicito
[ ] AC-6:  GO / NO-GO emitido com justificativa
```

---

## Anti-Gaming Tripwires

1. Se o reviewer emite GO sem executar o adversarial checklist para Session 16: FAIL.
2. Se algum check e marcado PASS sem execucao independente (apenas confiando no handoff): FAIL.
3. Se o verdito nao e mecanico (inventou justificativa para ignorar FAIL): FAIL.

---

## Deliverable

- `.agents/validations/milestone-b-validation.md`

## Next-Session Protocol

Next session: **Session 17 (@Publisher)** — Claude Haiku 4.6
Prompt file: `.agents/prompts/sessions/session-17-prompt.md`

---

## Session Notes

_(O agente pode adicionar notas aqui durante a sessao)_
