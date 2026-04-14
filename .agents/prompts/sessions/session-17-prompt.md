# Session 17 — @Publisher

> **Modelo:** Claude Haiku 4.6 (`claude-haiku-4-6`) | **Tier:** Low
> **Escalacao:** NAO escalar — operacoes de string/metadata apenas.
> **Status:** PENDING
> **Este arquivo:** `.agents/prompts/sessions/session-17-prompt.md`
> **O agente PODE editar este arquivo** para adicionar notas na secao "Session Notes".
> **ALERTA:** Esta sessao envolve `npm publish` que e IRREVERSIVEL. O agente
> DEVE parar e esperar confirmacao humana antes do publish real.

---

## Before You Do Anything

Read in full and paste a 1-line summary of each:

0. `.agents/prompts/_agent-mandate.md`
1. `.agents/prompts/_production-contract.txt`
2. `.agents/PROJECT_ROADMAP.md`
3. `.agents/validations/milestone-b-validation.md`
4. `apps/cli/package.json` (versao atual)
5. `apps/cli/src/lib/banner.ts` (string de versao)
6. `CHANGELOG.md` (estado atual)

---

## Compliance Pre-Check (MANDATORIO)

1. **STATE LOG** — Declare estado atual do projeto e versao encontrada.
2. **SCOPE DECLARATION** — Liste os 3 arquivos a modificar e a ordem de operacoes.
3. So entao proceda.

---

## Mission

| # | Bullet |
|---|--------|
| 1 | Ler versao atual em `apps/cli/package.json` (deve ser `0.1.0`). Decidir bump per semver: se e primeiro release, usar `1.0.0`. **PARAR e perguntar ao humano** se a versao desejada e diferente (R12). |
| 2 | Atualizar versao em `apps/cli/package.json` e `apps/cli/src/lib/banner.ts` (a string "v0.1.0"). |
| 3 | Atualizar `CHANGELOG.md` com a versao final e data. |
| 4 | `git add` + `git commit` com mensagem descritiva. |
| 5 | `git tag v<versao>`. |
| 6 | `npm publish --dry-run` em `apps/cli/`. Colar output completo mostrando o que SERIA publicado. |
| 7 | **PARAR E ESPERAR CONFIRMACAO HUMANA.** Nao executar `npm publish` real sem aprovacao explicita. |
| 8 | Apos confirmacao: `npm publish` em `apps/cli/`. Colar output. |
| 9 | `npm view @projeto-zero/cli` — colar output confirmando publicacao. |
| 10 | Instalar from registry em sandbox: `mkdir /tmp/pub-test && cd /tmp/pub-test && npm init -y && npm install @projeto-zero/cli && npx antigravity info`. Colar output. |

---

## Hard Constraints

- **IRREVERSIVEL**: `npm publish` NAO pode ser desfeito. Dry-run OBRIGATORIO antes.
- **CONFIRMACAO HUMANA**: O agente DEVE parar apos bullet 6 e esperar aprovacao explicita.
- **Versao consistente**: A versao em `banner.ts` DEVE ser IDENTICA a versao em `package.json`.
- **NAO modificar logica de codigo** — apenas strings de versao e metadata.
- **Rule R12**: Se a versao desejada e desconhecida, PARAR e perguntar.
- **Rule R9**: Execute e cole output.

---

## Scope Fence

```
MODIFICAR:
- apps/cli/package.json (versao)
- apps/cli/src/lib/banner.ts (string de versao)
- CHANGELOG.md (entry de release)

CRIAR:
- .agents/handoffs/session-17-publisher.md (handoff)

PROIBIDO:
- apps/cli/src/commands/** (logica de codigo)
- apps/cli/src/lib/** (exceto banner.ts string de versao)
- apps/cli/src/__tests__/** (testes)
- scripts/** (gate scripts)
- .agents/prompts/_* (templates)
```

---

## Acceptance Criteria

```
[ ] AC-1:   Versao atualizada em package.json — `grep '"version"' apps/cli/package.json` colado
[ ] AC-2:   Versao atualizada em banner.ts — `grep 'v[0-9]' apps/cli/src/lib/banner.ts` colado
[ ] AC-3:   CHANGELOG.md atualizado — `head -10 CHANGELOG.md` colado
[ ] AC-4:   `git log --oneline -3` mostra commit de versao — colado
[ ] AC-5:   `git tag` mostra tag de versao — colado
[ ] AC-6:   `npm publish --dry-run` output colado (ANTES do publish real)
[ ] AC-7:   HUMANO CONFIRMOU publish — evidencia na conversa
[ ] AC-8:   `npm publish` output colado (DEPOIS da confirmacao)
[ ] AC-9:   `npm view @projeto-zero/cli` output colado
[ ] AC-10:  Install from registry + `npx antigravity info` output colado
```

---

## Anti-Gaming Tripwires

1. Se o agente executar `npm publish` sem confirmacao humana explicita na conversa: violacao grave.
2. A versao em `banner.ts` DEVE ser IDENTICA a versao em `package.json`. Verificar com: `grep -o 'v[0-9.]*' apps/cli/src/lib/banner.ts` vs `node -p "require('./apps/cli/package.json').version"`.
3. Se o CHANGELOG nao tem entry para a versao publicada: FAIL.
4. Se o commit de versao nao existe no git log: FAIL.

---

## Handoff Format

Follow `.agents/prompts/_handoff-template.md`.
Gate: `SESSION_NUMBER=17 node scripts/session-gate.mjs`
Verdict: `node scripts/verdict.mjs`

## Next-Session Protocol

Next session: **Milestone C (@FinalMilestoneReviewer)** — Gemini 3.1 Pro
Prompt file: `.agents/prompts/sessions/milestone-c-prompt.md`

---

## Session Notes

### 2026-04-14 — Dispatch halted by Compliance Pre-Check

Session 17 did not execute. Three independent blockers were surfaced before
any mutation:

1. **R17 no-skip violation.** First `[ ]` row top-to-bottom in
   `PROJECT_ROADMAP.md` is **Milestone B**, not Session 17. Session 17 is
   explicitly gated on Milestone B returning GO.
2. **R12 missing artifact.** The Pre-Check instructs to read
   `.agents/validations/milestone-b-validation.md`. File does not exist —
   Milestone B never ran.
3. **Tier mismatch.** Prompt declares Haiku 4.6 / Tier Low with
   "NAO escalar"; dispatch arrived at Opus 4.6 / Tier High.

No files modified. No commits. No tags. No `npm publish --dry-run`. No
`npm publish`.

Full analysis and decision options written to
`.agents/session-17-blockers.md` per R12. The publish gate stays closed
until the human decides how to unblock.
