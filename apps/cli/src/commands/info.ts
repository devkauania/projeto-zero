import { Command } from "commander";
import pc from "picocolors";
import { loadConfig } from "../lib/config.js";
import { theme } from "../lib/theme.js";

export const infoCommand = new Command("info")
  .description("Show a summary of the saved wizard configuration")
  .action(() => {
    let config;
    try {
      config = loadConfig();
    } catch (err) {
      // ANTIGRAVITY_CONFIG_DIR rejection (ledger row 8) surfaces here as a
      // user-facing message instead of a raw Node stack trace.
      console.error(theme.error(String(err instanceof Error ? err.message : err)));
      process.exit(1);
    }

    if (!config) {
      console.log(
        theme.warning("No setup configuration found. Run init first.")
      );
      return;
    }

    console.log();
    console.log(pc.bold(theme.brand("Projeto Zero Configuration State:")));
    console.log();

    console.log(
      pc.bold("projectName: ") + theme.brand(config.projectName ?? "(unset)")
    );

    const agents = Array.isArray(config.agents) ? config.agents : [];
    console.log(pc.bold("agents:"));
    if (agents.length === 0) {
      console.log(theme.muted("  (none)"));
    } else {
      for (const a of agents) {
        console.log("  - " + theme.success(a));
      }
    }

    const connectors = Object.values(config.mcpConnectors ?? {});
    console.log(pc.bold("mcpConnectors:"));
    if (connectors.length === 0) {
      console.log(theme.muted("  (none)"));
    } else {
      for (const c of connectors) {
        const toolCount = Array.isArray(c.tools) ? c.tools.length : 0;
        console.log(
          "  - " +
            theme.success(c.id) +
            theme.muted(
              ` (${c.label ?? c.id}, ${toolCount} tool${toolCount === 1 ? "" : "s"})`
            )
        );
      }
    }

    const d = config.defaults;
    console.log(pc.bold("defaults:"));
    if (d) {
      console.log(theme.muted(`  targetDir: ${d.targetDir}`));
    } else {
      console.log(theme.muted("  (none)"));
    }

    console.log(
      pc.bold("includeTemplates: ") +
        (config.includeTemplates ? theme.success("yes") : theme.muted("no"))
    );
    console.log();
  });
