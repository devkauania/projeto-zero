# Especificação do Projeto: Interactive CLI Setup Wizard

## Visão Geral
Construir uma ferramenta de Linha de Comando (CLI) interativa, bonita e extremamente rápida usando **Node.js** e a biblioteca **@clack/prompts** (para interfaces ricas em terminal) misturada com **Commander**.
Sua principal função é atuar como o "Wizard Mestre" da fábrica: rodar num diretório vazio ou existente e formatá-lo com todos os subdiretórios (.agents/prompts, arquivos de configuração do Claude, monorepo template, etc).

## Requisitos de Negócio e Dados
Sendo uma CLI, não haverá UI web (Next.js/React visuais) na primeira versão. 
**Tipo de Serviço:** Utilitário Node (Script de Automação Interativa).

### 1. Dados e Estruturas Essenciais
A CLI precisará armazenar configurações para memorizar as preferências do usuário, portanto usaremos dados persistidos de maneira estática em disco:
- Usaremos um mini-banco/store em JSON (localizado em `~/.antigravity-wizard.json`) via pacote `conf` ou apenas usando Node `fs`.
- Este repositório vai modelar uma tabela lógica de leitura: Model `ConfigTemplate` (Salva caminhos para pipelines preferidos, etc).

### 2. Rotas e Acesso (APIs Nativas)
- Não usaremos Hono ou Drizzle neste escopo estrito, pois se trata de um utilitário CLI e não um serviço SaaS na Web. (Os Agentes Backend devem focar APENAS nas lógicas de Sistema Operacional de leitura/escrita via `node:fs`, `child_process` e manipulação de arquivos).
- "Endpoints" traduzem-se para **Commands**:
  - `init`: Inicializa o CLI interativo com perguntas de "Sim/Não" sobre quais agentes quer plugar (`@clack/prompts`).
  - `generate`: Cria todos os arquivos base (.md, .txt de agentes) no diretório em que está sendo rodado.

### 3. Funcionalidade e Estabilidade
- Tem que rodar em Windows perfeitamente de acordo com as permissões restritas. (Uso imperativo de cross-platform filesystem modules como `path` normalizado).

## Arquitetura de Design
- Por ser CLI, os componentes "visuais" e os agentes de frontend não vão atuar no ShadCN/React tradicionais. Eles vão focar no design de terminal:
  - Usar barras de carregamento elegantes (`@clack/prompts` spinner).
  - Cores semânticas via `picocolors`.
  - Arte em ASCII para o logo do Antigravity usando `figlet`.
