import Conf from "conf";
import { chmodSync, lstatSync } from "node:fs";
import os from "node:os";
import path from "node:path";

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
 * Allowed shape of an MCP connector id. Connector ids become file names
 * (`.mcp/<id>.json`) in `scaffoldProject`, so anything that could escape the
 * target directory (`..`, `/`, `\`, drive letters) must be refused. All seed
 * ids (supabase, vercel, stripe, figma, netlify) match.
 */
export const CONNECTOR_ID_RE = /^[a-z0-9_-]{1,32}$/;

/** Thrown when a saved wizard config has an unsafe or malformed shape. */
export class ConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigValidationError";
  }
}

/** Throws ConfigValidationError unless `id` is a safe connector id. */
export function assertValidConnectorId(id: unknown): asserts id is string {
  if (typeof id !== "string" || !CONNECTOR_ID_RE.test(id)) {
    throw new ConfigValidationError(
      `invalid MCP connector id ${JSON.stringify(id)} (must match ${CONNECTOR_ID_RE})`
    );
  }
}

/**
 * Light shape check for a wizard config read from disk. Fails closed with a
 * clear error instead of silently dropping entries, so a tampered config is
 * visible to the user.
 */
export function validateWizardConfig(config: unknown): asserts config is WizardConfig {
  if (config === null || typeof config !== "object" || Array.isArray(config)) {
    throw new ConfigValidationError("saved configuration is not an object");
  }
  const c = config as Record<string, unknown>;
  if (c.agents !== undefined && !Array.isArray(c.agents)) {
    throw new ConfigValidationError("saved configuration: agents must be an array");
  }
  if (c.mcpConnectors !== undefined) {
    const m = c.mcpConnectors;
    if (m === null || typeof m !== "object" || Array.isArray(m)) {
      throw new ConfigValidationError(
        "saved configuration: mcpConnectors must be an object"
      );
    }
    for (const id of Object.keys(m)) assertValidConnectorId(id);
  }
}

/**
 * Acceptable prefixes for an `ANTIGRAVITY_CONFIG_DIR` override. We confine
 * the Conf data dir to either the user's home or a system temp dir. This
 * is vulnerability-ledger row 8: without the check, a malicious or
 * mis-configured env var could point the store at e.g. `~/.ssh` or a
 * world-writable path, widening the blast radius of the Conf file.
 *
 * Tests that want to isolate use `fs.mkdtemp(os.tmpdir(), ...)` — these
 * pass the check naturally because they live under `os.tmpdir()`.
 */
function safePrefixes(): string[] {
  const out: string[] = [];
  try {
    out.push(path.resolve(os.homedir()));
  } catch {
    /* no home — skip */
  }
  try {
    out.push(path.resolve(os.tmpdir()));
  } catch {
    /* no tmp — skip */
  }
  return out;
}

function validateConfigDir(override: string): string {
  // Reject absurdly short / empty overrides.
  if (!override || override.length < 2) {
    throw new Error(
      `ANTIGRAVITY_CONFIG_DIR: refusing empty or too-short override "${override}"`
    );
  }
  const resolved = path.resolve(override);

  // Ledger row 8 — reject symlinks at the path itself. This blocks the
  // classic "point env var at a symlink to ~/.ssh" attack. `lstat` only
  // throws if the path doesn't exist yet, which is fine — Conf will
  // create it on first write, and `resolved` is still below a safe root.
  try {
    const st = lstatSync(resolved);
    if (st.isSymbolicLink()) {
      throw new Error(
        `ANTIGRAVITY_CONFIG_DIR: refusing symlink at "${resolved}"`
      );
    }
  } catch (err: unknown) {
    // ENOENT is expected for not-yet-created dirs; other errors surface.
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code !== "ENOENT") throw err;
  }

  // Confine to home or tmp. On POSIX this is a simple prefix check; on
  // Windows path.resolve normalizes drive letters.
  const prefixes = safePrefixes();
  const ok = prefixes.some((p) => {
    const rel = path.relative(p, resolved);
    return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
  });
  if (!ok) {
    throw new Error(
      `ANTIGRAVITY_CONFIG_DIR: "${resolved}" is outside the allowed scope ` +
      `(home or tmp). Refusing to write the Conf store there.`
    );
  }
  return resolved;
}

/**
 * Construct the Conf-backed store. Lazily called so each invocation picks up
 * the current value of `ANTIGRAVITY_CONFIG_DIR`, which lets CI, sandboxes, and
 * tests point the CLI at an isolated data directory without touching the
 * user's real config.
 */
function getStore(): Conf<StoreSchema> {
  const override = process.env.ANTIGRAVITY_CONFIG_DIR;
  const cwd = override ? validateConfigDir(override) : undefined;
  return new Conf<StoreSchema>({
    projectName: "antigravity-wizard",
    ...(cwd ? { cwd } : {}),
    defaults: { wizard: null },
  });
}

/**
 * Ledger row 11 — tighten the Conf data file to 0600 on POSIX so it is
 * readable only by the owning user. On Windows the default ACL already
 * restricts to the current user's profile; `chmod` is a no-op there and
 * we skip it to avoid confusing the FS layer. Errors are swallowed
 * intentionally — the store is still usable with relaxed perms, and we
 * don't want a permissioning failure to break the CLI for users on
 * exotic filesystems (FAT32, SMB mounts) that don't support chmod.
 */
function hardenConfFile(store: Conf<StoreSchema>): void {
  if (process.platform === "win32") return;
  try {
    chmodSync(store.path, 0o600);
  } catch {
    /* best-effort */
  }
}

export function saveConfig(config: WizardConfig): void {
  const store = getStore();
  store.set("wizard", config);
  hardenConfFile(store);
}

/**
 * Load the saved wizard config. Throws ConfigValidationError if the stored
 * config is malformed, e.g. a connector id that would escape the target
 * directory when `generate` writes `.mcp/<id>.json`.
 */
export function loadConfig(): WizardConfig | null {
  const config = getStore().get("wizard");
  if (config === null || config === undefined) return null;
  validateWizardConfig(config);
  return config;
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
