# @projeto-zero/cli

Scaffolds Claude Code agent workspaces — subagents, skills, MCP connectors — and launches parallel Claude Code agent swarms.

## Prerequisites

Requires the Claude Code CLI. Verify with:

```bash
claude --version
```

Install it from https://docs.claude.com/claude-code if it's missing.

## Installation

Install the CLI globally via npm to use it from anywhere:

```bash
npm install -g @projeto-zero/cli
```

Or run it directly without installing via `npx`:

```bash
npx @projeto-zero/cli init
```

## Usage

The CLI is designed to act as an interactive "Setup Wizard" that provisions your project directories and installs essential files natively. 

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
- Whether to include `.agents/` prompt templates.

This command writes your choices to disk (persisted statelessly via `conf` package), but **does not** generate any files.

```bash
antigravity init
```

### `generate`
Generates the project files based on the configuration persisted by the `init` command. 

```bash
antigravity generate [options]
```

**Options:**
- `-d, --dir <path>`: Provide a target directory. If no directory is supplied and there is no default loaded, you will be interactively prompted for the exact output directory location.

### `info`
Shows a summary of your currently saved setup configuration without making any changes. 

```bash
antigravity info
```

### `reset`
**Danger Zone.** Completely clears the active configuration file saved by `init`. Prompts for final confirmation before doing so. 

```bash
antigravity reset
```

### `swarm`
Launches a parallel Claude Code agent swarm against the prompts in `.agents/prompts/*.md`. Dry-run is the default — agents only spawn when you pass `--live`. See [`docs/SWARM.md`](../../docs/SWARM.md) for safety defaults, grid layouts, and the `--i-understand` gate.

```bash
antigravity swarm --count 3          # preview plan (dry-run)
antigravity swarm --count 3 --live   # actually spawn
antigravity swarm --count 2 --mode verify --live   # read-only review pass
```

---

## Environment Variables

### `ANTIGRAVITY_CONFIG_DIR`

The CLI caches your settings globally using `conf`. You can override the directory where these preferences are saved by providing the `ANTIGRAVITY_CONFIG_DIR` environment variable. This is highly recommended for CI/CD pipelines, sandboxes, or running isolated tests to prevent modifying your local development host's native configuration.

```bash
# Example overriding config structure
ANTIGRAVITY_CONFIG_DIR="/tmp/mock-cli-tests" antigravity init
```

---

## Example Trace

Here is an example trace of navigating through a fresh project scaffolding setup:

```text
$ npx @projeto-zero/cli init
│
◇  Projeto Zero Interactive Setup 
│
◇  What is your project name?
│  super-app
│
◇  Select Claude Code subagents to scaffold:
│  coder, auditor
│
◇  Generate .agents/ prompt templates?
│  Yes
│
◇  Configuration saved successfully!
│
└  Setup complete. You can now run "generate" or "info".

$ npx @projeto-zero/cli generate --dir ./src
│
◇  Code Generation
│
◇  Scaffold completed!
│
◇  Created 4 artifacts in ./src
│
└  Generated 4 artifacts in the target directory.
```

---

## Troubleshooting

### "No configuration found. Please run 'init' first."
You are trying to execute `generate` or `info` before establishing the configuration state. **Solution**: Simply run `antigravity init` to configure the wizard.

### My setup failed for an unknown directory error
The `generate` command natively handles formatting against any path you provide, but if the location lacks write privileges or hits Windows OS restrictions cross-environment, you will observe an error trace. Provide an access-level path such as `-d ./` or an elevated terminal check.

### State mismatch crossing directories
Since `antigravity` saves state locally on your machine, running `init` on one project and `generate` without re-running `init` across another repo will inherit the previous config values. Use `antigravity reset` to safely purge settings before pivoting scopes.
