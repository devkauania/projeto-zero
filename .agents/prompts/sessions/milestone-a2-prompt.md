# Milestone A2 — @PreFlightValidator

> **Modelo:** Gemini 3.1 Pro | **Tier:** Gemini Specialist
> **Status:** PENDING
> **Este arquivo:** `.agents/prompts/sessions/milestone-a2-prompt.md`
> **O agente PODE editar este arquivo** para adicionar notas na secao "Session Notes".

---

## Before You Do Anything

Read in full and paste a 1-line summary of each:

0. `.agents/prompts/_agent-mandate.md` (secao 2: Milestone Reviewers)
1. `.agents/prompts/_production-contract.txt`
2. `.agents/PROJECT_ROADMAP.md`
3. `.agents/handoffs/session-14c-build-remediation.md`
4. `.agents/handoffs/session-14d-test-hardener.md`
5. `.agents/handoffs/session-14e-gate-hardener.md`

---

## Mission — Validacao Consolidada de 14c + 14d + 14e

Este Milestone valida as 3 sessoes de remediacao. Cross-family: Claude (Sonnet) implementou, Gemini (Specialist) valida. Regra R9: EXECUTAR cada check, nao raciocinar sobre ele.

| # | Bullet |
|---|--------|
| 1 | `npm run build` — verificar exit 0. Colar output. |
| 2 | `npm run test` — verificar exit 0, >= 48 testes. Colar output. |
| 3 | `npm run preflight` — verificar exit 0. Colar output. |
| 4 | `SESSION_NUMBER=14 node scripts/session-gate.mjs` — verificar exit 0. Colar output. |
| 5 | `ls apps/cli/*.tgz 2>&1` — deve retornar "No such file". Colar output. |
| 6 | `grep tgz .gitignore` — deve mostrar pattern. Colar output. |
| 7 | `wc -l CHANGELOG.md` — deve retornar > 0 linhas. Colar output. |
| 8 | `grep 'projeto-zero-cli-0.1.0' apps/cli/package.json; echo "exit: $?"` — deve mostrar exit 1. Colar output. |
| 9 | `grep -A5 'JSON.parse' apps/cli/src/lib/fs-utils.ts` — deve mostrar catch block. Colar output. |
| 10 | `grep -E 'SIGINT\|isTTY\|installSigint' apps/cli/src/commands/reset.ts` — deve retornar >= 1 match. Colar output. |
| 11 | `ls apps/cli/src/__tests__/generate-command.test.ts apps/cli/src/__tests__/reset-command.test.ts` — deve listar ambos. Colar output. |
| 12 | `git log --oneline` — verificar que commits existem. Colar output. |
| 13 | Emitir **GO** ou **NO-GO** consolidado. Se NO-GO, listar EXATAMENTE quais checks falharam. |

---

## Hard Constraints

- Esta sessao e **READ-ONLY** — NAO modificar nenhum arquivo do projeto.
- NAO confiar em narrativa dos handoffs — EXECUTAR cada check independentemente.
- Verdito e mecanico: todos os 12 checks PASS = GO. Qualquer FAIL = NO-GO.

---

## Deliverable

- `.agents/validations/milestone-a2-validation.md`

## Next-Session Protocol

Next session: **Session 15 (@CrossPlatformVerifier)** — Claude Sonnet 4.6
Prompt file: `.agents/prompts/sessions/session-15-prompt.md`

---

## Session Notes

_(O agente pode adicionar notas aqui durante a sessao)_
