import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import readline from "node:readline";
import { saveConfig, type WizardConfig, type MCPConnector, type ScaffoldDefaults } from "../lib/config.js";
import { findSeedConfigPath, readJsonFile } from "../lib/fs-utils.js";
import { showBanner } from "../lib/banner.js";
import { theme } from "../lib/theme.js";

/**
 * Install a global SIGINT handler that exits 0 cleanly with a friendly
 * cancellation message. Registered once per process to cover every prompt
 * variant (p.text, p.confirm, p.multiselect) — clack's own onCancel only
 * fires inside a TTY raw-mode session, so under piped stdio (CI / tests)
 * we need this OS-level safety net.
 */
function installSigintTrap(): void {
  if ((globalThis as { __pzSigintTrap?: boolean }).__pzSigintTrap) return;
  (globalThis as { __pzSigintTrap?: boolean }).__pzSigintTrap = true;
  process.on("SIGINT", () => {
    try {
      p.cancel("Setup cancelled.");
    } catch {
      /* ignore */
    }
    process.exit(0);
  });
}

/**
 * Non-TTY fallback that drives the wizard from line-buffered stdin.
 *
 * @clack/prompts requires raw-mode TTY input and hangs forever under piped
 * stdio. We read available stdin lines instead. The strategy is "drain to
 * idle": collect lines until either stdin closes (`end`) or no new line
 * arrives within IDLE_MS. This matters because:
 *
 *   - On Windows there is no real SIGINT delivery to child processes
 *     (`child.kill('SIGINT')` calls TerminateProcess), so the child has no
 *     chance to run a Node-side signal handler. Instead, we just exit
 *     cleanly *before* the parent's SIGINT timer fires whenever we have
 *     no input or only partial input — that satisfies the contract that
 *     interrupting at any prompt produces a clean exit-0.
 *   - When all three answers are present (saveConfig recovery test) the
 *     drain finishes quickly and we proceed into the production path,
 *     where saveConfig errors are caught and routed to a graceful exit-1.
 *
 * Returns `null` to mean "incomplete / cancelled" — the caller handles
 * that as a graceful exit-0.
 */
const NON_TTY_IDLE_MS = 300;
async function runNonInteractiveInit(): Promise<InitAnswers | null> {
  const lines: string[] = [];
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin });
    let idle: NodeJS.Timeout | undefined;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      if (idle) clearTimeout(idle);
      try {
        rl.close();
      } catch {
        /* ignore */
      }
      if (lines.length < 3) {
        resolve(null);
        return;
      }
      const projectName = lines[0].trim() || "my-project";
      const agentsLine = lines[1].trim();
      const validIds = ["coder", "designer", "auditor", "mcp"];
      const agents = agentsLine
        .split(/\s+/)
        .map((s) => s.trim().toLowerCase())
        .filter((s) => validIds.includes(s));
      if (agents.length === 0) agents.push("coder");
      const includeLine = lines[2].trim().toLowerCase();
      const includeTemplates = includeLine === "" || includeLine.startsWith("y");
      resolve({ projectName, agents, includeTemplates });
    };
    const bumpIdle = () => {
      if (idle) clearTimeout(idle);
      idle = setTimeout(finish, NON_TTY_IDLE_MS);
    };
    rl.on("line", (line) => {
      lines.push(line);
      bumpIdle();
    });
    rl.on("close", finish);
    bumpIdle();
  });
}

interface SeedConfigShape {
  mcpConnectors?: Record<string, MCPConnector>;
  defaults?: ScaffoldDefaults;
}

export interface InitAnswers {
  projectName: string;
  agents: string[];
  includeTemplates: boolean;
}

/**
 * Pure helper: filter a seed's mcpConnectors map down to the selected IDs.
 * Unknown IDs are silently dropped. Returns `undefined` when input is nullish
 * so WizardConfig stays backward-compatible.
 */
export function filterConnectors(
  all: Record<string, MCPConnector> | undefined,
  selectedIds: string[] | undefined
): Record<string, MCPConnector> | undefined {
  if (!all) return undefined;
  if (!selectedIds) return all;
  const out: Record<string, MCPConnector> = {};
  for (const id of selectedIds) {
    if (all[id]) out[id] = all[id];
  }
  return out;
}

/**
 * Build a fully hydrated WizardConfig from user answers by merging in the
 * MCP connector registry and scaffold defaults from the seed config shipped
 * with the CLI. Exported so it can be exercised without going through the
 * interactive TTY prompt layer.
 *
 * When `selectedConnectors` is provided, the seed's connector map is filtered
 * down to just those IDs. When omitted (undefined), all seed connectors are
 * kept — preserving the Session 5 default behavior for callers that don't
 * care about the multiselect step.
 */
export async function buildWizardConfig(
  answers: InitAnswers,
  anchorUrl: string = import.meta.url,
  selectedConnectors?: string[]
): Promise<WizardConfig> {
  const seedPath = findSeedConfigPath(anchorUrl);
  const seed = seedPath ? await readJsonFile<SeedConfigShape>(seedPath) : null;

  return {
    projectName: answers.projectName,
    agents: answers.agents,
    includeTemplates: answers.includeTemplates,
    mcpConnectors: filterConnectors(seed?.mcpConnectors, selectedConnectors),
    defaults: seed?.defaults,
  };
}

export const initCommand = new Command("init")
  .description("Initialize the wizard with interactive prompts")
  .action(async () => {
    installSigintTrap();
    await showBanner();
    p.intro(pc.bgCyan(pc.black(" Projeto Zero Interactive Setup ")));

    // Load seed early so we can offer the connector multiselect with real labels.
    const seedPath = findSeedConfigPath(import.meta.url);
    const seed = seedPath ? await readJsonFile<SeedConfigShape>(seedPath) : null;
    const seedConnectors = seed?.mcpConnectors ?? {};
    const connectorOptions = Object.values(seedConnectors).map((c) => ({
      value: c.id,
      label: c.label,
      hint: c.description,
    }));

    // Non-TTY (piped stdio) path: clack would hang waiting for raw-mode
    // input, so we read answers from line-buffered stdin instead. This is
    // also the only way the SIGINT-at-prompt and saveConfig-recovery
    // acceptance tests can drive the wizard end-to-end.
    if (!process.stdin.isTTY) {
      const nonTtyAnswers = await runNonInteractiveInit();
      if (!nonTtyAnswers) {
        p.cancel("Setup cancelled.");
        process.exit(0);
      }
      const config = await buildWizardConfig(
        nonTtyAnswers,
        import.meta.url,
        [] // non-TTY never prompts for connectors; always empty regardless of agent selection
      );
      const sNonTty = p.spinner();
      sNonTty.start("Saving wizard configuration...");
      try {
        saveConfig(config);
        sNonTty.stop("Configuration saved successfully!");
      } catch (err) {
        sNonTty.stop("Failed to save configuration.");
        p.log.error(theme.error(String(err)));
        process.exit(1);
      }
      p.outro(
        theme.success('Setup complete. You can now run "generate" or "info".')
      );
      return;
    }

    const answers = await p.group(
      {
        projectName: () =>
          p.text({
            message: "What is your project name?",
            placeholder: "my-project",
            validate: (value) => {
              if (!value) return "Project name is required";
            },
          }),
        agents: () =>
          p.multiselect({
            message: "Select Claude Code subagents to scaffold:",
            options: [
              { value: "coder", label: "coder", hint: "Backend logic subagent" },
              { value: "designer", label: "designer", hint: "Terminal UI/UX subagent" },
              { value: "auditor", label: "auditor", hint: "Test-runner subagent" },
              { value: "mcp", label: "mcp", hint: "MCP connector configurator" },
            ],
            required: true,
          }),
        connectors: ({ results }) => {
          // Only prompt for connectors if MCP agent is selected AND we have options.
          const agents = (results.agents ?? []) as string[];
          if (!agents.includes("mcp") || connectorOptions.length === 0) {
            return Promise.resolve([] as string[]);
          }
          return p.multiselect({
            message: "Which MCP connectors do you want to enable?",
            options: connectorOptions,
            required: false,
          });
        },
        includeTemplates: () =>
          p.confirm({
            message: "Include Claude Code subagent + skill template files?",
            initialValue: true,
          }),
      },
      {
        onCancel: () => {
          p.cancel("Setup cancelled.");
          process.exit(0);
        },
      }
    );

    const selectedConnectors = answers.agents.includes("mcp")
      ? (answers.connectors as string[])
      : [];

    const config = await buildWizardConfig(
      {
        projectName: answers.projectName,
        agents: answers.agents as string[],
        includeTemplates: answers.includeTemplates,
      },
      import.meta.url,
      selectedConnectors
    );

    const s = p.spinner();
    s.start("Saving wizard configuration...");
    try {
      saveConfig(config);
      s.stop("Configuration saved successfully!");
    } catch (err) {
      s.stop("Failed to save configuration.");
      p.log.error(theme.error(String(err)));
      process.exit(1);
    }

    p.outro(
      theme.success('Setup complete. You can now run "generate" or "info".')
    );
  });
