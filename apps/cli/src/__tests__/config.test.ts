import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  saveConfig,
  loadConfig,
  clearConfig,
  getRequiredConnectors,
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
