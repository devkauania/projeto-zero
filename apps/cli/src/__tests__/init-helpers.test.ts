import { describe, it, expect } from "vitest";
import { filterConnectors, buildWizardConfig } from "../commands/init.js";
import type { MCPConnector } from "../lib/config.js";

const connectors: Record<string, MCPConnector> = {
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
};

describe("filterConnectors", () => {
  it("returns undefined when the connector map is missing", () => {
    expect(filterConnectors(undefined, ["supabase"])).toBeUndefined();
  });

  it("returns the full map unchanged when selectedIds is undefined", () => {
    expect(filterConnectors(connectors, undefined)).toEqual(connectors);
  });

  it("keeps only the selected ids and drops unknown ids silently", () => {
    const result = filterConnectors(connectors, ["supabase", "does-not-exist"]);
    expect(result).toEqual({ supabase: connectors.supabase });
  });

  it("returns an empty object when selectedIds is empty", () => {
    expect(filterConnectors(connectors, [])).toEqual({});
  });
});

// Regression guard for the non-TTY connector-default-ALL bug.
// When the non-TTY path passed `undefined` as selectedConnectors, filterConnectors
// returned the full seed map (all connectors written even when mcp was not selected).
// The fix: non-TTY always passes `[]`. This test documents the unsafe vs safe call.
describe("filterConnectors — non-TTY regression", () => {
  it("undefined selectedIds returns all connectors (the bug scenario — must never reach buildWizardConfig)", () => {
    expect(filterConnectors(connectors, undefined)).toEqual(connectors);
  });

  it("[] selectedIds returns empty object (the correct non-TTY behavior)", () => {
    expect(filterConnectors(connectors, [])).toEqual({});
  });
});

describe("buildWizardConfig", () => {
  it("hydrates from the real repo seed when walked up from this test file", async () => {
    const cfg = await buildWizardConfig(
      { projectName: "hydrated", agents: ["coder"], includeTemplates: true },
      import.meta.url
    );

    expect(cfg.projectName).toBe("hydrated");
    expect(cfg.agents).toEqual(["coder"]);
    expect(cfg.includeTemplates).toBe(true);
    // The real seed ships these. No selectedConnectors → full map kept.
    expect(cfg.mcpConnectors).toBeDefined();
    expect(Object.keys(cfg.mcpConnectors!)).toEqual(
      expect.arrayContaining(["supabase", "vercel", "stripe", "figma", "netlify"])
    );
    expect(cfg.defaults).toBeDefined();
    expect(cfg.defaults!.targetDir).toBe(".");
  });

  it("filters connectors to the selected list when provided", async () => {
    const cfg = await buildWizardConfig(
      { projectName: "filtered", agents: ["coder", "mcp"], includeTemplates: false },
      import.meta.url,
      ["supabase", "figma"]
    );
    expect(Object.keys(cfg.mcpConnectors!).sort()).toEqual(["figma", "supabase"]);
  });

  it("produces an empty connector map when selectedConnectors is []", async () => {
    const cfg = await buildWizardConfig(
      { projectName: "empty", agents: ["coder"], includeTemplates: false },
      import.meta.url,
      []
    );
    expect(cfg.mcpConnectors).toEqual({});
  });
});
