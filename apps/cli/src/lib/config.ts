import Conf from "conf";

// --- MCP Connector types (mirrors .agents/default-wizard-config.json) ---

export interface MCPConnector {
  id: string;
  label: string;
  description: string;
  tools: string[];
  requiredFor: string[];
}

export interface ScaffoldDefaults {
  targetDir: string;
  scaffoldAgentsDir: boolean;
  scaffoldPromptsDir: boolean;
}

// --- Wizard configuration ---

export interface WizardConfig {
  projectName: string;
  agents: string[];
  includeTemplates: boolean;
  mcpConnectors?: Record<string, MCPConnector>;
  defaults?: ScaffoldDefaults;
}

type StoreSchema = { wizard: WizardConfig | null };

/**
 * Construct the Conf-backed store. Lazily called so each invocation picks up
 * the current value of `ANTIGRAVITY_CONFIG_DIR`, which lets CI, sandboxes, and
 * tests point the CLI at an isolated data directory without touching the
 * user's real config.
 */
function getStore(): Conf<StoreSchema> {
  const override = process.env.ANTIGRAVITY_CONFIG_DIR;
  return new Conf<StoreSchema>({
    projectName: "antigravity-wizard",
    ...(override ? { cwd: override } : {}),
    defaults: { wizard: null },
  });
}

export function saveConfig(config: WizardConfig): void {
  getStore().set("wizard", config);
}

export function loadConfig(): WizardConfig | null {
  return getStore().get("wizard");
}

export function clearConfig(): void {
  getStore().clear();
}

/**
 * Returns the list of MCP connector IDs that are required by the selected agents.
 */
export function getRequiredConnectors(config: WizardConfig): string[] {
  if (!config.mcpConnectors) return [];

  const selected = new Set(config.agents);
  const required: string[] = [];

  for (const [id, connector] of Object.entries(config.mcpConnectors)) {
    if (connector.requiredFor.some((agent) => selected.has(agent))) {
      required.push(id);
    }
  }

  return required;
}
