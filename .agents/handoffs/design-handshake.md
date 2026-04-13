# Terminal UX Design Handshake

**Target Audience:** `@AntigravityDesigner` and `@UIArchitect` (Sessions 9-10)

This document establishes the UI/UX specifications for the Terminal Flow of `@projeto-zero/cli`, leveraging `@clack/prompts`, `picocolors`, and `figlet` to deliver a premium, modern developer experience.

## 1. Global Visual Identity

- **Library Usage**: We will use `@clack/prompts` for all interactive flows to ensure a cohesive, linear "setup wizard" feel.
- **Color Palette (`picocolors`)**:
  - **Brand/Primary**: `cyan` (Banners, main prompts, highlighted paths)
  - **Success**: `green` (Completed steps, successful saves)
  - **Warning**: `yellow` (Missing configurations, cancellations, reset prompts)
  - **Error**: `red` (Corrupted state, failed generations)
  - **Secondary/Muted**: `dim` (File paths, descriptive hints, JSON structures)
- **ASCII Art Banner**:
  - Displayed on the `init` command.
  - Tool: `figlet` (Font: "Standard" or "Slant").
  - Content: "Projeto Zero".
  - Color: Gradient or solid `cyan`.

## 2. Step-by-Step Command Flows

### 2.1 `init` (Configuration Wizard)
The entry point for new users. Needs to feel incredibly smooth and welcoming.
1. **Boot**: Print the ASCII banner in `cyan`, followed directly by `intro(bgCyan(black(' Projeto Zero Interactive Setup ')))`.
2. **Prompts**:
   - `multiselect`: "Which MCP connectors would you like to enable?"
     - Options should be nicely formatted, e.g., `value: "supabase", label: "Supabase", hint: "Database and Auth"`
3. **Processing**:
   - Instantiate `spinner()`.
   - `s.start('Saving wizard configuration...')`
   - Wait for logic to complete.
   - `s.stop('Configuration saved successfully!')`
4. **Outro**: `outro(green('Setup complete. You can now run "generate" or "info".'))`

### 2.2 `generate` (Scaffolding Engine)
This is an action-heavy command. The user needs to see what the system is doing.
1. **Boot**: `intro(inverse(' Code Generation '));`
2. **Pre-flight Checks**:
   - If config missing: Print `note(yellow('No configuration found. Please run "init" first.'))` and exit early with `outro()`.
3. **Prompts** (if directory argument `-d` is missing):
   - `text`: "Where should we generate the resources? (e.g., ./output)" (with auto-validation).
4. **Processing**:
   - Use `spinner()`.
   - `s.start('Scaffolding resources...')`
   - Read from config and execute generation.
   - `s.stop('Scaffold completed!')`
5. **Outro**: `outro(green('Generated 10 artifacts in the target directory.'))` (Use `dim` to list the destination path contextually).

### 2.3 `reset` (Destructive Action)
Needs to prevent accidental data loss while remaining polite.
1. **Boot**: `intro(bgRed(white(' DANGER ZONE ')))`
2. **Prompt**:
   - `confirm`: "Are you sure you want to clear the configuration? This cannot be undone." with default `false`.
3. **Execution**:
   - If `false`: `outro(dim('Reset cancelled. Configuration left untouched.'))`
   - If `true`: Proceed with wipe.
   - `spinner()` -> `s.start('Clearing...')` -> `s.stop('Cleared.')`
   - `outro(yellow('Configuration has been reset to zero.'))`

### 2.4 `info` (Read-only State)
This is purely informational, so NO interactive prompts. Must NOT feel like a wizard.
1. **Boot**: No `intro()` or `outro()` needed. Just clean console output.
2. **Format**:
   - Instead of `console.log(config)`, pretty-print the layout.
   - Example:
     ```
     > bold(cyan('Projeto Zero Configuration State:'))
     > 
     > mcpConnectors:
     >  - green('supabase')
     >  - green('github')
     ```
3. **Empty State**: If missing, gracefully output `yellow('No setup configuration found. Run init first.')`.

## 3. Strict Integration Rules
- **No ad-hoc console.logs**: Inside interactive runs, replace all primitive `console.log` with `clack.log.step`, `clack.log.success`, `clack.log.error` or `clack.note` to prevent breaking the terminal layout.
- **Graceful Exits**: Handle `isCancel(result)` rigidly. If a user presses `Ctrl+C` on a prompt, the application should `cancel('Operation aborted.')` and gracefully exit with `process.exit(0)`.
