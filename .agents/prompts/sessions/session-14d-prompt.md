# Session 14d — @TestHardener

> **Modelo:** Claude Sonnet 4.6 (`claude-sonnet-4-6`) | **Tier:** Medium
> **Status:** PENDING
> **Este arquivo:** `.agents/prompts/sessions/session-14d-prompt.md`
> **O agente PODE editar este arquivo** para documentar blockers, mudancas de escopo,
> ou notas durante a sessao. Adicionar ao final na secao "Session Notes".

---

## Before You Do Anything

Read in full, in order, and paste a 1-line summary of each in your first
response proving you actually read them:

0. `.agents/prompts/_agent-mandate.md`
1. `.agents/prompts/_production-contract.txt`
2. `.agents/project-specs.md`
3. `.agents/PROJECT_ROADMAP.md`
4. `.agents/handoffs/session-14c-build-remediation.md`
5. `.agents/plano-sessoes-restantes.md` (secao "Sessao 14d" apenas)
6. `apps/cli/src/commands/generate.ts` (codigo a testar)
7. `apps/cli/src/commands/reset.ts` (codigo a testar)
8. `apps/cli/src/lib/fs-utils.ts` (funcao readJsonFile a testar)
9. `apps/cli/src/__tests__/error-paths.test.ts` (referencia de padrao)
10. `apps/cli/src/__tests__/fs-utils.test.ts` (referencia de padrao)

Do NOT begin work until the summaries are posted.

## Compliance Pre-Check (MANDATORIO — Ciclo Plan-and-Execute)

Antes de executar QUALQUER tool call alem de "Read":

1. **STATE LOG** — Declare:
   - Quais arquivos leu e resumo de 1 linha de cada.
   - Estado atual: build OK, 40 testes green, preflight ALL PASS.
   - Seu entendimento do escopo (6 bullets, 2 arquivos a criar, 2 a modificar).

2. **SCOPE DECLARATION** — Liste mecanicamente:
   - Os 2 arquivos exatos que vai criar.
   - Os 2 arquivos exatos que vai modificar.
   - A contagem de testes planejada por arquivo.
   - A ordem de operacoes planejada (passo a passo numerado).

3. So entao proceda a execucao.

**Tripwire:** Se a primeira resposta do agente NAO contem TANTO os resumos
dos 11 arquivos lidos QUANTO o state log + scope declaration, ABORT a sessao.

---

## Mission

| # | Bullet | Issue |
|---|--------|-------|
| 1 | Criar `apps/cli/src/__tests__/generate-command.test.ts` com >= 3 testes: (a) generate sem config mostra "run init first" e retorna sem crash — testar via `spawn` do CLI real com `['generate', '-d', tmpdir]` e verificar stdout contem "init" e exit code 0, (b) generate com config valida e `--dir` cria arquivos no dir correto — salvar config, depois spawn `generate -d <tmpdir>`, verificar que arquivos foram criados, (c) generate com dir read-only falha com exit 1 e mensagem de erro sem stack trace — criar dir com `chmod 0o444`, spawn generate, verificar exit code 1 e stderr sem stack trace. | M3 |
| 2 | Criar `apps/cli/src/__tests__/reset-command.test.ts` com >= 3 testes: (a) reset sem config mostra "Nothing to clear" — spawn CLI com `['reset']` em env limpo, verificar stdout, (b) reset em non-TTY (piped stdin) nao trava — spawn com stdin pipe, verificar que processo termina em < 5s e stdout contem "interactive terminal", (c) reset com config existente — documentar como known gap se impossivel testar confirmacao interativa via spawn. | M3, H3 |
| 3 | Adicionar teste em `apps/cli/src/__tests__/fs-utils.test.ts`: `readJsonFile` com JSON corrupto (conteudo `"{malformed"`) retorna `null` (nao throw). Usar o pattern existente do arquivo: escrever arquivo com conteudo invalido em `tmp`, chamar `readJsonFile`, assertar que retorna `null`. | H2, M3 |
| 4 | Adicionar teste em `apps/cli/src/__tests__/error-paths.test.ts` OU em novo arquivo: seed config corrompido nao crasha init — o init deve degradar gracefully. Seguir o padrao de spawn do CLI real. Se o comportamento atual NAO degrada gracefully, documentar como known gap. NAO modificar codigo de producao. | H2, M3 |
| 5 | Executar `npm run test` — DEVE exit 0, >= 48 testes passando. Colar output COMPLETO. | Verify |
| 6 | Executar `npm run preflight` — DEVE exit 0. Colar output COMPLETO. | Verify |

---

## Critical Test Patterns (OBRIGATORIO seguir)

### Para testes de comandos (generate, reset):
- Usar `child_process.spawn` para executar o CLI REAL: `spawn('node', ['dist/index.js', 'generate', ...], { cwd, env })`
- Sempre usar `ANTIGRAVITY_CONFIG_DIR` env var apontando para um tmpdir dedicado ao teste
- Coletar stdout/stderr via `data` events, verificar exit code via `close` event
- Wrap em Promise para usar com `await`

### Para testes unitarios (fs-utils):
- Usar o pattern de `fs-utils.test.ts`: criar tmpdir com `fs.mkdtemp`, escrever arquivo, chamar funcao, assertar resultado

### O que NAO fazer:
- NAO mockar `fs`, `Conf`, `child_process`, ou qualquer modulo
- NAO usar `expect(true).toBe(true)` ou assertions tautologicas
- NAO usar `vi.fn()` ou `vi.mock()` para simular comportamento de producao

---

## Hard Constraints

- **NAO modificar codigo de producao** — nenhum arquivo em `apps/cli/src/commands/` ou `apps/cli/src/lib/`.
- **NAO modificar gate scripts** (`scripts/**`).
- **NAO enfraquecer testes existentes**.
- **NAO adicionar dependencias**.
- **Rule R12**: Se algo e desconhecido, PARAR e escrever `.agents/session-14d-blockers.md`.
- **Rule R9**: Execute o check ou cole o output. "Confirm" e proibido.

---

## Scope Fence

```
CRIAR (permitido):
- apps/cli/src/__tests__/generate-command.test.ts
- apps/cli/src/__tests__/reset-command.test.ts
- .agents/handoffs/session-14d-test-hardener.md (handoff)

MODIFICAR (permitido):
- apps/cli/src/__tests__/fs-utils.test.ts (adicionar teste de JSON corrupto)
- apps/cli/src/__tests__/error-paths.test.ts (adicionar teste de seed corrupto)
- .agents/prompts/sessions/session-14d-prompt.md (ESTE ARQUIVO — notas de sessao)

PROIBIDO:
- apps/cli/src/commands/**
- apps/cli/src/lib/**
- apps/cli/src/index.ts
- apps/cli/package.json
- scripts/**
- .agents/prompts/_* (templates)
- .agents/PROJECT_ROADMAP.md
- .gitignore
- CHANGELOG.md
```

---

## Acceptance Criteria (TODOS mecanicos — colar CADA output)

```
[ ] AC-1:  `npm run test` exit 0, >= 48 testes — output colado
[ ] AC-2:  `npm run preflight` exit 0 — output colado
[ ] AC-3:  `grep -c 'it(' apps/cli/src/__tests__/generate-command.test.ts` retorna >= 3
[ ] AC-4:  `grep -c 'it(' apps/cli/src/__tests__/reset-command.test.ts` retorna >= 3
[ ] AC-5:  `grep -c 'corrupt\|malform\|invalid.*json\|SyntaxError' apps/cli/src/__tests__/fs-utils.test.ts` retorna >= 1
[ ] AC-6:  `npm run build` exit 0
[ ] AC-7:  Os 40 testes anteriores continuam passando (nenhum regression)
```

---

## Anti-Gaming Tripwires

1. Se `npm run test` NAO exit 0 no final da sessao, TUDO e FAIL.
2. Se algum dos 40 testes existentes agora falha, a sessao e FAIL (regression).
3. Se `generate-command.test.ts` tem < 3 `it(` calls: FAIL.
4. Se `reset-command.test.ts` tem < 3 `it(` calls: FAIL.
5. Se algum teste usa `vi.fn()`, `vi.mock()`, `jest.fn()`, ou `jest.mock()`: FAIL.
6. Se algum teste usa `expect(true).toBe(true)` ou equivalente tautologico: FAIL.
7. Se o agente declara "already done" sem executar e colar output: violacao R9.

---

## Handoff Format

Follow `.agents/prompts/_handoff-template.md`. All sections required.
Gate: `SESSION_NUMBER=14 node scripts/session-gate.mjs`
Verdict: `node scripts/verdict.mjs`

---

## Next-Session Protocol

Next session: **14e (@GateHardener)** — Claude Sonnet 4.6
Prompt file: `.agents/prompts/sessions/session-14e-prompt.md`

---

## Session Notes

_(O agente pode adicionar notas aqui durante a sessao)_
