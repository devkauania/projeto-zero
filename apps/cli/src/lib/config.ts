import Conf from "conf";
import envPaths from "env-paths";
import { chmodSync, lstatSync, realpathSync, rmSync } from "node:fs";
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

/** The subagents the CLI can scaffold. */
export const AGENT_IDS = ["coder", "designer", "auditor", "mcp"] as const;

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

/**
 * Thrown when the store file is not valid JSON. Names the file, because Conf's
 * own error is a bare JSON parse message that does not say what it was reading.
 */
export class ConfigStoreCorruptError extends ConfigValidationError {
  constructor(readonly filePath: string, cause: string) {
    super(
      `saved configuration ${filePath} is not valid JSON (${cause}). ` +
        `Run "reset" in a terminal, or delete the file, then run "init" again.`
    );
    this.name = "ConfigStoreCorruptError";
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
 * Shape check for a wizard config, run on everything read from disk and again
 * at the scaffolder before its first write. Fails closed with a clear error
 * instead of silently dropping entries, so a tampered config is visible to the
 * user and cannot leave a half-written scaffold behind.
 */
export function validateWizardConfig(config: unknown): asserts config is WizardConfig {
  if (config === null || typeof config !== "object" || Array.isArray(config)) {
    throw new ConfigValidationError("saved configuration is not an object");
  }
  const c = config as Record<string, unknown>;
  if (typeof c.projectName !== "string" || c.projectName.trim() === "") {
    throw new ConfigValidationError("saved configuration: projectName must be a non-empty string");
  }
  if (!Array.isArray(c.agents)) {
    throw new ConfigValidationError("saved configuration: agents must be an array");
  }
  for (const agent of c.agents) {
    if (!(AGENT_IDS as readonly unknown[]).includes(agent)) {
      throw new ConfigValidationError(
        `saved configuration: unknown agent ${JSON.stringify(agent)} (expected one of ${AGENT_IDS.join(", ")})`
      );
    }
  }
  if (c.mcpConnectors !== undefined) {
    const m = c.mcpConnectors;
    if (m === null || typeof m !== "object" || Array.isArray(m)) {
      throw new ConfigValidationError(
        "saved configuration: mcpConnectors must be an object"
      );
    }
    for (const [id, connector] of Object.entries(m)) {
      assertValidConnectorId(id);
      if (connector === null || typeof connector !== "object" || Array.isArray(connector)) {
        throw new ConfigValidationError(
          `saved configuration: MCP connector ${JSON.stringify(id)} must be an object`
        );
      }
    }
  }
  if (c.defaults !== undefined) {
    const d = c.defaults as { targetDir?: unknown } | null;
    if (d === null || typeof d !== "object" || typeof d.targetDir !== "string") {
      throw new ConfigValidationError("saved configuration: defaults.targetDir must be a string");
    }
    // A bare `generate` writes here with nobody having asked for that place, so
    // it stays under the cwd. Both separators and drive forms count on every
    // platform: the file may have been made on another one. -d is unaffected.
    const parts = d.targetDir.split(/[\\/]/);
    if (
      path.posix.isAbsolute(d.targetDir) ||
      path.win32.isAbsolute(d.targetDir) ||
      /^[a-zA-Z]:/.test(d.targetDir) ||
      parts.includes("..")
    ) {
      throw new ConfigValidationError(
        `saved configuration: defaults.targetDir must stay inside the current directory, got ${JSON.stringify(d.targetDir)}. Pass -d <dir> to generate anywhere else.`
      );
    }
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

/**
 * Resolve links in the deepest part of `target` that exists, and keep the rest
 * as written. The store may not exist yet, so plain realpath would throw; and
 * checking only the path as written lets a link higher up walk out of scope.
 */
function realpathOfDeepestExisting(target: string): string {
  const missing: string[] = [];
  let current = target;
  for (;;) {
    try {
      return path.join(realpathSync.native(current), ...missing.reverse());
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code !== "ENOENT" && code !== "ENOTDIR") throw err;
      // A dangling link: where it leads cannot be checked, so refuse it.
      let dangling = false;
      try {
        dangling = lstatSync(current).isSymbolicLink();
      } catch {
        /* simply not there */
      }
      if (dangling) {
        throw new Error(`ANTIGRAVITY_CONFIG_DIR: refusing symlink at "${current}"`);
      }
      const parent = path.dirname(current);
      if (parent === current) return target;
      missing.push(path.basename(current));
      current = parent;
    }
  }
}

/** Folders under home that hold credentials: inside the scope, and still no. */
const CREDENTIAL_DIRS = [".ssh", ".gnupg", ".aws", ".azure", ".kube", ".docker", ".config/gcloud"];

function isCredentialDir(realHome: string, real: string): boolean {
  const insensitive = process.platform === "win32" || process.platform === "darwin";
  const norm = (s: string) => (insensitive ? s.toLowerCase() : s);
  const rel = norm(path.relative(realHome, real)).split(path.sep);
  return CREDENTIAL_DIRS.some((dir) => {
    const parts = norm(dir).split("/");
    return parts.every((part, i) => rel[i] === part);
  });
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

  // Confine to home or tmp, comparing where the paths really lead: a link
  // further up must not walk out of scope, and home or tmp may themselves be
  // reached through a link (macOS /tmp) or a short name (Windows RUNNER~1).
  const real = realpathOfDeepestExisting(resolved);
  const ok = safePrefixes().some((p) => {
    const rel = path.relative(realpathOfDeepestExisting(p), real);
    return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
  });
  if (!ok) {
    throw new Error(
      `ANTIGRAVITY_CONFIG_DIR: "${resolved}" is outside the allowed scope ` +
      `(home or tmp). Refusing to write the Conf store there.`
    );
  }
  let home: string | undefined;
  try {
    home = realpathOfDeepestExisting(path.resolve(os.homedir()));
  } catch {
    /* no home: nothing under it to protect */
  }
  if (home && isCredentialDir(home, real)) {
    throw new Error(
      `ANTIGRAVITY_CONFIG_DIR: "${resolved}" is a credentials folder. Refusing to write the Conf store there.`
    );
  }
  return resolved;
}

const STORE_PROJECT_NAME = "antigravity-wizard";

/**
 * Construct the Conf-backed store. Lazily called so each invocation picks up
 * the current value of `ANTIGRAVITY_CONFIG_DIR`, which lets CI, sandboxes, and
 * tests point the CLI at an isolated data directory without touching the
 * user's real config.
 */
function getStore(): Conf<StoreSchema> {
  const override = process.env.ANTIGRAVITY_CONFIG_DIR;
  const cwd = override ? validateConfigDir(override) : undefined;
  try {
    return new Conf<StoreSchema>({
      projectName: STORE_PROJECT_NAME,
      ...(cwd ? { cwd } : {}),
      defaults: { wizard: null },
    });
  } catch (err) {
    if (err instanceof SyntaxError) {
      // Conf's constructor is what parses the file, so it never returns an
      // instance to ask for the path. Same location Conf computes by default.
      const dir = cwd ?? envPaths(STORE_PROJECT_NAME, { suffix: "nodejs" }).config;
      throw new ConfigStoreCorruptError(path.join(dir, "config.json"), err.message);
    }
    throw err;
  }
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
  try {
    getStore().clear();
  } catch (err) {
    // A store that cannot be parsed has nothing worth keeping and no way to be
    // repaired through Conf, so reset has to be able to remove the file itself.
    if (err instanceof ConfigStoreCorruptError) {
      rmSync(err.filePath, { force: true });
      return;
    }
    throw err;
  }
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
