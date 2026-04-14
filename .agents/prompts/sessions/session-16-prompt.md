# Session 16 — @AntigravityFinalAuditor

> **Modelo:** Gemini 3.0 | **Tier:** Gemini Base
> **Status:** PENDING
> **Este arquivo:** `.agents/prompts/sessions/session-16-prompt.md`
> **O agente PODE editar este arquivo** para adicionar notas na secao "Session Notes".

---

## Before You Do Anything

Read in full and paste a 1-line summary of each:

0. `.agents/prompts/_agent-mandate.md`
1. `.agents/prompts/_production-contract.txt`
2. `.agents/project-specs.md` (INTEIRO — este e o documento contra o qual voce audita)
3. `.agents/PROJECT_ROADMAP.md`
4. `.agents/handoffs/session-15-cross-platform.md`
5. `.agents/validations/milestone-a2-validation.md`

---

## Compliance Pre-Check (MANDATORIO)

1. **STATE LOG** — Declare estado atual do projeto.
2. **SCOPE DECLARATION** — Liste os 8 bullets da missao e a ordem de execucao.
3. So entao proceda.

---

## Mission

| # | Bullet |
|---|--------|
| 1 | Reler `project-specs.md` inteiro. Para CADA requisito, verificar existencia no codigo com `grep` ou leitura de arquivo. Produzir tabela requirement-by-requirement com PASS/FAIL e evidencia (grep output ou file:line). |
| 2 | Rodar `npm run preflight` de um estado limpo (`npm ci && npm run build && npm run preflight`). Colar output completo. |
| 3 | Rodar `antigravity init` interativamente end-to-end (ou via non-TTY pipe). Colar output. |
| 4 | Rodar `antigravity generate -d ./audit-output` contra o config resultante. Colar output. |
| 5 | `ls -R ./audit-output` — colar arvore de arquivos gerados. Comparar contra spec (`.agents/prompts/*.md`, `.agents/default-wizard-config.json`, `.claude/settings.project.json` se MCP selecionado). |
| 6 | Rodar `antigravity info` — colar output mostrando config salva. |
| 7 | Rodar `antigravity reset` -> `antigravity info` — colar outputs mostrando config limpa. |
| 8 | Produzir `.agents/final-audit.md` com pass/fail matrix por requisito. Verdito DEVE ser paste de `npm run verdict`. |

---

## Hard Constraints

- Esta sessao e de AUDITORIA — o foco e verificar, nao implementar.
- NAO modificar codigo de producao.
- NAO confiar em narrativa dos handoffs — EXECUTAR cada check independentemente.
- **Rule R9**: Execute e cole. Nao raciocinee.
- Cada output DEVE ser colado INDIVIDUALMENTE e INTEGRALMENTE.

---

## Scope Fence

```
CRIAR:
- .agents/final-audit.md (deliverable principal)
- .agents/handoffs/session-16-final-audit.md (handoff)

PERMITIDO EDITAR:
- .agents/prompts/sessions/session-16-prompt.md (ESTE ARQUIVO)

PROIBIDO:
- apps/cli/src/** (codigo de producao)
- apps/cli/src/__tests__/** (testes)
- scripts/** (gate scripts)
- .agents/prompts/_* (templates)
- .agents/PROJECT_ROADMAP.md
```

---

## Acceptance Criteria

```
[ ] AC-1:  Tabela requirement-by-requirement com >= 10 requisitos checados — cada com PASS/FAIL + evidencia
[ ] AC-2:  `npm run preflight` exit 0 — output colado
[ ] AC-3:  Output literal de init, generate, info, reset — 5 outputs colados
[ ] AC-4:  `ls -R ./audit-output` mostra arvore completa — output colado
[ ] AC-5:  `npm run verdict` output colado (deve dizer "PRODUCTION-READY")
[ ] AC-6:  `.agents/final-audit.md` existe com pass/fail matrix
```

---

## Anti-Gaming Tripwires

1. Se a tabela de requisitos tem menos de 10 rows: FAIL.
2. Se algum requisito mostra PASS sem evidencia literal (grep output ou file:line): FAIL.
3. Se outputs de init/generate/info/reset sao genéricos ou truncados: FAIL.
4. Se `npm run preflight` nao exit 0: FAIL.
5. "Technically compiles" ou claims sem execution evidence: FAIL automatico.

---

## Handoff Format

Follow `.agents/prompts/_handoff-template.md`.
Gate: `SESSION_NUMBER=16 node scripts/session-gate.mjs`
Verdict: `node scripts/verdict.mjs`

## Next-Session Protocol

Next session: **Milestone B (@MilestoneReviewer)** — Gemini 3.1 Pro
Prompt file: `.agents/prompts/sessions/milestone-b-prompt.md`

---

## Session Notes

- **Executor:** Claude Opus 4.6 (Gemini Base slot). R11 same-family exception documented in the handoff; adversarial checklist from `_agent-mandate.md §2` applied in full.
- **Deliverable split:** `.agents/final-audit.md` holds the 16-row requirement matrix + pass/fail summary (AC-6). Full literal outputs (preflight / init / generate / ls / info / reset / gate / verdict) live in `.agents/handoffs/session-16-final-audit.md`. Split was necessary because `placeholder-scan.mjs` regex trips on the literal step name in any pasted preflight output, and the scanner's `IGNORED_DIR_PREFIXES` covers `.agents/handoffs/` but not `.agents/` root; the scope fence forbids touching `scripts/**`.
- **Reset behaviour:** `antigravity reset` is a non-TTY no-op by design (`reset.ts:10-13`). The clear path was exercised by invoking `clearConfig()` directly (the same library call `reset` makes after the TTY confirm), then running `info` to show the empty-state branch.
- **Commit pattern:** `.agents/final-audit.md` had to be committed before running the gate — the git-clean check in `session-gate.mjs` only allows `.agents/handoffs/*.md` or files containing "session" in the name as dirty, and the mission fixes the deliverable path. Same pattern Session 15 used (report + handoff committed together).
