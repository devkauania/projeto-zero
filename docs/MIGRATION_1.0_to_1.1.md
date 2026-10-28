# Migration: `@projeto-zero/cli` v1.0.x → v1.1.0

v1.1.0 is a Claude-only lock. The CLI now scaffolds a **Claude Code**-oriented
workspace shape instead of the legacy multi-LLM mixed layout. Legacy agent
identifiers (`ClaudeCoder`, `AntigravityDesigner`, `AntigravityAuditor`,
`MCPConfigurator`) are renamed, and the on-disk scaffold emitted by `init` is
materially different.

If you were on v1.0.x and you are creating a **new** project, there is nothing
to do — just run `antigravity init` and you will get the new layout.

If you have an existing v1.0.x scaffold that you want to bring up to the v1.1.0
shape, this doc walks you through it.

---

## What changed

### 1. Agent identifiers renamed

| v1.0.x                | v1.1.0     |
| --------------------- | ---------- |
| `ClaudeCoder`         | `coder`    |
| `AntigravityDesigner` | `designer` |
| `AntigravityAuditor`  | `auditor`  |
| `MCPConfigurator`     | `mcp`      |

The new ids are short and lowercase. Each subagent file (`.agents/<id>.md`)
uses the frontmatter Claude Code reads (`name`/`description`/`tools`); Claude
Code itself discovers project subagents in `.claude/agents/`, so copy them there
to use them.

### 2. Scaffold shape

v1.0.x emitted a mixed `src/` starter plus a private `.claude/settings.project.json`
and a per-project `default-wizard-config.json` marker. None of that was Claude
Code–native.

v1.1.0 emits the following layout at the target directory (Claude Code's own
discovery paths are `.claude/agents/`, `.claude/skills/<id>/SKILL.md` and a root
`.mcp.json` — see the "What `generate` writes" section of the root README):

```
<project>/
├─ CLAUDE.md                     # project memory root, lists subagents + skills
├─ .agents/
│  ├─ coder.md                   # subagent (YAML frontmatter: name/description/tools)
│  ├─ designer.md
│  ├─ auditor.md
│  ├─ mcp.md
│  └─ prompts/
│     └─ .gitkeep                # reserved for the Stage 3 prompt browser
├─ skills/
│  ├─ coder/SKILL.md             # skill (YAML frontmatter: name/description)
│  ├─ designer/SKILL.md
│  ├─ auditor/SKILL.md
│  └─ mcp/SKILL.md
└─ .mcp/
   ├─ supabase.json              # one JSON per selected connector
   ├─ figma.json
   └─ ...
```

Subagent and skill bodies are only written when `includeTemplates: true`.
Directory skeleton plus `.gitkeep` are always created.

### 3. Dead config fields removed

`WizardConfig.defaults` has been narrowed to `{ targetDir: string }`. The
following fields were dead code in v1.0.x and are gone in v1.1.0:

- `defaults.scaffoldAgentsDir`
- `defaults.scaffoldPromptsDir`

If you saved a v1.0.x config with these fields, `loadConfig()` returns the
saved shape as-is (Conf stores exactly what you wrote), but the CLI ignores
them. To clean up, run `antigravity reset` and re-run `antigravity init`.

### 4. What is NOT emitted anymore

These were v1.0.x artifacts that v1.1.0 deliberately drops:

- `src/` starter (hello-world source files)
- `.claude/settings.project.json` (Claude Code reads `CLAUDE.md` directly)
- `.agents/project-config.json` marker
- `default-wizard-config.json` inside the generated project

The user's global wizard config (stored via `Conf` under `antigravity-wizard`)
is unaffected by this change.

---

## Upgrade steps for an existing v1.0.x scaffold

You have two options. Pick one.

### Option A — Re-scaffold (recommended)

1. Commit or stash any real work in the project.
2. Delete the generated artifacts: `src/` (if untouched), `.claude/`,
   `.agents/project-config.json`, `default-wizard-config.json`.
3. Install v1.1.0: `npm install -g @projeto-zero/cli@1.1.0`.
4. From the project root, run `antigravity init` and answer the prompts.
5. Commit the new `CLAUDE.md`, `.agents/`, `skills/`, `.mcp/`.

### Option B — Manual rename

If you have customized agent files you want to keep:

1. Rename the subagent files:
   - `.agents/ClaudeCoder.md` → `.agents/coder.md`
   - `.agents/AntigravityDesigner.md` → `.agents/designer.md`
   - `.agents/AntigravityAuditor.md` → `.agents/auditor.md`
   - `.agents/MCPConfigurator.md` → `.agents/mcp.md`
2. Update the `name:` field in each file's YAML frontmatter to match.
3. Create `skills/<id>/SKILL.md` for each kept agent (see the shape above).
4. Create a root `CLAUDE.md` (run `antigravity init --dry-run` once in a
   scratch dir to get a canonical template, then adapt).
5. Move any MCP settings you had in `.claude/settings.project.json` into
   `.mcp/<connector>.json` files (one per connector).
6. Delete the legacy `.claude/` and `.agents/project-config.json` files.

---

## Why the lock

v1.0.x shipped copy that implied multi-LLM support (`ClaudeCoder` sat next
to `AntigravityDesigner` — the naming suggested the CLI was a neutral
coordinator). In practice every integration path (subagents, skills, MCP
connector wiring, CLAUDE.md) was Claude Code specific. Keeping the
multi-LLM framing in the UX created two real problems:

1. Users picked agents expecting they could wire in non-Claude runtimes, and
   hit dead ends.
2. Audit surface grew — a ledger of security tripwires (see
   `audit/vulnerability-ledger.md`) has to cover every framing the CLI
   advertises.

v1.1.0 makes the positioning honest: `@projeto-zero/cli` scaffolds Claude
Code workspaces and launches Claude Code agent swarms. A CI guard
(`scripts/check-no-multi-llm.mjs`) keeps the live product surface locked to
that positioning — legacy terms are allowed only in historical docs
(`CHANGELOG.md`, `docs/MIGRATION_*`, `audit/**`).

---

## Compatibility

- Node: ≥ 20 (unchanged from v1.0.x)
- OS: macOS, Linux, Windows (PowerShell 5.1 / 7.4 / Git Bash)
- Requires `claude --version` on PATH for `antigravity swarm` (new in v1.1.0)

If you hit a migration issue not covered here, open an issue:
<https://github.com/devkauania/Projeto-Zero/issues>.
