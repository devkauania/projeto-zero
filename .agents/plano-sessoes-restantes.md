# Plano Definitivo: Sessões Restantes — Projeto Zero

> **Data:** 2026-04-12
> **Contexto:** Auditoria exaustiva pós-Session 14bv revelou 24 issues (4 críticos,
> 7 altos, 6 médios, 7 baixos). O build está quebrado por dependência circular.
> Este plano mapeia CADA issue para uma sessão específica, com critérios de aceitação
> mecânicos que impedem o LLM de declarar "done" sem evidência.
>
> **Referências normativas:**
> - `.agents/antigravity-taxonomy.md` (tiers e roteamento)
> - `.agents/prompts/_production-contract.txt` (regras R1-R17)
> - `.agents/prompts/_agent-mandate.md` (ciclo Plan-and-Execute)

---

## Princípios Anti-Gaming

Cada sessão abaixo segue estes princípios para impedir que o LLM "declare vitória" sem entregar:

1. **ZERO confiança em narrativa.** Todo critério de aceitação é verificável por um comando
   cujo output deve ser colado literalmente. "Funciona" não é evidência; `npm run build` exit 0
   com output colado É evidência.

2. **Critérios atômicos e binários.** Cada bullet é PASS ou FAIL. Não existe "partially done".
   Se um bullet é FAIL, a sessão inteira é FAIL.

3. **Scope fence explícito.** Lista EXATA de arquivos que podem ser modificados. Qualquer edit
   fora da lista é violação de contrato.

4. **Proibição de atalhos comuns:**
   - NÃO pode enfraquecer testes existentes para fazê-los passar.
   - NÃO pode adicionar `// @ts-ignore` ou `as any` para silenciar erros.
   - NÃO pode remover checks dos gate scripts para fazê-los passar.
   - NÃO pode declarar "already done" sem executar e colar output.
   - NÃO pode inventar URLs, nomes, versões — deve usar valores literais do contexto ou PARAR (R12).

5. **Evidence chain.** Cada sessão produz um handoff com Self-Grading Table (R10), Gate
   Transcript (R15), e Verdict mecânico (R14). A cadeia de evidências é auditável.

---

## Sessão 14c — @BuildRemediation (NOVA)

> **Tier:** Medium (Claude Sonnet 4.6)
> **Pré-requisito:** Nenhum — esta sessão DEVE rodar antes de qualquer outra.
> **Justificativa:** O build está quebrado. Nenhuma sessão subsequente pode rodar
> `npm run preflight` até que C1-C4 e H1-H7 sejam resolvidos.

### Mission

| # | Bullet | Issue Ref |
|---|--------|-----------|
| 1 | Remover a linha `"@projeto-zero/cli": "file:projeto-zero-cli-0.1.0.tgz"` de `apps/cli/package.json` dependencies. | C1 |
| 2 | Deletar o arquivo `apps/cli/projeto-zero-cli-0.1.0.tgz` do disco. | C2 |
| 3 | Inicializar git repo: `git init`, criar `.gitignore` atualizado, `git add` dos arquivos corretos, `git commit` inicial. | C3 |
| 4 | Atualizar `.gitignore` com: `*.tgz`, `*.out`, `output with spaces/`, `tmp-audit-tests/`, `skills_list.txt`, `.claude/`. | H6 |
| 5 | Deletar diretórios residuais: `apps/cli/output with spaces/`, `apps/cli/tmp-audit-tests/`. | M1 |
| 6 | Deletar arquivos residuais: `gate.out`, `verdict.out`, `vitest.out`, `skills_list.txt`. | M2 |
| 7 | Criar `CHANGELOG.md` na raiz com seção `## [0.1.0] — 2026-04-12` listando features implementadas (4 commands, 5 MCP connectors, error handling, SIGINT trap). | H1 |
| 8 | Adicionar `"types": "./dist/index.d.ts"` em `apps/cli/package.json`. | H5 |
| 9 | Fix `readJsonFile` em `apps/cli/src/lib/fs-utils.ts`: envolver `JSON.parse` em try/catch, retornar `null` em caso de SyntaxError (não crashar). | H2 |
| 10 | Fix `reset.ts`: adicionar chamada a `installSigintTrap()` (importar de `init.ts` ou extrair para módulo compartilhado) OU adicionar detecção non-TTY com early exit. | H3 |
| 11 | Fix `scripts/session-gate.mjs`: normalizar paths de `git status --porcelain` output para forward slashes antes de comparar com regex. | H4 |
| 12 | Fix `scripts/placeholder-scan.mjs`: normalizar paths de `relative()` para forward slashes antes de comparar. | H7 |
| 13 | Executar `npm run build` — DEVE exit 0. Colar output completo. | C4 |
| 14 | Executar `npm run test` — DEVE exit 0. Colar output completo mostrando contagem de testes. | C4 |
| 15 | Executar `npm run preflight` — DEVE exit 0 (ou documentar EXATAMENTE quais checks ainda falham e por quê). Colar output completo. | Verificação |

### Scope Fence (arquivos permitidos)

```
MODIFICAR:
- apps/cli/package.json (remover self-ref, adicionar types)
- apps/cli/src/lib/fs-utils.ts (fix readJsonFile)
- apps/cli/src/commands/reset.ts (fix SIGINT/non-TTY)
- scripts/session-gate.mjs (fix path separator)
- scripts/placeholder-scan.mjs (fix path separator)
- .gitignore (adicionar patterns)

CRIAR:
- CHANGELOG.md (raiz)
- .agents/handoffs/session-14c-build-remediation.md (handoff)

DELETAR:
- apps/cli/projeto-zero-cli-0.1.0.tgz
- apps/cli/output with spaces/ (inteiro)
- apps/cli/tmp-audit-tests/ (inteiro)
- gate.out
- verdict.out
- vitest.out
- skills_list.txt

PROIBIDO TOCAR:
- apps/cli/src/__tests__/** (não modificar testes existentes)
- scripts/preflight.mjs, scripts/verdict.mjs (não modificar lógica de gate)
- .agents/prompts/** (não modificar templates)
- .agents/PROJECT_ROADMAP.md (será atualizado em etapa separada)
```

### Acceptance Criteria (TODOS mecânicos)

```
[ ] `npm run build` exit 0 — output colado
[ ] `npm run test` exit 0, >= 40 testes passando — output colado
[ ] `npm run preflight` exit 0 — output colado
[ ] `git status` mostra repo inicializado — output colado
[ ] `git log --oneline` mostra commit inicial — output colado
[ ] `ls apps/cli/projeto-zero-cli-0.1.0.tgz 2>&1` retorna "No such file" — output colado
[ ] `ls apps/cli/output\ with\ spaces 2>&1` retorna "No such file" — output colado
[ ] `ls gate.out 2>&1` retorna "No such file" — output colado
[ ] `cat CHANGELOG.md | head -5` mostra header com versão — output colado
[ ] `grep '"types"' apps/cli/package.json` mostra campo types — output colado
[ ] `grep 'projeto-zero-cli-0.1.0.tgz' apps/cli/package.json` retorna ZERO matches — output colado
[ ] `grep '*.tgz' .gitignore` mostra pattern — output colado
```

### Anti-Gaming Tripwires

- Se `npm run build` não exit 0 no final, a sessão é FAIL independente de qualquer outra claim.
- Se algum teste existente que passava antes agora falha, a sessão é FAIL.
- Se `installSigintTrap` ou equivalente não estiver presente em `reset.ts`, verificar via `grep 'SIGINT\|installSigint\|isTTY' apps/cli/src/commands/reset.ts` — deve retornar pelo menos 1 match.

---

## Sessão 14d — @TestHardener (NOVA)

> **Tier:** Medium (Claude Sonnet 4.6)
> **Pré-requisito:** Session 14c completa (build funcional).
> **Justificativa:** Gaps de cobertura de teste identificados em M3. Testes
> existentes cobrem 6 arquivos mas deixam 4 módulos sem cobertura.

### Mission

| # | Bullet | Issue Ref |
|---|--------|-----------|
| 1 | Criar `apps/cli/src/__tests__/generate-command.test.ts` — testar: (a) generate sem config mostra "run init first" e retorna sem crash, (b) generate com config válida e `--dir` cria arquivos no dir correto, (c) generate com dir read-only falha com exit 1 e mensagem de erro sem stack trace. | M3 |
| 2 | Criar `apps/cli/src/__tests__/reset-command.test.ts` — testar: (a) reset sem config mostra "Nothing to clear" e retorna, (b) reset em non-TTY (piped stdin) não trava infinitamente (timeout de 5s no teste), (c) reset com config existente + confirmação limpa config. | M3, H3 |
| 3 | Adicionar teste em `fs-utils.test.ts`: `readJsonFile` com JSON corrupto retorna null (não throw). | H2, M3 |
| 4 | Adicionar teste em `error-paths.test.ts` ou novo arquivo: seed config corrupto não crasha init (graceful degradation). | H2, M3 |
| 5 | Executar `npm run test` — DEVE exit 0. Colar output completo mostrando >= 48 testes passando (40 existentes + 8+ novos). | Verificação |
| 6 | Executar `npm run preflight` — DEVE exit 0. Colar output completo. | Verificação |

### Scope Fence

```
CRIAR:
- apps/cli/src/__tests__/generate-command.test.ts
- apps/cli/src/__tests__/reset-command.test.ts
- .agents/handoffs/session-14d-test-hardener.md (handoff)

MODIFICAR:
- apps/cli/src/__tests__/fs-utils.test.ts (adicionar teste de JSON corrupto)
- apps/cli/src/__tests__/error-paths.test.ts (adicionar teste de seed corrupto)

PROIBIDO TOCAR:
- Qualquer arquivo em apps/cli/src/commands/ ou apps/cli/src/lib/ (NÃO modificar código de produção)
- scripts/** (NÃO modificar gate scripts)
- Testes existentes NÃO podem ser enfraquecidos (assertions não podem ser removidas ou relaxadas)
```

### Acceptance Criteria

```
[ ] `npm run test` exit 0, >= 48 testes — output colado
[ ] `npm run preflight` exit 0 — output colado
[ ] `grep -c 'test\|it(' apps/cli/src/__tests__/generate-command.test.ts` retorna >= 3 — output colado
[ ] `grep -c 'test\|it(' apps/cli/src/__tests__/reset-command.test.ts` retorna >= 3 — output colado
[ ] `grep -c 'corrupt\|malform\|invalid.*json\|SyntaxError' apps/cli/src/__tests__/fs-utils.test.ts` retorna >= 1 — output colado
```

### Anti-Gaming Tripwires

- Testes devem testar o COMPORTAMENTO REAL, não mocks. Se um teste mocka `scaffoldProject` inteiro, ele está testando o mock, não o generate command.
- Testes de non-TTY para reset DEVEM usar `child_process.spawn` com stdin pipe (como error-paths.test.ts faz para init), não simular TTY.
- Nenhum teste pode usar `expect(true).toBe(true)` ou assertions tautológicas.

---

## Sessão 14e — @GateHardener (NOVA)

> **Tier:** Medium (Claude Sonnet 4.6)
> **Pré-requisito:** Session 14d completa.
> **Justificativa:** Gate scripts têm fragilidades (M4, M5, M6) que podem
> causar falsos positivos/negativos em sessões futuras.

### Mission

| # | Bullet | Issue Ref |
|---|--------|-----------|
| 1 | Fix `scripts/session-gate.mjs`: aceitar tanto `Sessão` quanto `Session` no regex de detecção de número. | M4 |
| 2 | Fix `scripts/verdict.mjs`: se regex de parsing falha, emitir "PARSE-ERROR" em vez de "unknown", e exit non-zero. | M5 |
| 3 | Fix `apps/cli/scripts/copy-seed.mjs`: após copiar seed, validar que o arquivo copiado é JSON válido via `JSON.parse(fs.readFileSync(...))`. Se inválido, exit 1 com mensagem. | M6 |
| 4 | Executar `npm run preflight` — DEVE exit 0. Colar output. | Verificação |
| 5 | Executar `npm run gate` — DEVE exit 0. Colar output. | Verificação |

### Scope Fence

```
MODIFICAR:
- scripts/session-gate.mjs (regex bilíngue)
- scripts/verdict.mjs (parse-error handling)
- apps/cli/scripts/copy-seed.mjs (JSON validation)

CRIAR:
- .agents/handoffs/session-14e-gate-hardener.md (handoff)

PROIBIDO TOCAR:
- apps/cli/src/** (nenhum código de produção)
- scripts/preflight.mjs (não modificar orquestrador)
- .agents/prompts/** (não modificar templates)
```

### Acceptance Criteria

```
[ ] `npm run preflight` exit 0 — output colado
[ ] `npm run gate` exit 0 — output colado
[ ] `grep -E 'Sess(ão|ao|ion)' scripts/session-gate.mjs` mostra pattern expandido — output colado
[ ] `grep 'PARSE.ERROR\|parse.error' scripts/verdict.mjs` retorna >= 1 match — output colado
[ ] `grep 'JSON.parse' apps/cli/scripts/copy-seed.mjs` retorna >= 1 match — output colado
```

---

## Milestone A2 — @PreFlightValidator (NOVA)

> **Tier:** Gemini Specialist (Gemini 3.1 Pro)
> **Pré-requisito:** Sessions 14c + 14d + 14e todas completas.
> **Justificativa:** Validação consolidada das 3 sessões de remediação.
> Cross-family: Claude (Sonnet) implementou → Gemini (Specialist) valida.

### Mission

| # | Bullet |
|---|--------|
| 1 | Rodar `npm run build` — verificar exit 0. Colar output. |
| 2 | Rodar `npm run test` — verificar exit 0, >= 48 testes. Colar output. |
| 3 | Rodar `npm run preflight` — verificar exit 0. Colar output. |
| 4 | Rodar `npm run gate` — verificar exit 0. Colar output. |
| 5 | Verificar que `apps/cli/projeto-zero-cli-0.1.0.tgz` NÃO existe: `ls apps/cli/*.tgz 2>&1` — colar output. |
| 6 | Verificar que `.gitignore` contém `*.tgz`: `grep tgz .gitignore` — colar output. |
| 7 | Verificar que `CHANGELOG.md` existe e tem conteúdo: `wc -l CHANGELOG.md` — colar output. |
| 8 | Verificar que `package.json` NÃO tem self-reference: `grep 'projeto-zero-cli-0.1.0' apps/cli/package.json; echo "exit: $?"` — deve mostrar exit 1 (zero matches). |
| 9 | Verificar que `readJsonFile` tem try/catch: `grep -A5 'JSON.parse' apps/cli/src/lib/fs-utils.ts` — colar output mostrando catch block. |
| 10 | Verificar que `reset.ts` tem SIGINT/non-TTY handling: `grep -E 'SIGINT\|isTTY\|installSigint' apps/cli/src/commands/reset.ts` — deve retornar >= 1 match. |
| 11 | Verificar que novos testes existem: `ls apps/cli/src/__tests__/generate-command.test.ts apps/cli/src/__tests__/reset-command.test.ts` — colar output. |
| 12 | Rodar `git log --oneline` — verificar que commits existem. Colar output. |
| 13 | Emitir GO / NO-GO consolidado. |

### Deliverable

- `.agents/validations/milestone-a2-validation.md`

---

## Sessão 15 — @CrossPlatformVerifier

> **Tier:** Medium (Claude Sonnet 4.6) + escalação Opus para bugs OS-level
> **Pré-requisito:** Milestone A2 retorna GO.

### Mission

| # | Bullet |
|---|--------|
| 1 | `npm pack` em `apps/cli/`. Colar output mostrando nome do tarball e tamanho. |
| 2 | **Windows PowerShell:** Instalar tarball em tmpdir limpo → rodar `antigravity info` (vazio) → `antigravity init` via buildWizardConfig → `antigravity info` (populado) → `antigravity generate -d ./out` → `ls ./out` mostrando árvore → `antigravity reset` → `antigravity info` (vazio). Colar CADA output INDIVIDUALMENTE. |
| 3 | **Windows cmd.exe:** Repetir exatamente o mesmo E2E do bullet 2. Colar CADA output INDIVIDUALMENTE. |
| 4 | **Linux via Docker:** `docker run --rm -v $(pwd):/work -w /work node:20 bash -c "..."` — repetir E2E. Colar CADA output INDIVIDUALMENTE. Se Docker não disponível, documentar e marcar como BLOCKED. |
| 5 | Verificar para CADA plataforma: ANSI colors renderizam (screenshot ou output com escape codes visíveis), figlet banner aparece, spinners animam, paths com espaços sobrevivem. |
| 6 | Documentar QUALQUER bug platform-specific em `.agents/cross-platform-report.md` e corrigir ANTES de marcar done. |
| 7 | `npm run preflight` exit 0 após correções. Colar output. |

### Scope Fence

```
MODIFICAR (se bugs encontrados):
- apps/cli/src/commands/*.ts
- apps/cli/src/lib/*.ts

CRIAR:
- .agents/cross-platform-report.md
- .agents/session-15-cross-platform.md (handoff)

PROIBIDO TOCAR:
- scripts/** (não modificar gate scripts)
- .agents/prompts/** (não modificar templates)
- apps/cli/src/__tests__/** (não enfraquecer testes)
```

### Acceptance Criteria

```
[ ] Output literal de CADA comando em Windows PowerShell — 7 outputs colados
[ ] Output literal de CADA comando em Windows cmd.exe — 7 outputs colados
[ ] Output literal de CADA comando em Linux Docker — 7 outputs colados (ou BLOCKED com justificativa)
[ ] `npm run preflight` exit 0 — output colado
[ ] `npm run gate` exit 0 — output colado
[ ] cross-platform-report.md existe e documenta resultados por plataforma
```

### Anti-Gaming Tripwires

- Output de cada plataforma DEVE mostrar prompt headers diferentes (PowerShell mostra `PS>`, cmd mostra `>`, Docker mostra `root@`).
- Se alguma plataforma for SKIPPED sem justificativa técnica documentada, a sessão é FAIL.
- "Works on all platforms" como texto genérico sem outputs individuais é FAIL automático.

---

## Sessão 16 — @AntigravityFinalAuditor

> **Tier:** Gemini Base (Gemini 3.0)
> **Pré-requisito:** Session 15 completa.

### Mission

| # | Bullet |
|---|--------|
| 1 | Reler `project-specs.md` inteiro. Para CADA requisito, verificar existência no código com `grep` ou leitura de arquivo. Produzir tabela requirement-by-requirement com PASS/FAIL e evidência (grep output ou file:line). |
| 2 | Rodar `npm run preflight` de um estado limpo (`npm ci && npm run build && npm run preflight`). Colar output completo. |
| 3 | Rodar `antigravity init` interativamente end-to-end (ou via non-TTY pipe). Colar output. |
| 4 | Rodar `antigravity generate -d ./audit-output` contra o config resultante. Colar output. |
| 5 | `ls -R ./audit-output` — colar árvore de arquivos gerados. Comparar contra spec (`.agents/prompts/*.md`, `.agents/default-wizard-config.json`, `.claude/settings.project.json` se MCP selecionado). |
| 6 | Rodar `antigravity info` — colar output mostrando config salva. |
| 7 | Rodar `antigravity reset` → `antigravity info` — colar outputs mostrando config limpa. |
| 8 | Produzir `.agents/final-audit.md` com pass/fail matrix por requisito. Verdito DEVE ser paste de `npm run verdict`. |

### Acceptance Criteria

```
[ ] Tabela requirement-by-requirement com >= 10 requisitos checados — cada com PASS/FAIL + evidência
[ ] `npm run preflight` exit 0 — output colado
[ ] Output literal de init, generate, info, reset — 5 outputs colados
[ ] `ls -R ./audit-output` mostra árvore completa — output colado
[ ] `npm run verdict` output colado (deve dizer "PRODUCTION-READY")
```

---

## Milestone B — @MilestoneReviewer

> **Tier:** Gemini Specialist (Gemini 3.1 Pro)
> **Pré-requisito:** Sessions 15 + 16 completas.
> **R11:** Session 15 (Claude Sonnet) → cross-family COMPLIANT.
>          Session 16 (Gemini Base) → same-family EXCEPTION com adversarial checklist.

### Mission

| # | Bullet |
|---|--------|
| 1 | Rodar `npm run gate` — colar output completo. |
| 2 | Rodar `npm run verdict` — colar output completo. |
| 3 | Ler handoff de Session 15 (`.agents/session-15-cross-platform.md`). Para CADA row na Self-Grading Table, verificar independentemente que a evidência é real (grep, ls, ou rerun do comando). |
| 4 | Ler handoff de Session 16 (`.agents/final-audit.md`). Para CADA row na tabela de requisitos, verificar que o PASS é sustentado por evidência literal (não narrativa). |
| 5 | **Adversarial Checklist para Session 16 (same-family):** (a) Verificar que outputs são literais e não genéricos. (b) `ls ./audit-output` confirma arquivos existem. (c) Buscar padrão "technically compiles" — claims sem execution evidence. (d) Verificar que cross-platform outputs em Session 15 mostram prompts de cada shell individualmente. |
| 6 | Emitir GO / NO-GO consolidado. |

### Deliverable

- `.agents/validations/milestone-b-validation.md`

---

## Sessão 17 — @Publisher

> **Tier:** Low (Claude Haiku 4.6)
> **Pré-requisito:** Milestone B retorna GO.
> **ALERTA:** Esta sessão envolve `npm publish` que é IRREVERSÍVEL. O agente
> DEVE parar e esperar confirmação humana antes do publish real.

### Mission

| # | Bullet |
|---|--------|
| 1 | Ler versão atual em `apps/cli/package.json` (deve ser `0.1.0`). Decidir bump per semver: se é primeiro release, usar `1.0.0`. **PARAR e perguntar ao humano** se a versão desejada é diferente (R12). |
| 2 | Atualizar versão em `apps/cli/package.json` e `apps/cli/src/lib/banner.ts` (a string "v0.1.0"). |
| 3 | Atualizar `CHANGELOG.md` com a versão final e data. |
| 4 | `git add` + `git commit` com mensagem descritiva. |
| 5 | `git tag v<versão>`. |
| 6 | `npm publish --dry-run` em `apps/cli/`. Colar output completo mostrando o que SERIA publicado. |
| 7 | **PARAR E ESPERAR CONFIRMAÇÃO HUMANA.** Não executar `npm publish` real sem aprovação explícita. |
| 8 | Após confirmação: `npm publish` em `apps/cli/`. Colar output. |
| 9 | `npm view @projeto-zero/cli` — colar output confirmando publicação. |
| 10 | Instalar from registry em sandbox: `mkdir /tmp/pub-test && cd /tmp/pub-test && npm init -y && npm install @projeto-zero/cli && npx antigravity info`. Colar output. |

### Scope Fence

```
MODIFICAR:
- apps/cli/package.json (versão)
- apps/cli/src/lib/banner.ts (string de versão)
- CHANGELOG.md (entry de release)

CRIAR:
- .agents/publish-log.md (handoff)

PROIBIDO TOCAR:
- Qualquer lógica de código
- scripts/**
- .agents/prompts/**
```

### Acceptance Criteria

```
[ ] Versão atualizada em package.json — `grep '"version"' apps/cli/package.json` colado
[ ] Versão atualizada em banner.ts — `grep 'v[0-9]' apps/cli/src/lib/banner.ts` colado
[ ] CHANGELOG.md atualizado — `head -10 CHANGELOG.md` colado
[ ] `git log --oneline -3` mostra commit de versão — colado
[ ] `git tag` mostra tag de versão — colado
[ ] `npm publish --dry-run` output colado (ANTES do publish real)
[ ] HUMANO CONFIRMOU publish — evidência na conversa
[ ] `npm publish` output colado (DEPOIS da confirmação)
[ ] `npm view @projeto-zero/cli` output colado
[ ] Install from registry + `npx antigravity info` output colado
```

### Anti-Gaming Tripwires

- Se o agente executar `npm publish` sem confirmação humana explícita na conversa, é violação grave.
- A versão em `banner.ts` DEVE ser IDÊNTICA à versão em `package.json`. Verificar com: `grep -o 'v[0-9.]*' apps/cli/src/lib/banner.ts` vs `node -p "require('./apps/cli/package.json').version"`.

---

## Milestone C — @FinalMilestoneReviewer

> **Tier:** Gemini Specialist (Gemini 3.1 Pro)
> **Pré-requisito:** Session 17 completa.
> **R11:** Session 17 (Claude Haiku) → Gemini Specialist = cross-family COMPLIANT.

### Mission

| # | Bullet |
|---|--------|
| 1 | `npm view @projeto-zero/cli` — verificar que package está publicado. Colar output. |
| 2 | Install from registry em sandbox limpo: `mkdir /tmp/final-test && cd /tmp/final-test && npm init -y && npm install @projeto-zero/cli`. Colar output. |
| 3 | `npx antigravity info` → `npx antigravity init` (via pipe) → `npx antigravity generate -d ./final-out` → `ls -R ./final-out` → `npx antigravity reset` → `npx antigravity info`. Colar CADA output. |
| 4 | Verificar CHANGELOG.md tem entry para versão publicada. |
| 5 | Verificar git tag existe: `git tag` output. |
| 6 | `npm run preflight` exit 0 no repo fonte. Colar output. |
| 7 | Full compliance sign-off contra `project-specs.md` — tabela de requisitos com PASS/FAIL. |
| 8 | Emitir GO / NO-GO final do projeto. |

### Deliverable

- `.agents/validations/milestone-c-validation.md`

---

## Sequência Completa de Execução

```
FASE DE REMEDIAÇÃO (NOVA):
  14c (@BuildRemediation)     → Claude Sonnet    → Fix build, git init, cleanup
  14d (@TestHardener)         → Claude Sonnet    → Novos testes para gaps
  14e (@GateHardener)         → Claude Sonnet    → Fix gate scripts
  Milestone A2 (@PreFlight)   → Gemini 3.1 Pro   → Validação consolidada 14c+14d+14e

FASE DE VERIFICAÇÃO (ATUALIZADA):
  15 (@CrossPlatform)         → Claude Sonnet    → E2E Windows + Docker Linux
  16 (@FinalAudit)            → Gemini 3.0 Base  → Auditoria spec-by-spec

FASE DE VALIDAÇÃO CONSOLIDADA:
  Milestone B (@Review)       → Gemini 3.1 Pro   → Validação 15+16

FASE DE PUBLICAÇÃO:
  17 (@Publisher)             → Claude Haiku     → Version bump + npm publish
  Milestone C (@FinalReview)  → Gemini 3.1 Pro   → Sign-off total
```

---

## Issue Tracking Matrix

Cada issue do inventário mapeado para sua sessão de resolução:

| Issue | Sessão | Status |
|-------|--------|--------|
| C1 Dependência circular | 14c #1 | PENDING |
| C2 Artefato .tgz | 14c #2 | PENDING |
| C3 Sem git | 14c #3 | PENDING |
| C4 Build quebrado | 14c #13-14 | PENDING |
| H1 CHANGELOG.md | 14c #7 | PENDING |
| H2 readJsonFile crash | 14c #9, 14d #3-4 | PENDING |
| H3 reset non-TTY | 14c #10, 14d #2 | PENDING |
| H4 session-gate path sep | 14c #11 | PENDING |
| H5 types field | 14c #8 | PENDING |
| H6 .gitignore incompleto | 14c #4 | PENDING |
| H7 placeholder-scan path | 14c #12 | PENDING |
| M1 Dirs residuais | 14c #5 | PENDING |
| M2 Arquivos .out | 14c #6 | PENDING |
| M3 Test coverage gaps | 14d #1-4 | PENDING |
| M4 gate português | 14e #1 | PENDING |
| M5 verdict regex | 14e #2 | PENDING |
| M6 copy-seed no validation | 14e #3 | PENDING |
| L1 Versão 0.1.0 | 17 #1-2 | PENDING |
| L2 Display slashes | — (cosmético, aceito) | WONTFIX |
| L3 Sem rollback scaffold | — (design limitation, aceito) | WONTFIX |
| L4 Walk-up limit 8 | — (edge case extremo, aceito) | WONTFIX |
| L5 Git hooks | — (fora do escopo MVP) | DEFERRED |
| L6 Session 11 sem R10 | — (histórico, pré-R10) | ACKNOWLEDGED |
| L7 Session 11 verdict manual | — (histórico, pré-R14) | ACKNOWLEDGED |
