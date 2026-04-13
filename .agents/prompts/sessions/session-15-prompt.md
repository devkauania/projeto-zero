# Session 15 — @CrossPlatformVerifier

> **Modelo:** Claude Sonnet 4.6 (`claude-sonnet-4-6`) | **Tier:** Medium
> **Escalacao para Opus:** Se bug OS-level intratavel for encontrado (ver taxonomy S6).
> **Status:** PENDING
> **Este arquivo:** `.agents/prompts/sessions/session-15-prompt.md`
> **O agente PODE editar este arquivo** para documentar blockers ou notas.

---

## Before You Do Anything

Read in full and paste a 1-line summary of each:

0. `.agents/prompts/_agent-mandate.md`
1. `.agents/prompts/_production-contract.txt`
2. `.agents/project-specs.md`
3. `.agents/PROJECT_ROADMAP.md`
4. `.agents/plano-sessoes-restantes.md` (secao "Sessao 15" apenas)
5. `.agents/validations/milestone-a2-validation.md`

---

## Compliance Pre-Check (MANDATORIO)

1. **STATE LOG** — Declare estado atual do projeto.
2. **SCOPE DECLARATION** — Plano de execucao por plataforma.
3. So entao proceda.

---

## Mission

| # | Bullet |
|---|--------|
| 1 | `npm pack` em `apps/cli/`. Colar output mostrando nome do tarball e tamanho. |
| 2 | **Windows PowerShell:** Instalar tarball em tmpdir limpo. Executar sequencia completa: `antigravity info` (vazio) -> `antigravity init` (via pipe ou buildWizardConfig) -> `antigravity info` (populado) -> `antigravity generate -d ./out` -> `ls ./out` mostrando arvore -> `antigravity reset` -> `antigravity info` (vazio). Colar CADA output INDIVIDUALMENTE. |
| 3 | **Windows cmd.exe:** Repetir exatamente o mesmo E2E do bullet 2. Colar CADA output INDIVIDUALMENTE. |
| 4 | **Linux via Docker:** `docker run --rm -v $(pwd):/work -w /work node:20 bash -c "..."` — repetir E2E. Colar CADA output INDIVIDUALMENTE. Se Docker nao disponivel, documentar e marcar como BLOCKED com justificativa tecnica. |
| 5 | Verificar para CADA plataforma: ANSI colors renderizam, figlet banner aparece, spinners animam, paths com espacos sobrevivem. |
| 6 | Documentar QUALQUER bug platform-specific em `.agents/handoffs/cross-platform-report.md` e corrigir ANTES de marcar done. |
| 7 | `npm run preflight` exit 0 apos correcoes. Colar output. |

---

## Hard Constraints

- Output de CADA plataforma DEVE ser colado INDIVIDUALMENTE (nao agrupado).
- Cada output DEVE mostrar prompt header da plataforma (PS>, >, root@, $).
- Se alguma plataforma for SKIPPED, DEVE ter justificativa tecnica documentada.
- "Works on all platforms" como texto generico sem outputs individuais = FAIL.
- **Rule R9**: Execute e cole. Nao raciocinee.

---

## Scope Fence

```
MODIFICAR (se bugs encontrados):
- apps/cli/src/commands/*.ts
- apps/cli/src/lib/*.ts

CRIAR:
- .agents/handoffs/cross-platform-report.md
- .agents/handoffs/session-15-cross-platform.md (handoff)

PERMITIDO EDITAR:
- .agents/prompts/sessions/session-15-prompt.md (ESTE ARQUIVO)

PROIBIDO:
- scripts/**
- .agents/prompts/_* (templates)
- apps/cli/src/__tests__/** (nao enfraquecer testes)
```

---

## Acceptance Criteria

```
[ ] AC-1:  Output literal de CADA comando em Windows PowerShell — 7 outputs colados
[ ] AC-2:  Output literal de CADA comando em Windows cmd.exe — 7 outputs colados
[ ] AC-3:  Output literal de CADA comando em Linux Docker — 7 outputs colados (ou BLOCKED)
[ ] AC-4:  `npm run preflight` exit 0 — output colado
[ ] AC-5:  `SESSION_NUMBER=15 node scripts/session-gate.mjs` exit 0 — output colado
[ ] AC-6:  cross-platform-report.md existe e documenta resultados por plataforma
```

---

## Anti-Gaming Tripwires

1. Outputs de cada plataforma DEVEM mostrar prompt headers diferentes.
2. Se alguma plataforma for SKIPPED sem justificativa tecnica: FAIL.
3. "Works on all platforms" generico sem outputs individuais: FAIL automatico.

---

## Handoff Format

Follow `.agents/prompts/_handoff-template.md`.
Gate: `SESSION_NUMBER=15 node scripts/session-gate.mjs`
Verdict: `node scripts/verdict.mjs`

## Next-Session Protocol

Next session: **Session 16 (@AntigravityFinalAuditor)** — Gemini 3.0
Prompt file: `.agents/prompts/sessions/session-16-prompt.md`

---

## Session Notes

_(O agente pode adicionar notas aqui durante a sessao)_
