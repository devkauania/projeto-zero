# Milestone C — @FinalMilestoneReviewer

> **Modelo:** Claude Opus 4.6 (`claude-opus-4-6`) | **Tier:** High
> **Policy:** Single-family (see `.agents/vendor-policy.json`)
> **Status:** PENDING
> **Este arquivo:** `.agents/prompts/sessions/milestone-c-prompt.md`
> **O agente PODE editar este arquivo** para adicionar notas na secao "Session Notes".
>
> **Note on model routing:** Under the project's `single-family` policy
> (`.agents/vendor-policy.json`), Milestone reviews route to Claude Opus
> 4.6 with the Adversarial Checklist MANDATORY. If the operator restores
> cross-family access and flips the policy back to `cross-family`, this
> prompt should be re-targeted at Gemini 3.1 Pro.

---

## Before You Do Anything

Read in full and paste a 1-line summary of each:

0. `.agents/prompts/_agent-mandate.md` (secao 2: Milestone Reviewers, policy-aware)
1. `.agents/prompts/_production-contract.txt` (R11 and R17(c) are policy-aware)
2. `.agents/vendor-policy.json` (declares single-family + Claude)
3. `.agents/project-specs.md` (INTEIRO — referencia de compliance final)
4. `.agents/PROJECT_ROADMAP.md`
5. `.agents/handoffs/session-17-publisher.md` (the REAL Session 17 handoff, not the halt-record)
6. `.agents/validations/milestone-b-validation.md`
7. `CHANGELOG.md`
8. `.agents/antigravity-taxonomy.md` (secao §0 Vendor Policy + §4 Adversarial Checklist)

---

## Mission — Final Validation + Project Sign-Off

Este e o Milestone FINAL do projeto. Valida Session 17 sob `policy: single-family`
(Claude Haiku -> Claude Opus = same-family with MANDATORY adversarial checklist).
Regra R9: EXECUTAR cada check, nao raciocinar sobre ele.

| # | Bullet |
|---|--------|
| 1 | `npm view @projeto-zero/cli` — verificar que package esta publicado. Colar output. |
| 2 | Install from registry em sandbox limpo: `mkdir /tmp/final-test && cd /tmp/final-test && npm init -y && npm install @projeto-zero/cli`. Colar output. |
| 3 | `npx antigravity info` -> `npx antigravity init` (via pipe) -> `npx antigravity generate -d ./final-out` -> `ls -R ./final-out` -> `npx antigravity reset` -> `npx antigravity info`. Colar CADA output INDIVIDUALMENTE. |
| 4 | Verificar CHANGELOG.md tem entry para versao publicada. Colar evidencia. |
| 5 | Verificar git tag existe: `git tag` output. Colar. |
| 6 | `npm run preflight` exit 0 no repo fonte. Colar output. |
| 7 | Full compliance sign-off contra `project-specs.md` — tabela de requisitos com PASS/FAIL e evidencia para CADA requisito. |
| 8 | **Adversarial Checklist (MANDATORY under single-family policy):** execute all 5 checks from `antigravity-taxonomy.md` §4 against Session 17's handoff. Each check must have an explicit result. |
| 9 | Emitir GO / NO-GO final do projeto. |

---

## Hard Constraints

- Esta sessao e **READ-ONLY** — NAO modificar nenhum arquivo do projeto.
- NAO confiar em narrativa dos handoffs — EXECUTAR cada check independentemente.
- Verdito e mecanico: todos os checks PASS = GO. Qualquer FAIL = NO-GO.
- Este e o ULTIMO checkpoint. GO significa que o projeto esta COMPLETO.
- **Under single-family policy: the Adversarial Checklist is MANDATORY,
  not optional.** Skipping any of the 5 checks is a protocol violation.

---

## Acceptance Criteria

```
[ ] AC-1:  `npm view @projeto-zero/cli` mostra package publicado — output colado
[ ] AC-2:  Install from registry bem sucedido — output colado
[ ] AC-3:  E2E no sandbox (info, init, generate, ls, reset, info) — 6 outputs colados
[ ] AC-4:  CHANGELOG.md tem entry para versao publicada — evidencia colada
[ ] AC-5:  `git tag` mostra tag de versao — output colado
[ ] AC-6:  `npm run preflight` exit 0 — output colado
[ ] AC-7:  Tabela de compliance contra project-specs.md — cada requisito com PASS/FAIL e evidencia
[ ] AC-8:  Adversarial Checklist — 5/5 checks executados com resultado explicito
[ ] AC-9:  GO / NO-GO final emitido
```

---

## Anti-Gaming Tripwires

1. Se o package NAO esta publicado no registry (npm view falha): NO-GO automatico.
2. Se a install from registry falha: NO-GO automatico.
3. Se o E2E no sandbox falha em qualquer comando: NO-GO automatico.
4. Se algum requisito mostra PASS sem evidencia literal: FAIL.
5. GO emitido com FAILs pendentes: violacao grave.
6. **Adversarial Checklist skipped or partially executed under single-family
   policy: automatic FAIL.** (This tripwire replaces the cross-family
   separation that single-family policy opts out of.)

---

## Deliverable

- `.agents/validations/milestone-c-validation.md`

## Post-Project

Se GO: O projeto Projeto-Zero esta **COMPLETO**. O CLI `@projeto-zero/cli` esta
publicado, testado, auditado e validado conforme a policy declarada em
`.agents/vendor-policy.json`.

Se NO-GO: Documentar exatamente quais checks falharam e qual sessao deve ser
reaberta para correcao.

---

## Session Notes

_(O agente pode adicionar notas aqui durante a sessao)_
