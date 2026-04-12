import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { scaffoldProject } from "../lib/scaffolder.js";
import type { WizardConfig } from "../lib/config.js";

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "pz-scaffold-"));
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

function baseConfig(overrides: Partial<WizardConfig> = {}): WizardConfig {
  return {
    projectName: "scaffold-demo",
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
    },
    defaults: {
      targetDir: ".",
      scaffoldAgentsDir: true,
      scaffoldPromptsDir: true,
    },
    ...overrides,
  };
}

describe("scaffoldProject", () => {
  it("creates the expected directory skeleton on disk", async () => {
    const out = path.join(tmp, "proj");
    const created = await scaffoldProject(baseConfig(), out);

    for (const dir of ["src", "src/commands", "src/lib", ".agents/prompts"]) {
      const full = path.join(out, dir);
      const stat = await fs.stat(full);
      expect(stat.isDirectory()).toBe(true);
    }

    // All directory entries in the return value end with a slash.
    const dirs = created.filter((i) => i.endsWith("/"));
    expect(dirs.length).toBeGreaterThanOrEqual(4);
  });

  it("writes agent prompt templates only for selected agents when includeTemplates=true", async () => {
    const out = path.join(tmp, "withTemplates");
    await scaffoldProject(baseConfig({ agents: ["coder", "mcp"] }), out);

    const coder = await fs.readFile(
      path.join(out, ".agents/prompts/coder.md"),
      "utf-8"
    );
    expect(coder).toContain("ClaudeCoder");

    const mcp = await fs.readFile(
      path.join(out, ".agents/prompts/mcp.md"),
      "utf-8"
    );
    expect(mcp).toContain("MCPConfigurator");

    // Designer was not selected → no file.
    await expect(
      fs.access(path.join(out, ".agents/prompts/designer.md"))
    ).rejects.toThrow();
  });

  it("skips prompt templates when includeTemplates=false", async () => {
    const out = path.join(tmp, "noTemplates");
    await scaffoldProject(
      baseConfig({ agents: ["coder"], includeTemplates: false }),
      out
    );
    await expect(
      fs.access(path.join(out, ".agents/prompts/coder.md"))
    ).rejects.toThrow();
  });

  it("emits .claude/settings.project.json with required connectors when mcp is enabled", async () => {
    const out = path.join(tmp, "withMcp");
    await scaffoldProject(baseConfig({ agents: ["coder", "mcp"] }), out);

    const raw = await fs.readFile(
      path.join(out, ".claude/settings.project.json"),
      "utf-8"
    );
    const parsed = JSON.parse(raw);
    expect(parsed.mcpConnectors).toEqual(["supabase"]);
    expect(typeof parsed.generatedAt).toBe("string");
  });

  it("does not create .claude/ when mcp agent is not selected", async () => {
    const out = path.join(tmp, "noMcp");
    await scaffoldProject(baseConfig({ agents: ["coder"] }), out);
    await expect(fs.access(path.join(out, ".claude"))).rejects.toThrow();
  });

  it("always writes .agents/project-config.json with the project name and agent list", async () => {
    const out = path.join(tmp, "marker");
    await scaffoldProject(baseConfig(), out);

    const raw = await fs.readFile(
      path.join(out, ".agents/project-config.json"),
      "utf-8"
    );
    const parsed = JSON.parse(raw);
    expect(parsed.projectName).toBe("scaffold-demo");
    expect(parsed.agents).toEqual(["coder", "mcp"]);
    expect(typeof parsed.createdAt).toBe("string");
  });

  it("copies the real seed default-wizard-config.json into the generated project", async () => {
    const out = path.join(tmp, "seed");
    await scaffoldProject(baseConfig(), out);

    const raw = await fs.readFile(
      path.join(out, ".agents/default-wizard-config.json"),
      "utf-8"
    );
    const parsed = JSON.parse(raw);
    // The real repo seed declares these connectors.
    expect(parsed.mcpConnectors).toBeTruthy();
    expect(Object.keys(parsed.mcpConnectors)).toEqual(
      expect.arrayContaining(["supabase", "vercel", "stripe", "figma", "netlify"])
    );
  });
});
