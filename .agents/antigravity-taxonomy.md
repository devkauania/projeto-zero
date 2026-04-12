# Pipeline Routing Plan & Antigravity Taxonomy

> Supersede `.agents/pipeline-routing-plan.md` a partir da conclusão da
> Session 14bv. Este documento é a referência normativa para roteamento de
> sessões, atribuição de modelos e consolidação de validações em Milestones.
>
> **Data efetiva:** 2026-04-12 (post-Session 14bv)
>
> **Referências:**
> - `.agents/prompts/_production-contract.txt` (regras R1-R17)
> - `.agents/PROJECT_ROADMAP.md` (mapa mestre de sessões)
> - `.agents/session-router-blockers.md` (paradoxo R11 — resolvido §4)
> - `.agents/prompts/_agent-mandate.md` (metaprompting mandatório)

---

## §1 — Model Taxonomy & Antigravity Tiers

### Tabela de Tiers

| Tier | Modelo | Perfil de Custo | Trabalho Permitido | Trabalho Proibido |
|------|--------|-----------------|--------------------|--------------------|
| **Low** | Claude Haiku 4.6 | Velocidade extrema, baixo custo | Documentação estática, correções de strings, variáveis de ambiente, version bumping, metadata de package.json | Raciocínio multi-arquivo (>2 arquivos), diagnósticos profundos, refactoring complexo |
| **Medium** | Claude Sonnet 4.6 | "Operário" — custo moderado | High-volume scaffolding, criação de features padrão, refatorações multi-arquivo, escrita de testes de aceitação, cross-platform bug-fixing | Diagnósticos de OS/syscalls profundos, compliance pesado, auditorias E2E, manipulação de AST interna |
| **High** | Claude Opus 4.6 | Alto custo/tempo — reservado | Diagnósticos profundos de OS/Syscalls, manipulação complexa de AST, bug-fixes cirúrgicos em internals do Node.js | Template-following rígido, documentação, bridging mecânico, compliance, scaffolding (overkill) |
| **Gemini Base** | Gemini 3.0 | Execução mecânica, custo base | Navegação de console, validações read-only simples, execução literal de scripts, auditoria mecânica | Julgamento arquitetural, implementação complexa, refactoring, geração de features |
| **Gemini Specialist** | Gemini 3.1 Pro | Paid Tier, restrito por cota | **EXCLUSIVO:** Milestone Reviews, compliance pesado, auditorias cross-platform E2E | **PROIBIDO:** Scaffolding, implementação de código, geração de features, qualquer sessão que não seja Milestone |

### Mapeamento Histórico de Sessões por Tier

| Tier | Sessões Históricas (Retroativo) | Sessões Futuras (Acionável) |
|------|--------------------------------|----------------------------|
| Low | 13 (retroativo — docs/string fix) | 17 |
| Medium | 2, 3, 4, 5, 6, 10, 11 (retroativo), 14a | 15 (reclassificado) |
| High | 12, 14b | — (escalação sob demanda via §6) |
| Gemini Base | 1, 7, 8, 9 | 16 |
| Gemini Specialist | — (validações individuais pré-Milestone) | Milestone B, Milestone C |

---

## §2 — Disqualifying Criteria

### Critérios de Desqualificação para Claude (todas as variantes)

Derivados das falhas empíricas documentadas em `.agents/process-hardening.md`,
`.agents/session-14b-error-path-fixes.md` e `.agents/pipeline-routing-plan.md` §2.

| # | Critério | Failure Mode Fonte | Sessões Afetadas |
|---|----------|--------------------|------------------|
| DC-1 | **Template-Driven Rigidity** — Sessões cuja entrega primária é seguir rigidamente um template markdown (`_session-template.md`, `_validation-template.md`). | Session 14b: compression reflex causa Claude a pular etapas "ceremony" (pre-work, handoffs). | Todas as Nv (validações) |
| DC-2 | **Mechanical Next-Step Bridging** — Trabalho que exige copy-paste literal de rows do roadmap. | Session 14b: racionalização self-protective causa Claude a inventar ambiguidade fake em vez de citar mecanicamente o prompt (violação R17). | Handoffs com next-session prompts |
| DC-3 | **Static File Checker Passing** — Sessões cujo "done" depende de passar scripts bash rígidos (`files-exist.mjs`, `placeholder-scan.mjs`) via mutação de configs. | Session 11: Claude parou em "technically compiles" e fabricou `repository.url`. | 13 (redirecionada para Haiku/Gemini) |
| DC-4 | **Documentation Requiring No Invention** — Documentação oficial onde string-matching exato importa e o agente não pode hipoteticar dados ausentes. | Session 11: inserção de placeholder text que falha `placeholder-scan.mjs`. | 13 (README), qualquer doc oficial |
| DC-5 | **Cross-Platform Strict Execution** — Verificação multi-plataforma exigindo execução literal e paciente em console para provar assumptions. | Session 11: assumptions silenciosamente Windows-only enquanto declarava sucesso cross-platform. | 15 (parcialmente — reclassificado para Sonnet com escalação), 16 |
| DC-6 | **Compliance-Heavy Validations (Read-Only)** — Sessões de validação cujo deliverable inteiro é executar outputs de outros agentes mecanicamente, preencher tabela PASS/FAIL, e emitir string via script. | Session 14b: seções de compliance puladas. | Todas as Nv, Milestones |

### Critérios de Desqualificação para Gemini Specialist (3.1 Pro)

| # | Critério | Racional |
|---|----------|----------|
| DG-1 | **PROIBIDO para scaffolding ou implementação de código.** | Quota paga, custo elevado. Reservado exclusivamente para auditorias e Milestone Reviews. Gerar código seria desperdício de cota e viola a separação implementation/validation. |
| DG-2 | **PROIBIDO para sessões que não sejam Milestones.** | Cada invocação consome cota limitada. Validações individuais simples são cobertas pelo Gemini Base. |

### Critérios de Desqualificação para Claude Haiku (Tier Low)

| # | Critério | Racional |
|---|----------|----------|
| DH-1 | **PROIBIDO para raciocínio multi-arquivo (>2 arquivos em uma única passada).** | Haiku não tem capacidade de manter estado consistente entre múltiplos arquivos interdependentes. Tarefas multi-arquivo devem ser roteadas para Sonnet (Medium). |
| DH-2 | **PROIBIDO para diagnósticos de OS ou bug-fixes que exijam conhecimento de internals.** | Haiku prioriza velocidade sobre profundidade. Diagnósticos profundos devem ser roteados para Opus (High). |

---

## §3 — Milestone-Based Routing Table (Completa, Sessões 1-17)

### Sessões Históricas (Completadas)

| Sessão | Agente | Tier | Modelo | Racional | R11 Status |
|--------|--------|------|--------|----------|------------|
| 1 | @WizardInitializer | Gemini Base | Gemini 3.0 | Definição de escopo — execução mecânica | N/A (sem validação formal) |
| 2 | @AgentEnvChecker | Medium | Claude Sonnet 4.6 | Validação de infra — multi-arquivo | N/A (sem validação formal) |
| 3 | @TurboScaffolder | Medium | Claude Sonnet 4.6 | Scaffolding monorepo — high-volume | N/A (sem validação formal) |
| 4 | @MCPConfigurator | Medium | Claude Sonnet 4.6 | Configuração MCP multi-arquivo | N/A (sem validação formal) |
| 5 | @ClaudeCoder (Core) | Medium | Claude Sonnet 4.6 | Módulos lógicos base — features padrão | N/A (sem validação formal) |
| 6 | @ClaudeCoder (Commands) | Medium | Claude Sonnet 4.6 | Endpoints CLI — features padrão | N/A (sem validação formal) |
| 7 | @AntigravityAuditor | Gemini Base | Gemini 3.0 | Verificação rigorosa mecânica | Cross-family vs. Sessions 5-6 (Claude) |
| 8 | @BridgeEvaluator | Gemini Base | Gemini 3.0 | Design handshake — execução literal | N/A |
| 9 | @AntigravityDesigner | Gemini Base | Gemini 3.0 | Arte terminal — execução mecânica | N/A |
| 10 | @StitchPrompter + @UIArchitect | Medium | Claude Sonnet 4.6 | Injeção UI multi-arquivo | N/A |
| 11 | @ReleaseEngineer | Medium (retroativo) | Claude Sonnet 4.6 | Release prep — multi-arquivo. **REVERTIDO [~]**: falhas descobertas pelo gate. | N/A |
| 12 | @ProcessHardener | High | Claude Opus 4.6 | META session — cross-cutting, AST-level scripting | N/A |
| 12v | @ProcessHardenerValidator | Gemini Base | Gemini 3.0 | Validação read-only de Session 12 | COMPLIANT (Opus → Gemini) |
| 13 | @DocsAuthor | Low (retroativo) | Claude Haiku 4.6 | README + string fix — docs estáticos | N/A |
| 13v | @DocsAuthorValidator | Gemini Base | Gemini 3.0 | Validação read-only de Session 13 | COMPLIANT (Haiku → Gemini) |
| 14a | @ErrorPathTestAuthor | Medium | Claude Sonnet 4.6 | Testes de aceitação failing — R13 split part 1 | N/A |
| 14av | @ErrorPathTestAuthorValidator | Gemini Base | Gemini 3.0 | Validação read-only de Session 14a | COMPLIANT (Sonnet → Gemini) |
| 14b | @ErrorPathFixer | High | Claude Opus 4.6 | Bug-fix OS-level syscalls — diagnóstico profundo | N/A |
| 14bv | @ErrorPathFixerValidator | Gemini Base | Gemini 3.0 | Validação read-only de Session 14b | COMPLIANT (Opus → Gemini) |

### Sessões Restantes (Acionáveis)

| Sessão | Agente | Tier | Modelo | Racional | R11 Status |
|--------|--------|------|--------|----------|------------|
| **14c** | @BuildRemediation | **Medium** | **Claude Sonnet 4.6** | Fix dependência circular, init git, CHANGELOG, readJsonFile try/catch, reset non-TTY, gate path separators, cleanup artefatos, .gitignore, types field. | — (validado no Milestone A2) |
| **14d** | @TestHardener | **Medium** | **Claude Sonnet 4.6** | Novos testes: generate-command, reset-command, JSON corrupto, seed corrupto. Target >= 48 testes. | — (validado no Milestone A2) |
| **14e** | @GateHardener | **Medium** | **Claude Sonnet 4.6** | Fix gate regex bilíngue, verdict parse-error, copy-seed JSON validation. | — (validado no Milestone A2) |
| **Milestone A2** | @PreFlightValidator | **Gemini Specialist** | **Gemini 3.1 Pro** | Validação consolidada 14c+14d+14e. Build, testes, preflight, git, cleanup. | COMPLIANT (Sonnet → Gemini Specialist) |
| **15** | @CrossPlatformVerifier | **Medium** | **Claude Sonnet 4.6** | Cross-platform verification envolve bug-fixing ativo (não apenas execução mecânica). Failure modes DC-1/DC-5 são de Opus, não Sonnet. Escalação para Opus via §6 se houver bug OS-level intratável. | — (validado no Milestone B) |
| **16** | @AntigravityFinalAuditor | **Gemini Base** | **Gemini 3.0** | Auditoria final E2E — execução mecânica rígida (DC-5 aplica-se a Claude). Verificação spec-por-spec sem julgamento arquitetural. | **EXCEPTION** — same-family no Milestone B, mitigada (ver §4) |
| **Milestone B** | @MilestoneReviewer | **Gemini Specialist** | **Gemini 3.1 Pro** | Validação consolidada de Sessions 15 + 16. Substitui 15v e 16v individuais. Cross-platform report review + final audit cross-check. | Session 15: COMPLIANT. Session 16: EXCEPTION mitigada. |
| **17** | @Publisher | **Low** | **Claude Haiku 4.6** | Version bump, CHANGELOG, tag, npm publish. Operações de string/metadata com dry-run obrigatório antes de publish real. | — (validado no Milestone C) |
| **Milestone C** | @FinalMilestoneReviewer | **Gemini Specialist** | **Gemini 3.1 Pro** | Validação consolidada de Session 17 + sign-off total do projeto. Verificação do pacote publicado, install do registry, compliance final. | COMPLIANT (Haiku → Gemini Specialist) |

### Consolidação de Validações em Milestones

| Milestone | Ponto de Disparo | Sessões de Validação Substituídas | Reviewer | Escopo de Verificação |
|-----------|-----------------|----------------------------------|----------|----------------------|
| **A** (histórico) | Post-14bv | 12v, 13v, 14av, 14bv | Já executado individualmente | Referência histórica — nenhuma ação necessária |
| **A2** | Post-14e | **14c + 14d + 14e** (remediação de build) | **Gemini 3.1 Pro** | Verificar build funcional, >= 48 testes, preflight green, git init, cleanup de artefatos, novos testes, gate scripts corrigidos. |
| **B** | Após conclusão da Session 16 | **15v + 16v** (eliminadas como sessões individuais) | **Gemini 3.1 Pro** | (1) Verificar cross-platform report de Session 15 com output literal de cada plataforma. (2) Cross-check auditoria final de Session 16 contra `project-specs.md`. (3) Rodar `npm run gate` e colar transcript. (4) Executar adversarial checklist para Session 16 (same-family). |
| **C** | Após conclusão da Session 17 | **17v** (eliminada como sessão individual) | **Gemini 3.1 Pro** | (1) Verificar pacote publicado via `npm view @projeto-zero/cli`. (2) Install from registry em sandbox limpo. (3) Rodar `antigravity info` + `generate` no sandbox. (4) Verificar CHANGELOG e tag git. (5) Full compliance sign-off do projeto inteiro. |

**Economia de tokens/cota:** 3 sessões de validação individuais (15v, 16v, 17v) reduzidas para 2 Milestones (B, C). Cada Milestone lê apenas handoffs + gate transcripts, não arquivos de implementação inteiros, reduzindo consumo de context window.

---

## §4 — R11 Compliance Matrix

### Quadro de Conformidade

| # | Implementação | Família Impl | Validação/Milestone | Família Val | R11 Status | Notas |
|---|--------------|-------------|---------------------|-------------|------------|-------|
| 1 | Session 15 | Claude (Sonnet) | Milestone B | Gemini (Specialist) | **COMPLIANT** | Cross-family: Claude → Gemini |
| 2 | Session 16 | Gemini (Base) | Milestone B | Gemini (Specialist) | **EXCEPTION** | Same-family: Gemini → Gemini. Mitigação obrigatória. |
| 3 | Session 17 | Claude (Haiku) | Milestone C | Gemini (Specialist) | **COMPLIANT** | Cross-family: Claude → Gemini |

### Resolução do Paradoxo R11

**Contexto:** O paradoxo documentado em `.agents/session-router-blockers.md` questionava se template-compliance (Gemini valida Gemini) deveria prevalecer sobre adversarial separation (Claude valida, mas falha em templates).

**Decisão:** Template-compliance prevalece para Session 16, com mitigação explícita. Racional:

1. Session 15 foi **reclassificada para Claude Sonnet** (Tier Medium), eliminando o paradoxo para essa sessão. Os failure modes que desqualificaram Claude (DC-1 a DC-6) foram observados especificamente com Opus, não com Sonnet.

2. Session 16 permanece em Gemini Base porque a auditoria final mecânica é o caso exato de DC-5 (cross-platform strict execution) que desqualifica Claude.

3. Para Session 16, o Milestone B aplica a **Adversarial Checklist for Same-Family Review** (definida no `_agent-mandate.md` §2), que inclui verificações anti-blindspot específicas contra os padrões de falha conhecidos.

### Adversarial Checklist for Same-Family Review (Session 16 no Milestone B)

O reviewer (Gemini 3.1 Pro) DEVE executar estes checks adicionais ao revisar output de Gemini Base:

1. **Evidence Literality** — Para cada teste descrito como "executado" no handoff de Session 16, verificar se o output literal completo foi colado (não apenas "all tests pass" ou "verified").
2. **File Existence** — Para cada arquivo descrito como "criado" ou "verificado", executar `ls` para confirmar existência real no disco.
3. **Anti-"Technically Compiles"** — Buscar claims de completude sem evidência de execução E2E real. Comparar contra o padrão da Session 11 (declarou cross-platform success sem executar em macOS/Linux).
4. **Per-Platform Output** — Para claims cross-platform, exigir output separado de CADA plataforma individualmente. Generalizações como "works on all platforms" são automaticamente **FAIL**.
5. **Spec-by-Spec Diff** — Verificar que cada requirement em `project-specs.md` tem um PASS com evidência, não apenas um checkmark narrativo.

---

## §5 — Setup Agent Mandate

### Referência Normativa

Todo prompt de sessão — implementação ou validação — DEVE incluir como
**item 0** da seção "Before You Do Anything" a leitura obrigatória de:

```
0. `.agents/prompts/_agent-mandate.md`
```

O mandate contém três protocolos operacionais:

| # | Protocolo | Aplica-se a | Objetivo |
|---|-----------|-------------|----------|
| 1 | **Ciclo Plan-and-Execute** | Tier Medium (Sonnet), Tier High (Opus) | Proibir geração one-shot. Forçar emissão de state log + scope declaration antes de qualquer execução. |
| 2 | **Mitigação R11 — Validação Adversária** | Milestone Reviewers (Gemini Specialist) | Garantir que validações cross-family executem evidência (R9) e não confiem em narrativa. Inclui adversarial checklist para exceções same-family. |
| 3 | **Mitigação R17 — Protocolo Mecânico** | Todas as sessões que geram next-session prompts | Forçar cópia literal da row do roadmap, bloqueando a capacidade do agente de "inventar" a próxima etapa. Esclarecer que R17(c) define família, tier table define modelo. |

### Esclarecimento R17(c) — Família vs. Tier

A regra R17(c) no `_production-contract.txt` diz:

> *"Model assignment is mechanical, not negotiable: if the next row is an
> implementation row, the prompt targets Claude Code CLI; if it is a
> validation row, the prompt targets Antigravity AI / Gemini."*

Com a introdução do tier system, R17(c) determina a **família do modelo**
(Claude ou Gemini). O **modelo específico** dentro da família é determinado
pela tabela de tiers no §3 deste documento. Selecionar Haiku vs. Sonnet vs.
Opus dentro da família Claude NÃO constitui violação de R17(c).

---

## §6 — Mid-Session Hand-Off: Session 15 → Opus Escalation

### Mecanismo (preservado de `pipeline-routing-plan.md` §4.1)

**Condição de disparo:**
Durante a execução da Session 15 pelo Claude Sonnet, se `npm run preflight`
ou verificação E2E manual em qualquer uma das 4 plataformas declaradas falhar
explicitamente devido a um erro de boundary OS/Node.js profundamente aninhado
(ex: falhas de `EACCES` handling no Windows, quirks de `TerminateProcess`,
misfires de `readline` TTY no macOS) que Sonnet não consiga patchar
nativamente em uma tentativa.

**Por que Opus:**
Invoca o Critério de Vantagem §1 do Tier High (diagnóstico de falhas cujo
root cause vive em framework internals ou syscalls do OS).

**Prompt literal para escalação:**

```text
@Claude (Opus), you are a localized OS bug-fixer functioning as a sub-routine
for the Session 15 Sonnet agent.

Read:
1. `apps/cli/src/commands/<failing_file>.ts`
2. `.agents/cross-platform-report.md` (read ONLY the section describing the
   current OS bug)

Mission:
1. Diagnose the OS-specific implementation failure described in the
   cross-platform report.
2. Provide a surgical diff or rewritten function for the target file that
   handles the OS edge case natively and allows the execution to complete.
3. Stop and emit the diff.

Hard Scope Fence:
- ALLOWED: `apps/cli/src/commands/<failing_file>.ts` or `apps/cli/src/lib/`.
- FORBIDDEN: `.agents/prompts/**`, `scripts/**`, `PROJECT_ROADMAP.md`,
  `package.json`, `.agents/handoffs/**`.

Forbidden Behaviors:
- DO NOT answer with a written handoff document or a Self-Grading Table.
- DO NOT generate a next-session prompt (Rule R17 is strictly suspended for
  this call).
- NO EXPLANATORY CEREMONY. Emit the exact diff/code block and a maximum of
  3 sentences explaining the internal OS mechanic causing the divergence.

Return Condition:
Sonnet will take your code block, patch the file, and re-run the OS test.
If the test still fails, Sonnet will ask you exactly ONCE with the updated
stack trace. If the second attempt fails, Sonnet will escalate to the human
immediately.
```

**Limites:** Máximo de 2 tentativas Opus. Após a segunda falha, escalação
para humano. Opus NÃO produz handoff, NÃO atualiza roadmap, NÃO gera
next-session prompt. O controle retorna integralmente para Sonnet (ou
humano).

---

## §7 — Changelog vs. Documento Supersedido

### O que mudou de `pipeline-routing-plan.md`

| Seção Original | Status | Destino no Novo Documento |
|----------------|--------|--------------------------|
| §1 Comparative-Advantage Criteria | Absorvido | §1 Tier definitions (5 capability claims → tier permissions) |
| §2 Disqualifying Criteria | Expandido | §2 (6 critérios Claude + 2 Gemini Specialist + 2 Haiku, com sessão-fonte) |
| §3 Per-Session Routing Table | Substituído | §3 Retroactive + Actionable routing table com tiers e Milestones |
| §4 Mid-Session Hand-Off Blocks | Preservado | §6 (atualizado: Sonnet como driver base, não Gemini) |
| §5 Session 14b Claude Prompt | Preservado in-situ | Mantido no documento supersedido (referência histórica, sessão já completa) |
| §6 Honest Risk Assessment | Substituído | §4 R11 Compliance Matrix + Adversarial Checklist |

### Mudanças Estruturais

1. **Introdução do Tier System** — Cinco tiers com permissões e proibições explícitas substituem o modelo binário Claude/Gemini.
2. **Consolidação de Milestones** — 3 validações individuais (15v, 16v, 17v) consolidadas em 2 Milestones (B, C) executados por Gemini 3.1 Pro.
3. **Reclassificação Session 15** — De Gemini Base para Claude Sonnet (Medium) para preservar R11 cross-family compliance.
4. **Agent Mandate** — Novo arquivo de metaprompting (`_agent-mandate.md`) com Plan-and-Execute, R11 e R17 protocolos.
5. **Resolução do Paradoxo R11** — Documentação explícita da exceção Session 16 com adversarial checklist.
