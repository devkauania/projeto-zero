# Session 14e — @GateHardener

> **Modelo:** Claude Sonnet 4.6 (`claude-sonnet-4-6`) | **Tier:** Medium
> **Status:** PENDING
> **Este arquivo:** `.agents/prompts/sessions/session-14e-prompt.md`
> **O agente PODE editar este arquivo** para documentar blockers, mudancas de escopo,
> ou notas durante a sessao. Adicionar ao final na secao "Session Notes".

---

## Before You Do Anything

Read in full, in order, and paste a 1-line summary of each:

0. `.agents/prompts/_agent-mandate.md`
1. `.agents/prompts/_production-contract.txt`
2. `.agents/PROJECT_ROADMAP.md`
3. `.agents/handoffs/session-14c-build-remediation.md`
4. `.agents/plano-sessoes-restantes.md` (secao "Sessao 14e" apenas)
5. `scripts/session-gate.mjs` (codigo a modificar)
6. `scripts/verdict.mjs` (codigo a modificar)
7. `apps/cli/scripts/copy-seed.mjs` (codigo a modificar)

Do NOT begin work until the summaries are posted.

## Compliance Pre-Check (MANDATORIO)

1. **STATE LOG** — Declare estado atual, arquivos lidos, escopo entendido.
2. **SCOPE DECLARATION** — Liste os 3 arquivos a modificar, 1 a criar, ordem de operacoes.
3. So entao proceda.

---

## Mission

| # | Bullet | Issue |
|---|--------|-------|
| 1 | Fix `scripts/session-gate.mjs`: a funcao `detectSessionNumber()` usa regex `Sess(?:ao|ao)\s+(\d+)` que ja aceita "Sessao" e "Sessao". Verificar se TAMBEM aceita "Session" (ingles). Se nao, expandir para aceitar `Sess(?:ao|ao|ion)\s+(\d+)`. Testar rodando `SESSION_NUMBER=14 node scripts/session-gate.mjs` e verificar que funciona. | M4 |
| 2 | Fix `scripts/verdict.mjs`: ler o arquivo e encontrar onde o resultado do preflight e parseado. Se o regex de parsing falha (nao encontra "PASS" nem "FAIL"), o script DEVE emitir "PARSE-ERROR" no output e exit com codigo non-zero (1 ou 2). Atualmente pode emitir "unknown" ou silenciar o erro. | M5 |
| 3 | Fix `apps/cli/scripts/copy-seed.mjs`: apos copiar o seed file, adicionar validacao que le o arquivo copiado e faz `JSON.parse()`. Se o parse falha, emitir mensagem de erro e `process.exit(1)`. O build NAO deve passar se o seed copiado e JSON invalido. | M6 |
| 4 | Executar `npm run build` — DEVE exit 0. Colar output. | Verify |
| 5 | Executar `npm run test` — DEVE exit 0, >= 48 testes. Colar output. | Verify |
| 6 | Executar `npm run preflight` — DEVE exit 0. Colar output. | Verify |

---

## Hard Constraints

- **NAO modificar codigo de producao** em `apps/cli/src/`.
- **NAO modificar testes** em `apps/cli/src/__tests__/`.
- **NAO modificar `scripts/preflight.mjs`** (orquestrador).
- **Rule R12**: Se algo e desconhecido, escrever `.agents/session-14e-blockers.md`.
- **Rule R9**: Execute e cole output.

---

## Scope Fence

```
MODIFICAR:
- scripts/session-gate.mjs (regex bilingue)
- scripts/verdict.mjs (parse-error handling)
- apps/cli/scripts/copy-seed.mjs (JSON validation pos-copia)

CRIAR:
- .agents/handoffs/session-14e-gate-hardener.md (handoff)

PERMITIDO EDITAR:
- .agents/prompts/sessions/session-14e-prompt.md (ESTE ARQUIVO)

PROIBIDO:
- apps/cli/src/** (codigo de producao e testes)
- scripts/preflight.mjs
- scripts/placeholder-scan.mjs
- .agents/prompts/_* (templates)
- .agents/PROJECT_ROADMAP.md
```

---

## Acceptance Criteria

```
[ ] AC-1:  `npm run build` exit 0 — output colado
[ ] AC-2:  `npm run test` exit 0, >= 48 testes — output colado
[ ] AC-3:  `npm run preflight` exit 0 — output colado
[ ] AC-4:  `grep -E 'Sess.*(ao|ao|ion)' scripts/session-gate.mjs` mostra pattern expandido
[ ] AC-5:  `grep -i 'parse.error' scripts/verdict.mjs` retorna >= 1 match
[ ] AC-6:  `grep 'JSON.parse' apps/cli/scripts/copy-seed.mjs` retorna >= 1 match
```

---

## Anti-Gaming Tripwires

1. Se `npm run build` NAO exit 0: FAIL.
2. Se algum teste existente falha: FAIL (regression).
3. Se o agente remove checks do preflight/verdict para fazer passar: FAIL.

---

## Handoff Format

Follow `.agents/prompts/_handoff-template.md`.
Gate: `SESSION_NUMBER=14 node scripts/session-gate.mjs`
Verdict: `node scripts/verdict.mjs`

## Next-Session Protocol

Next session: **Milestone A2 (@PreFlightValidator)** — Gemini 3.1 Pro
Prompt file: `.agents/prompts/sessions/milestone-a2-prompt.md`

---

## Session Notes

_(O agente pode adicionar notas aqui durante a sessao)_
