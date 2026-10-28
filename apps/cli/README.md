# @projeto-zero/cli

Scaffolds Claude Code agent workspaces — subagents, skills, MCP connectors — and launches parallel Claude Code agent swarms.

## Prerequisites

Requires the Claude Code CLI. Verify with:

```bash
claude --version
```

Install it from https://docs.claude.com/claude-code if it's missing.

## Installation

Run the CLI without installing via `npx` (recommended for one-shot scaffolding):

```bash
npx -y @projeto-zero/cli init
```

Or install globally once and re-use the same binary across projects:

```bash
npm install -g @projeto-zero/cli
```

> After a global install, the CLI is also available as `antigravity <command>` (legacy binary name retained for back-compat). All examples below use `npx` so they work without a global install.

## Usage

The CLI is designed to act as an interactive "Setup Wizard" that writes a scaffold of agent, skill, and connector files into a directory you choose.

The standard workflow:
1. `init`
2. (Optional) `info`
3. `generate`

---

## Commands

### `init`
Initialize the wizard with interactive prompts. It will ask for:
- Your project's name.
- Which Claude Code subagents to scaffold (coder, designer, auditor, mcp — selected by role, not by legacy display name).
- Which MCP connectors to enable (if the `mcp` subagent is selected).
- Whether to include Claude Code subagent + skill template files.

This command writes your choices to disk (persisted statelessly via `conf` package), but **does not** generate any files.

```bash
npx -y @projeto-zero/cli init
```

### `generate`
Generates the project files based on the configuration persisted by the `init` command. It writes `CLAUDE.md`, `.agents/prompts/.gitkeep`, and, when templates are enabled, `.agents/<id>.md` plus `skills/<id>/SKILL.md` for each selected agent. It also writes one `.mcp/<connector>.json` descriptor (`id`, `label`, `description`, `tools`) per selected connector.

> Claude Code discovers project subagents in `.claude/agents/`, skills in `.claude/skills/<id>/SKILL.md`, and MCP servers in a root `.mcp.json` (`{"mcpServers": {...}}`). The generated subagent and skill files already use the frontmatter Claude Code reads, so copy them into those folders to use them. The `.mcp/*.json` descriptors have no launch command or URL, so register servers with `claude mcp add --scope project`.

```bash
npx -y @projeto-zero/cli generate [options]
```

**Options:**
- `-d, --dir <path>`: Provide a target directory. If no directory is supplied and there is no default loaded, you will be interactively prompted for the exact output directory location.

### `info`
Shows a summary of your currently saved setup configuration without making any changes.

```bash
npx -y @projeto-zero/cli info
```

### `reset`
**Danger Zone.** Completely clears the active configuration file saved by `init`. Prompts for final confirmation before doing so.

```bash
npx -y @projeto-zero/cli reset
```

### `swarm`
Launches a parallel Claude Code agent swarm against the prompts in `.agents/prompts/*.md`. Dry-run is the default — agents only spawn when you pass `--live`. See [`docs/SWARM.md`](../../docs/SWARM.md) for safety defaults, grid layouts, and the `--i-understand` gate.

> Note: `generate` creates `.agents/prompts/` as an empty folder (with a `.gitkeep`). You populate it with your own `*.md` prompt files before running `swarm`.

```bash
npx -y @projeto-zero/cli swarm --count 3          # preview plan (dry-run)
npx -y @projeto-zero/cli swarm --count 3 --live   # actually spawn
npx -y @projeto-zero/cli swarm --count 2 --mode verify --live   # read-only review pass
```

---

## Environment Variables

### `ANTIGRAVITY_CONFIG_DIR`

The CLI caches your settings globally using `conf`. You can override the directory where these preferences are saved by providing the `ANTIGRAVITY_CONFIG_DIR` environment variable. This is highly recommended for CI/CD pipelines, sandboxes, or running isolated tests to prevent modifying your local development host's native configuration.

```bash
# Example overriding config structure
ANTIGRAVITY_CONFIG_DIR="/tmp/mock-cli-tests" npx -y @projeto-zero/cli init
```

> Env var name retained from v1.0 for back-compat with existing pipelines. Renaming is tracked as a breaking change for a future major.

---

## Example Trace

Here is an example trace of navigating through a fresh project scaffolding setup (selecting `coder` + `auditor`, templates enabled):

```text
$ npx -y @projeto-zero/cli init
│
◇  Projeto Zero Interactive Setup
│
◇  What is your project name?
│  super-app
│
◇  Select Claude Code subagents to scaffold:
│  coder, auditor
│
◇  Include Claude Code subagent + skill template files?
│  Yes
│
◇  Configuration saved successfully!
│
└  Setup complete. You can now run "generate" or "info".

$ npx -y @projeto-zero/cli generate --dir ./src
│
◇  Code Generation
│
◇  Scaffold completed!
│
◇  Created 6 artifacts in ./src
│
└  Generated 6 artifacts in the target directory.
```

The 6 artifacts for a two-agent selection with templates enabled:

```
CLAUDE.md
.agents/coder.md
.agents/auditor.md
.agents/prompts/.gitkeep
skills/coder/SKILL.md
skills/auditor/SKILL.md
```

Formula: `2 + 2N` artifacts — `CLAUDE.md` + `.agents/prompts/.gitkeep` + one `.agents/<id>.md` and one `skills/<id>/SKILL.md` per selected subagent. MCP connector files add one JSON per selected connector on top.

---

## Troubleshooting

### "No configuration found. Please run 'init' first."
You are trying to execute `generate` or `info` before establishing the configuration state. **Solution**: Simply run `npx -y @projeto-zero/cli init` to configure the wizard.

### My setup failed for an unknown directory error
The `generate` command natively handles formatting against any path you provide, but if the location lacks write privileges or hits Windows OS restrictions cross-environment, you will observe an error trace. Provide an access-level path such as `-d ./` or an elevated terminal check.

### State mismatch crossing directories
Since the CLI saves state locally on your machine, running `init` on one project and `generate` without re-running `init` across another repo will inherit the previous config values. Use `npx -y @projeto-zero/cli reset` to safely purge settings before pivoting scopes.

### Swarm says "no prompts discovered"
`generate` creates `.agents/prompts/` as an empty folder. Author your own `*.md` prompt files there before running `swarm`, or pass an explicit glob via `--prompts <pattern>`.
