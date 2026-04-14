# Agent Mandate (ler ANTES de `_production-contract.txt`)

> Este documento deve ser lido como item 0 de toda sessão (implementação ou
> validação). Ele injeta os protocolos de metaprompting que complementam as
> regras R1-R17 do contrato de produção. Referência normativa:
> `.agents/antigravity-taxonomy.md`.

---

## 1. Ciclo Plan-and-Execute (MANDATÓRIO para Tier Medium e Tier High)

Aplica-se a sessões atribuídas ao **Claude Sonnet 4.6** (Tier Medium) e ao
**Claude Opus 4.6** (Tier High). Sessões Tier Low (Haiku) e Gemini estão
isentas deste ciclo.

### Protocolo

Antes de executar QUALQUER tool call além de `Read`:

1. **STATE LOG** — Declare em texto corrido:
   - Quais arquivos você já leu e um resumo de 1 linha de cada.
   - Qual é o estado atual do pipeline (última sessão completa, gate status).
   - Qual é o seu escopo conforme entendido.

2. **SCOPE DECLARATION** — Liste mecanicamente:
   - Arquivos exatos que pretende criar ou modificar (caminhos completos).
   - Testes que pretende rodar e em qual ordem.
   - Ordem de operações planejada (passo a passo numerado).

3. **EXECUÇÃO** — Só após emitir os dois blocos acima, proceda à
   implementação.

### Proibição Explícita

Geração de código em **one-shot** (emitir código sem state log prévio) é
uma violação deste mandato. Se detectado pelo humano, a sessão é abortada
e re-roteada.

### Racional

Previne o failure mode da Session 11 onde o agente declarou "done" sem
executar verificação, e o failure mode da Session 14b onde o agente pulou
etapas de pré-trabalho mandatórias.

---

## 2. Mitigação R11 — Validação Adversária (policy-aware)

Esta seção é governada por `.agents/vendor-policy.json` (ver R11 no
`_production-contract.txt`). As regras abaixo se aplicam conforme a
política declarada.

### Para sessões de IMPLEMENTAÇÃO (qualquer policy)

Seu output será validado por uma sessão separada (Milestone de
verificação). Você NÃO deve auto-validar. Sua responsabilidade termina
no handoff + gate transcript.

- Sob `policy: cross-family`: o validador será de uma família de
  modelo DIFERENTE.
- Sob `policy: single-family`: o validador será da MESMA família, mas
  SEMPRE uma sessão separada (nunca inline). A Adversarial Checklist
  será obrigatória.

### Para MILESTONE REVIEWERS

Regras inegociáveis (ambas policies):
- **EXECUTAR** evidência conforme regra R9 — rodar o comando, colar o
  output. Ler código e raciocinar sobre ele NÃO é verificação.
- **NÃO confiar em narrativa** — toda claim no Self-Grading Table deve
  ser verificada independentemente.

### Adversarial Checklist

- Sob `policy: cross-family`: a checklist é OBRIGATÓRIA apenas para
  rows same-family documentadas como EXCEPTION.
- Sob `policy: single-family`: a checklist é **OBRIGATÓRIA para toda
  review session** (substitui separação cross-family como defesa
  primária anti-gaming).

Os 5 checks (definidos em `antigravity-taxonomy.md` §4):

1. **Evidence Literality** — Para cada teste descrito como "executado",
   verificar se o output literal foi colado (não apenas "all tests
   pass").
2. **File Existence** — Para cada arquivo descrito como "criado",
   verificar existência no disco via `ls` ou `cat`.
3. **Anti-"Technically Compiles"** — Buscar o padrão "technically
   compiles" — claims de completude sem evidência de execução E2E.
4. **Per-Platform Output** — Verificar se cross-platform claims incluem
   output de CADA plataforma individualmente (não generalizações como
   "works on all platforms").
5. **Spec-by-Spec Diff** — Verificar que cada requirement em
   `project-specs.md` tem um PASS com evidência, não apenas um
   checkmark narrativo.

---

## 3. Mitigação R17 — Protocolo Mecânico de Próximo Passo

### Procedimento (sem exceções)

Quando qualquer sessão precisa gerar o prompt para a próxima sessão:

1. Abrir `.agents/PROJECT_ROADMAP.md`.
2. Encontrar a **PRIMEIRA** row cujo checkbox é `[ ]` ou `[~]`,
   lendo de cima para baixo.
3. **Copiar essa row LITERALMENTE** na resposta, entre aspas ou em
   bloco de código.
4. Consultar `.agents/antigravity-taxonomy.md` §3 para determinar o
   tier assignment e modelo específico.
5. Formular o prompt mecânico para o modelo e agente indicados.

### Proibições

- NÃO interpretar, inferir ou racionalizar qual deveria ser a próxima
  sessão.
- NÃO pular rows. Se uma row deveria ser pulada, PARAR e escrever
  `.agents/<session>-blockers.md` explicando por quê.
- NÃO inventar ambiguidade para justificar desvio do roadmap (failure
  mode Session 14b).

### Esclarecimento R17(c) — Família vs. Tier

A regra R17(c) do `_production-contract.txt` determina a **família do
modelo** (Claude Code CLI para implementação, Gemini para validação/
Milestones). O **modelo específico** dentro da família (Haiku, Sonnet
ou Opus) é determinado pela tabela de tiers em
`antigravity-taxonomy.md` §3. R17(c) NÃO é violada pela seleção de
tier dentro da família correta.
