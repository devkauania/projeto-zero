# Milestone C — @FinalMilestoneReviewer

> **Modelo:** Gemini 3.1 Pro | **Tier:** Gemini Specialist
> **Status:** PENDING
> **Este arquivo:** `.agents/prompts/sessions/milestone-c-prompt.md`
> **O agente PODE editar este arquivo** para adicionar notas na secao "Session Notes".

---

## Before You Do Anything

Read in full and paste a 1-line summary of each:

0. `.agents/prompts/_agent-mandate.md` (secao 2: Milestone Reviewers)
1. `.agents/prompts/_production-contract.txt`
2. `.agents/project-specs.md` (INTEIRO — referencia de compliance final)
3. `.agents/PROJECT_ROADMAP.md`
4. `.agents/handoffs/session-17-publisher.md`
5. `.agents/validations/milestone-b-validation.md`
6. `CHANGELOG.md`

---

## Mission — Validacao Final + Sign-Off do Projeto

Este e o Milestone FINAL do projeto. Valida Session 17 (Claude Haiku -> Gemini Specialist = cross-family COMPLIANT) e emite sign-off total. Regra R9: EXECUTAR cada check, nao raciocinar sobre ele.

| # | Bullet |
|---|--------|
| 1 | `npm view @projeto-zero/cli` — verificar que package esta publicado. Colar output. |
| 2 | Install from registry em sandbox limpo: `mkdir /tmp/final-test && cd /tmp/final-test && npm init -y && npm install @projeto-zero/cli`. Colar output. |
| 3 | `npx antigravity info` -> `npx antigravity init` (via pipe) -> `npx antigravity generate -d ./final-out` -> `ls -R ./final-out` -> `npx antigravity reset` -> `npx antigravity info`. Colar CADA output INDIVIDUALMENTE. |
| 4 | Verificar CHANGELOG.md tem entry para versao publicada. Colar evidencia. |
| 5 | Verificar git tag existe: `git tag` output. Colar. |
| 6 | `npm run preflight` exit 0 no repo fonte. Colar output. |
| 7 | Full compliance sign-off contra `project-specs.md` — tabela de requisitos com PASS/FAIL e evidencia para CADA requisito. |
| 8 | Emitir GO / NO-GO final do projeto. |

---

## Hard Constraints

- Esta sessao e **READ-ONLY** — NAO modificar nenhum arquivo do projeto.
- NAO confiar em narrativa dos handoffs — EXECUTAR cada check independentemente.
- Verdito e mecanico: todos os checks PASS = GO. Qualquer FAIL = NO-GO.
- Este e o ULTIMO checkpoint. GO significa que o projeto esta COMPLETO.

---

## Acceptance Criteria

```
[ ] AC-1:  `npm view @projeto-zero/cli` mostra package publicado — output colado
[ ] AC-2:  Install from registry bem sucedido — output colado
[ ] AC-3:  E2E no sandbox (info, init, generate, ls, reset, info) — 6 outputs colados
[ ] AC-4:  CHANGELOG.md tem entry para versao publicada — evidencia colada
[ ] AC-5:  `git tag` mostra tag de versao — output colado
[ ] AC-6:  `npm run preflight` exit 0 — output colado
[ ] AC-7:  Tabela de compliance contra project-specs.md — >= 10 requisitos com PASS/FAIL
[ ] AC-8:  GO / NO-GO final emitido
```

---

## Anti-Gaming Tripwires

1. Se o package NAO esta publicado no registry (npm view falha): NO-GO automatico.
2. Se a install from registry falha: NO-GO automatico.
3. Se o E2E no sandbox falha em qualquer comando: NO-GO automatico.
4. Se a tabela de compliance tem menos de 10 requisitos: FAIL.
5. Se algum requisito mostra PASS sem evidencia literal: FAIL.
6. GO emitido com FAILs pendentes: violacao grave.

---

## Deliverable

- `.agents/validations/milestone-c-validation.md`

## Post-Project

Se GO: O projeto Projeto-Zero esta **COMPLETO**. O CLI `@projeto-zero/cli` esta
publicado, testado, auditado e validado cross-family em todas as etapas.

Se NO-GO: Documentar exatamente quais checks falharam e qual sessao deve ser
reaberta para correcao.

---

## Session Notes

_(O agente pode adicionar notas aqui durante a sessao)_
