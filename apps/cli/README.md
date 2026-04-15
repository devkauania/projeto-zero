# @projeto-zero/cli

Interactive CLI Setup Wizard for the Antigravity project. Scaffolds `.agents/` prompts and Claude project config in any directory.

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
- Which agents you want to enable (such as `ClaudeCoder`, `AntigravityDesigner`, etc.).
- Which MCP connectors to enable (if the MCP agent was selected).
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
◇  Which agents do you want to enable?
│  ClaudeCoder, AntigravityAuditor
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
◇  Created 2 artifacts in ./src
│
└  Generated 2 artifacts in the target directory.
```

---

## Troubleshooting

### "No configuration found. Please run 'init' first."
You are trying to execute `generate` or `info` before establishing the configuration state. **Solution**: Simply run `antigravity init` to configure the wizard.

### My setup failed for an unknown directory error
The `generate` command natively handles formatting against any path you provide, but if the location lacks write privileges or hits Windows OS restrictions cross-environment, you will observe an error trace. Provide an access-level path such as `-d ./` or an elevated terminal check.

### State mismatch crossing directories
Since `antigravity` saves state locally on your machine, running `init` on one project and `generate` without re-running `init` across another repo will inherit the previous config values. Use `antigravity reset` to safely purge settings before pivoting scopes.
