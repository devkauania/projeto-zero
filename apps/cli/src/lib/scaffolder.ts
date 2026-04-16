import path from "node:path";
import fs from "node:fs/promises";
import type { WizardConfig } from "./config.js";
import { ensureDir, writeJsonFile } from "./fs-utils.js";

/**
 * Claude Code workspace scaffold — produces the on-disk shape documented
 * in the Stage 2 plan:
 *
 *   CLAUDE.md                 (root project memory)
 *   .agents/
 *     <id>.md                 (subagent with YAML frontmatter per selected id)
 *     prompts/.gitkeep        (consumed by the swarm launcher in Stage 3)
 *   skills/
 *     <id>/SKILL.md           (skill descriptor with YAML frontmatter)
 *   .mcp/
 *     <connector>.json        (one file per selected MCP connector)
 *
 * Internal agent IDs remain `coder`/`designer`/`auditor`/`mcp` per plan —
 * binary name, command names, scope, connector registry, and Conf schema
 * keys are all preserved.
 */

interface AgentTemplate {
  subagent: { path: string; contents: string };
  skill: { path: string; contents: string };
}

const AGENT_TEMPLATES: Record<string, AgentTemplate> = {
  coder: {
    subagent: {
      path: ".agents/coder.md",
      contents: `---
name: coder
description: Backend implementation subagent — Node.js / TypeScript modules, command wiring, filesystem operations
tools: Read, Write, Edit, Bash, Grep, Glob
---

# coder

You are the backend implementation subagent for this Claude Code workspace.

## Scope
- TypeScript / JavaScript source files
- Test files paired with source
- Package manifest updates that are required to make code compile or tests pass

## Out of scope
- Terminal UI styling — hand off to \`designer\`
- Test-suite execution and regression reporting — hand off to \`auditor\`
- MCP connector wiring — hand off to \`mcp\`
`,
    },
    skill: {
      path: "skills/coder/SKILL.md",
      contents: `---
name: coder
description: Invoke when the user wants backend logic implemented, refactored, or debugged
---

# coder skill

## When to use
- Implementing new CLI commands or library modules
- Fixing bugs in existing backend code
- Refactoring for clarity

## How to use
1. Read the target source files before proposing edits.
2. Propose minimal diffs — do not reformat unrelated code.
3. Run the relevant tests before declaring the change complete.
`,
    },
  },
  designer: {
    subagent: {
      path: ".agents/designer.md",
      contents: `---
name: designer
description: Terminal UI/UX subagent — color themes, banners, interactive prompt flows
tools: Read, Write, Edit
---

# designer

You own the operator-facing surface of CLI commands. You do not write backend logic.

## Scope
- Color themes (picocolors or equivalent)
- ASCII banners (figlet or equivalent)
- Interactive prompt flows (@clack/prompts or equivalent)
- Help text, error message wording

## Out of scope
- Business logic — hand off to \`coder\`
`,
    },
    skill: {
      path: "skills/designer/SKILL.md",
      contents: `---
name: designer
description: Invoke when the user wants terminal UI changes — colors, banners, prompt copy, or help text
---

# designer skill

## When to use
- Prompt copy needs to change
- Banner or color scheme updates
- A new interactive flow step is added to the wizard

## How to use
1. Read existing theme / prompt modules.
2. Preview the change visually — paste a sample render in the response.
3. Update tests that assert on output text.
`,
    },
  },
  auditor: {
    subagent: {
      path: ".agents/auditor.md",
      contents: `---
name: auditor
description: Test-runner subagent — executes integration tests, validates CLI output, reports regressions
tools: Read, Bash, Grep
---

# auditor

You verify that changes made by other subagents pass tests and meet the CLI contract.

## Scope
- Run the full test suite
- Execute the CLI end-to-end in a sandboxed directory
- Compare observed output against expected patterns
- Report regressions with file:line references and reproduction steps

## Out of scope
- Writing production code — hand off to \`coder\`
- UI polish — hand off to \`designer\`
`,
    },
    skill: {
      path: "skills/auditor/SKILL.md",
      contents: `---
name: auditor
description: Invoke when the user wants tests run, output validated, or regressions confirmed
---

# auditor skill

## When to use
- After any code change lands
- Before tagging a release
- Investigating a reported bug

## How to use
1. Run \`npm run build\` and \`npm run test\`.
2. Exercise the CLI against a temp sandbox directory.
3. Report: PASS or FAIL with file:line references for any failure.
`,
    },
  },
  mcp: {
    subagent: {
      path: ".agents/mcp.md",
      contents: `---
name: mcp
description: MCP connector subagent — wires external tool servers into the Claude Code workspace
tools: Read, Write, Edit
---

# mcp

You manage MCP (Model Context Protocol) connector configuration.

## Scope
- \`.mcp/*.json\` connector descriptors
- Connector registry updates
- Advising the user on connector selection trade-offs — latency, auth, quotas

## Out of scope
- Backend logic — hand off to \`coder\`
- UI — hand off to \`designer\`
- Test execution — hand off to \`auditor\`
`,
    },
    skill: {
      path: "skills/mcp/SKILL.md",
      contents: `---
name: mcp
description: Invoke when the user wants to add, remove, or debug MCP connectors in their Claude Code workspace
---

# mcp skill

## When to use
- Adding a new MCP server (Supabase, Vercel, Figma, etc.)
- Debugging why a connector fails to authenticate
- Reviewing which connectors the current agent set actually requires

## How to use
1. Read \`.mcp/\` and the connector registry.
2. Propose the minimum connector set to satisfy the selected subagents.
3. Emit or update \`.mcp/<connector>.json\`.
`,
    },
  },
};

function renderClaudeMd(projectName: string, agents: string[]): string {
  const subagentList = agents.map((a) => `- \`${a}\` — see \`.agents/${a}.md\``).join("\n");
  const skillList = agents.map((a) => `- \`${a}\` — see \`skills/${a}/SKILL.md\``).join("\n");
  return `# ${projectName}

This is a Claude Code workspace scaffolded by \`@projeto-zero/cli\`.

## Subagents
${subagentList}

## Skills
${skillList}

## Conventions
_Describe project-wide conventions here (code style, commit format, review process)._

## How to work
_Describe the agreed workflow — e.g., coder implements, auditor runs tests, designer for UI._
`;
}

export async function scaffoldProject(
  config: WizardConfig,
  targetDir: string
): Promise<string[]> {
  const root = path.resolve(targetDir);
  const created: string[] = [];

  // Core directories (Claude Code convention).
  for (const dir of [".agents", ".agents/prompts", "skills"]) {
    const full = path.join(root, dir);
    if (await ensureDir(full)) created.push(dir + "/");
  }

  // .gitkeep in .agents/prompts — Stage 3 swarm launcher populates this dir.
  const gitkeep = path.join(root, ".agents", "prompts", ".gitkeep");
  await fs.writeFile(gitkeep, "", "utf-8");
  created.push(".agents/prompts/.gitkeep");

  // CLAUDE.md — root project memory.
  const claudeMdPath = path.join(root, "CLAUDE.md");
  await fs.writeFile(claudeMdPath, renderClaudeMd(config.projectName, config.agents), "utf-8");
  created.push("CLAUDE.md");

  // Subagent + skill files for each selected agent (when includeTemplates=true).
  if (config.includeTemplates) {
    for (const agent of config.agents) {
      const tmpl = AGENT_TEMPLATES[agent];
      if (!tmpl) continue;

      const subPath = path.join(root, tmpl.subagent.path);
      await fs.writeFile(subPath, tmpl.subagent.contents, "utf-8");
      created.push(tmpl.subagent.path);

      const skillDir = path.join(root, path.dirname(tmpl.skill.path));
      await ensureDir(skillDir);
      const skillPath = path.join(root, tmpl.skill.path);
      await fs.writeFile(skillPath, tmpl.skill.contents, "utf-8");
      created.push(tmpl.skill.path);
    }
  }

  // .mcp/<connector>.json for each selected connector. The connector set is
  // already filtered in init.ts (Stage 5 patch 01) to match the user's
  // selection — an empty mcpConnectors map means zero writes here.
  if (config.mcpConnectors && Object.keys(config.mcpConnectors).length > 0) {
    const mcpDir = path.join(root, ".mcp");
    if (await ensureDir(mcpDir)) created.push(".mcp/");
    for (const [id, connector] of Object.entries(config.mcpConnectors)) {
      const filePath = path.join(mcpDir, `${id}.json`);
      await writeJsonFile(filePath, {
        id: connector.id,
        label: connector.label,
        description: connector.description,
        tools: connector.tools,
      });
      created.push(`.mcp/${id}.json`);
    }
  }

  return created;
}
