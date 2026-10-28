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
    },
    ...overrides,
  };
}

describe("scaffoldProject — Claude Code workspace shape", () => {
  it("creates the core .agents / skills directory skeleton", async () => {
    const out = path.join(tmp, "proj");
    await scaffoldProject(baseConfig(), out);

    for (const dir of [".agents", ".agents/prompts", "skills"]) {
      const stat = await fs.stat(path.join(out, dir));
      expect(stat.isDirectory()).toBe(true);
    }
  });

  it("always writes .agents/prompts/.gitkeep for Stage 3 prompt browser", async () => {
    const out = path.join(tmp, "gitkeep");
    await scaffoldProject(baseConfig(), out);
    await fs.access(path.join(out, ".agents/prompts/.gitkeep"));
  });

  it("writes CLAUDE.md at repo root referencing the selected subagents and skills", async () => {
    const out = path.join(tmp, "claudemd");
    await scaffoldProject(baseConfig({ agents: ["coder", "auditor"] }), out);
    const body = await fs.readFile(path.join(out, "CLAUDE.md"), "utf-8");
    expect(body).toContain("# scaffold-demo");
    expect(body).toContain(".agents/coder.md");
    expect(body).toContain(".agents/auditor.md");
    expect(body).toContain("skills/coder/SKILL.md");
    expect(body).toContain("skills/auditor/SKILL.md");
  });

  it("writes subagent + skill files only for selected agents when includeTemplates=true", async () => {
    const out = path.join(tmp, "withTemplates");
    await scaffoldProject(baseConfig({ agents: ["coder", "mcp"] }), out);

    // Selected: subagent + skill present.
    const coderSub = await fs.readFile(path.join(out, ".agents/coder.md"), "utf-8");
    expect(coderSub).toMatch(/^---\nname: coder\n/);
    expect(coderSub).toContain("tools: Read, Write, Edit, Bash, Grep, Glob");

    const coderSkill = await fs.readFile(path.join(out, "skills/coder/SKILL.md"), "utf-8");
    expect(coderSkill).toMatch(/^---\nname: coder\n/);

    const mcpSub = await fs.readFile(path.join(out, ".agents/mcp.md"), "utf-8");
    expect(mcpSub).toContain("name: mcp");

    const mcpSkill = await fs.readFile(path.join(out, "skills/mcp/SKILL.md"), "utf-8");
    expect(mcpSkill).toContain("name: mcp");

    // Not selected: files absent.
    await expect(fs.access(path.join(out, ".agents/designer.md"))).rejects.toThrow();
    await expect(fs.access(path.join(out, "skills/designer/SKILL.md"))).rejects.toThrow();
  });

  it("skips subagent + skill file bodies when includeTemplates=false but still creates the dirs", async () => {
    const out = path.join(tmp, "noTemplates");
    await scaffoldProject(
      baseConfig({ agents: ["coder"], includeTemplates: false }),
      out
    );
    await expect(fs.access(path.join(out, ".agents/coder.md"))).rejects.toThrow();
    await expect(fs.access(path.join(out, "skills/coder/SKILL.md"))).rejects.toThrow();
    // Core dirs + .gitkeep still present.
    await fs.access(path.join(out, ".agents/prompts/.gitkeep"));
    const stat = await fs.stat(path.join(out, "skills"));
    expect(stat.isDirectory()).toBe(true);
  });

  it("writes .mcp/<connector>.json for each selected connector", async () => {
    const out = path.join(tmp, "mcpConnectors");
    await scaffoldProject(baseConfig({ agents: ["coder", "mcp"] }), out);

    const raw = await fs.readFile(path.join(out, ".mcp/supabase.json"), "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.id).toBe("supabase");
    expect(parsed.label).toBe("Supabase");
    expect(parsed.tools).toEqual(["execute_sql"]);
  });

  it("does not create .mcp/ when no connectors are selected", async () => {
    const out = path.join(tmp, "noMcpDir");
    await scaffoldProject(baseConfig({ mcpConnectors: {} }), out);
    await expect(fs.access(path.join(out, ".mcp"))).rejects.toThrow();
  });

  it("returns a non-empty list of created artifacts", async () => {
    const out = path.join(tmp, "returnValue");
    const created = await scaffoldProject(baseConfig(), out);
    expect(created).toContain("CLAUDE.md");
    expect(created).toContain(".agents/coder.md");
    expect(created).toContain("skills/coder/SKILL.md");
    expect(created).toContain(".agents/prompts/.gitkeep");
  });
});

// Snapshot/drift guard for the hardcoded template literals. If a future edit
// accidentally changes the subagent frontmatter shape (name/description/tools
// keys), this test fails and forces a conscious update. Addresses ledger row
// 6 — prompt injection defense via hardcoded, snapshot-tested templates.
describe("scaffoldProject — template drift guard", () => {
  it("subagent frontmatter exposes exactly name/description/tools keys", async () => {
    const out = path.join(tmp, "drift");
    await scaffoldProject(
      baseConfig({ agents: ["coder", "designer", "auditor", "mcp"] }),
      out
    );
    for (const agent of ["coder", "designer", "auditor", "mcp"]) {
      const body = await fs.readFile(path.join(out, `.agents/${agent}.md`), "utf-8");
      const frontmatter = body.match(/^---\n([\s\S]*?)\n---/);
      expect(frontmatter, `${agent}.md frontmatter`).not.toBeNull();
      const keys = frontmatter![1]
        .split(/\r?\n/)
        .map((l) => l.split(":")[0].trim())
        .filter(Boolean);
      // `designer` and `mcp` restrict tools; `coder` / `auditor` include Bash.
      // The invariant: the three frontmatter keys are name, description, tools.
      expect(keys).toEqual(["name", "description", "tools"]);
    }
  });

  it("skill frontmatter exposes exactly name/description keys", async () => {
    const out = path.join(tmp, "driftSkill");
    await scaffoldProject(
      baseConfig({ agents: ["coder", "designer", "auditor", "mcp"] }),
      out
    );
    for (const agent of ["coder", "designer", "auditor", "mcp"]) {
      const body = await fs.readFile(
        path.join(out, `skills/${agent}/SKILL.md`),
        "utf-8"
      );
      const frontmatter = body.match(/^---\n([\s\S]*?)\n---/);
      expect(frontmatter, `${agent} SKILL.md frontmatter`).not.toBeNull();
      const keys = frontmatter![1]
        .split(/\r?\n/)
        .map((l) => l.split(":")[0].trim())
        .filter(Boolean);
      expect(keys).toEqual(["name", "description"]);
    }
  });
});

// Regression: scaffoldProject used path.join(mcpDir, `${id}.json`) with the
// raw connector id, so "../../ESCAPED" wrote outside the target directory.
describe("scaffoldProject — connector id confinement", () => {
  it("throws before writing anything when a connector id escapes .mcp/", async () => {
    const target = path.join(tmp, "gen", "out");
    const cfg = baseConfig({
      mcpConnectors: {
        "../../ESCAPED": {
          id: "x",
          label: "x",
          description: "x",
          tools: [],
          requiredFor: [],
        },
      },
    });
    await expect(scaffoldProject(cfg, target)).rejects.toThrow(
      /invalid MCP connector id/
    );
    await expect(fs.access(path.join(tmp, "gen", "ESCAPED.json"))).rejects.toThrow();
    // Fails before the first write: the target dir was never created.
    await expect(fs.access(target)).rejects.toThrow();
  });

  it("still writes .mcp/<id>.json for valid ids", async () => {
    const created = await scaffoldProject(baseConfig(), tmp);
    expect(created).toContain(".mcp/supabase.json");
    await fs.access(path.join(tmp, ".mcp", "supabase.json"));
  });
});
