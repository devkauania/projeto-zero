import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  saveConfig,
  loadConfig,
  clearConfig,
  getRequiredConnectors,
  validateWizardConfig,
  CONNECTOR_ID_RE,
  ConfigValidationError,
  type WizardConfig,
} from "../lib/config.js";

// Every test gets its own isolated Conf directory so we never touch the
// user's real antigravity-wizard store.
let tmp: string;
let prevEnv: string | undefined;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "pz-conf-"));
  prevEnv = process.env.ANTIGRAVITY_CONFIG_DIR;
  process.env.ANTIGRAVITY_CONFIG_DIR = tmp;
});

afterEach(async () => {
  if (prevEnv === undefined) delete process.env.ANTIGRAVITY_CONFIG_DIR;
  else process.env.ANTIGRAVITY_CONFIG_DIR = prevEnv;
  await fs.rm(tmp, { recursive: true, force: true });
});

const sample: WizardConfig = {
  projectName: "test-project",
  agents: ["coder", "mcp"],
  includeTemplates: true,
  mcpConnectors: {
    supabase: {
      id: "supabase",
      label: "Supabase",
      description: "db",
      tools: ["execute_sql"],
      requiredFor: ["coder"],
    },
    figma: {
      id: "figma",
      label: "Figma",
      description: "design",
      tools: ["get_design_context"],
      requiredFor: ["designer"],
    },
    vercel: {
      id: "vercel",
      label: "Vercel",
      description: "deploy",
      tools: ["deploy_to_vercel"],
      requiredFor: [],
    },
  },
  defaults: {
    targetDir: ".",
  },
};

describe("config store round-trip", () => {
  it("loadConfig returns null when nothing is saved", () => {
    expect(loadConfig()).toBeNull();
  });

  it("saveConfig persists and loadConfig retrieves the same shape", () => {
    saveConfig(sample);
    const loaded = loadConfig();
    expect(loaded).toEqual(sample);
  });

  it("clearConfig wipes the saved wizard value", () => {
    saveConfig(sample);
    expect(loadConfig()).not.toBeNull();
    clearConfig();
    expect(loadConfig()).toBeNull();
  });

  it("writes the data file on disk under ANTIGRAVITY_CONFIG_DIR (real Conf, no mocks)", async () => {
    saveConfig(sample);
    // Conf writes somewhere under tmp. Walk the tree and assert a json file exists
    // containing our projectName — proving we hit the real store, not a stub.
    const found = await findFileContaining(tmp, "test-project");
    expect(found).not.toBeNull();
  });
});

describe("getRequiredConnectors", () => {
  it("returns [] when mcpConnectors is absent", () => {
    expect(
      getRequiredConnectors({
        projectName: "x",
        agents: ["coder"],
        includeTemplates: false,
      })
    ).toEqual([]);
  });

  it("returns only connectors whose requiredFor intersects with selected agents", () => {
    expect(getRequiredConnectors({ ...sample, agents: ["coder"] })).toEqual([
      "supabase",
    ]);
    expect(getRequiredConnectors({ ...sample, agents: ["designer"] })).toEqual([
      "figma",
    ]);
    expect(
      getRequiredConnectors({ ...sample, agents: ["coder", "designer"] }).sort()
    ).toEqual(["figma", "supabase"]);
  });

  it("omits connectors with empty requiredFor even if the agent is selected", () => {
    const result = getRequiredConnectors({ ...sample, agents: ["coder", "mcp"] });
    expect(result).not.toContain("vercel");
  });
});

// ---------------------------------------------------------------------------
// Ledger row 8 — ANTIGRAVITY_CONFIG_DIR hardening.
// The override is confined to $HOME or $TMPDIR, and symlinks at the path
// are rejected. Tests live here (not in a separate file) because they
// manipulate the same env var + tmp state as the rest of the suite.
// ---------------------------------------------------------------------------
describe("config dir hardening (ledger row 8)", () => {
  it("rejects ANTIGRAVITY_CONFIG_DIR outside $HOME or $TMPDIR", () => {
    // A path that is neither under tmp nor under home. On Windows this
    // picks a different drive letter; on POSIX a filesystem root that is
    // neither home nor tmp.
    const bad =
      process.platform === "win32" ? "Z:\\attacker" : "/opt/attacker";
    process.env.ANTIGRAVITY_CONFIG_DIR = bad;
    expect(() => saveConfig(sample)).toThrow(
      /outside the allowed scope|allowed scope/
    );
  });

  it("rejects a symlink at the override path", async () => {
    // Build a symlink inside tmp pointing at a sibling dir; aim the env
    // var at the symlink. validateConfigDir must reject it even though
    // the symlink's target is inside tmp.
    const real = await fs.mkdtemp(path.join(os.tmpdir(), "pz-real-"));
    const link = path.join(os.tmpdir(), `pz-link-${Date.now()}`);
    try {
      await fs.symlink(real, link, "dir");
    } catch (err: unknown) {
      // Windows without SeCreateSymbolicLinkPrivilege — skip the test.
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code === "EPERM" || code === "ENOSYS") {
        return;
      }
      throw err;
    }
    process.env.ANTIGRAVITY_CONFIG_DIR = link;
    try {
      expect(() => saveConfig(sample)).toThrow(/symlink/);
    } finally {
      await fs.rm(link, { force: true });
      await fs.rm(real, { recursive: true, force: true });
    }
  });

  it("rejects empty override string", () => {
    process.env.ANTIGRAVITY_CONFIG_DIR = "";
    // Empty string means "no override" in the lookup path, not "bad
    // override" — we only validate non-empty overrides. This test locks
    // that behavior in so we don't accidentally refuse common defaults.
    expect(() => saveConfig(sample)).not.toThrow();
  });
});

async function findFileContaining(
  dir: string,
  needle: string
): Promise<string | null> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      const nested = await findFileContaining(full, needle);
      if (nested) return nested;
    } else if (e.isFile()) {
      try {
        const text = await fs.readFile(full, "utf-8");
        if (text.includes(needle)) return full;
      } catch {
        /* binary or unreadable — skip */
      }
    }
  }
  return null;
}

// Regression: connector ids from the saved config were trusted and later used
// as file names, allowing a path escape in `generate`.
describe("config — connector id validation", () => {
  const conn = { id: "x", label: "x", description: "x", tools: [], requiredFor: [] };

  it("all seed connector ids are accepted", () => {
    for (const id of ["supabase", "vercel", "stripe", "figma", "netlify"]) {
      expect(id).toMatch(CONNECTOR_ID_RE);
    }
  });

  it.each([
    "../../ESCAPED",
    "..",
    "a/b",
    "a\\b",
    "C:evil",
    "/abs",
    "UPPER",
    "",
    "x".repeat(33),
  ])("rejects unsafe id %j", (id) => {
    expect(() =>
      validateWizardConfig({
        projectName: "p",
        agents: [],
        includeTemplates: false,
        mcpConnectors: { [id]: conn },
      })
    ).toThrow(ConfigValidationError);
  });

  it("loadConfig fails closed on a tampered store", async () => {
    await fs.writeFile(
      path.join(tmp, "config.json"),
      JSON.stringify({
        wizard: {
          projectName: "p",
          agents: [],
          includeTemplates: false,
          mcpConnectors: { "../../ESCAPED": conn },
        },
      })
    );
    expect(() => loadConfig()).toThrow(/invalid MCP connector id/);
  });

  it("loadConfig still returns a valid config unchanged", () => {
    saveConfig(sample);
    expect(loadConfig()).toEqual(sample);
  });
});
