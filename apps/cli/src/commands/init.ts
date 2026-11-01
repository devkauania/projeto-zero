import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import readline from "node:readline";
import {
  AGENT_IDS,
  saveConfig,
  type WizardConfig,
  type MCPConnector,
  type ScaffoldDefaults,
} from "../lib/config.js";
import { findSeedConfigPath, readJsonFile } from "../lib/fs-utils.js";
import { showBanner } from "../lib/banner.js";
import { theme } from "../lib/theme.js";

/**
 * Install a global SIGINT handler that exits 0 cleanly with a friendly
 * cancellation message. Registered once per process. Clack handles Ctrl-C
 * itself while a terminal prompt is open (raw mode), so this covers a real
 * signal at any other moment, such as while waiting for piped answers.
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

export type NonInteractiveResult =
  | { ok: true; answers: InitAnswers }
  | { ok: false; message: string };

const ANSWER_FORMAT = "name, subagents, templates (y/n), one per line";

/**
 * Turn the three piped answers into InitAnswers. Blank lines take the documented
 * defaults. Anything that cannot be understood is refused rather than guessed
 * at, so a typo cannot quietly save something other than what was asked for.
 */
export function parseNonInteractiveAnswers(lines: string[]): NonInteractiveResult {
  const projectName = lines[0].trim() || "my-project";

  const requested = lines[1]
    .split(/[\s,]+/)
    .map((s) => s.toLowerCase())
    .filter(Boolean);
  const unknown = requested.filter((a) => !(AGENT_IDS as readonly string[]).includes(a));
  if (unknown.length > 0) {
    return {
      ok: false,
      message: `unknown subagent(s): ${unknown.join(", ")}. Valid: ${AGENT_IDS.join(", ")}.`,
    };
  }
  const agents = requested.length > 0 ? [...new Set(requested)] : ["coder"];

  const include = lines[2].trim().toLowerCase();
  if (!["", "y", "yes", "n", "no"].includes(include)) {
    return { ok: false, message: `templates answer must be y or n, got "${lines[2].trim()}".` };
  }
  const includeTemplates = include === "" || include.startsWith("y");

  return { ok: true, answers: { projectName, agents, includeTemplates } };
}

/**
 * Non-TTY fallback that drives the wizard from line-buffered stdin, because
 * @clack/prompts requires raw-mode TTY input.
 *
 * Done as soon as three lines have arrived. Ending early is a failure the caller
 * must report: before, a run that saved nothing exited 0, so `init && generate`
 * went green with no files written. `idleMs` is only there so a stdin nobody
 * will ever write to or close cannot hang a job forever; it is long because a
 * slow producer is not a cancel (it used to be 300 ms, and that lost real input).
 */
const NON_TTY_IDLE_MS = 60_000;
export function readNonInteractiveAnswers(
  input: NodeJS.ReadableStream,
  idleMs: number = NON_TTY_IDLE_MS
): Promise<NonInteractiveResult> {
  const lines: string[] = [];
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input });
    let idle: NodeJS.Timeout | undefined;
    let done = false;
    const finish = (timedOut: boolean) => {
      if (done) return;
      done = true;
      if (idle) clearTimeout(idle);
      rl.close();
      if (lines.length >= 3) {
        resolve(parseNonInteractiveAnswers(lines));
      } else if (timedOut) {
        resolve({
          ok: false,
          message: `timed out waiting for stdin after ${idleMs} ms: got ${lines.length} of 3 lines (${ANSWER_FORMAT}).`,
        });
      } else {
        resolve({
          ok: false,
          message: `expected 3 lines on stdin (${ANSWER_FORMAT}), got ${lines.length}.`,
        });
      }
    };
    const bumpIdle = () => {
      if (idle) clearTimeout(idle);
      idle = setTimeout(() => finish(true), idleMs);
    };
    rl.on("line", (line) => {
      if (done) return;
      lines.push(line);
      if (lines.length >= 3) finish(false);
      else bumpIdle();
    });
    rl.on("close", () => finish(false));
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
    // input, so we read answers from line-buffered stdin instead.
    if (!process.stdin.isTTY) {
      p.log.info(theme.muted(`Not a terminal: reading answers from stdin (${ANSWER_FORMAT}).`));
      const nonTty = await readNonInteractiveAnswers(process.stdin);
      if (!nonTty.ok) {
        p.log.error(theme.error(`Nothing saved: ${nonTty.message}`));
        process.exit(1);
      }
      const config = await buildWizardConfig(
        nonTty.answers,
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
        p.log.error(theme.error(err instanceof Error ? err.message : String(err)));
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
            // Same ids as AGENT_IDS; the hints are what this list adds.
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
      p.log.error(theme.error(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    }

    p.outro(
      theme.success('Setup complete. You can now run "generate" or "info".')
    );
  });
