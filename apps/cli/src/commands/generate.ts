import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { loadConfig } from "../lib/config.js";
import { scaffoldProject } from "../lib/scaffolder.js";
import { theme } from "../lib/theme.js";

export const generateCommand = new Command("generate")
  .description("Generate project files from saved configuration")
  .option("-d, --dir <path>", "Target directory")
  .option("--force", "Overwrite files that already exist", false)
  .action(async (options) => {
    p.intro(pc.inverse(" Code Generation "));

    let config;
    try {
      config = loadConfig();
    } catch (err) {
      p.log.error(theme.error(String(err instanceof Error ? err.message : err)));
      p.outro(theme.muted("Aborted."));
      process.exit(1);
    }

    if (!config) {
      p.note(
        theme.warning('No configuration found. Please run "init" first.'),
        "Pre-flight"
      );
      p.outro(theme.muted("Aborted."));
      process.exit(1);
    }

    // Resolve target dir: CLI flag > saved default > interactive prompt.
    let targetDir: string | undefined =
      options.dir ?? config.defaults?.targetDir;

    if (!targetDir) {
      if (!process.stdin.isTTY) {
        p.log.error(theme.error("No target directory: pass -d <dir> when not in a terminal."));
        process.exit(1);
      }
      const answer = await p.text({
        message: "Where should we generate the resources?",
        placeholder: "./output",
        validate: (value) => {
          if (!value) return "A target directory is required";
        },
      });
      if (p.isCancel(answer)) {
        p.cancel("Operation aborted.");
        process.exit(0);
      }
      targetDir = answer;
    }

    const s = p.spinner();
    s.start("Scaffolding resources...");

    let result;
    try {
      result = await scaffoldProject(config, targetDir, { force: options.force === true });
      s.stop("Scaffold completed!");
    } catch (err) {
      s.stop("Scaffolding failed.");
      p.log.error(theme.error(String(err)));
      process.exit(1);
    }

    const files = result.created.filter((i) => !i.endsWith("/"));
    p.log.success(
      theme.success(`Created ${files.length} artifacts`) +
        " " +
        theme.muted(`in ${targetDir}`)
    );
    if (result.skipped.length > 0) {
      p.log.warning(
        theme.warning(
          `Skipped ${result.skipped.length} existing file(s), left as they were: ${result.skipped.join(", ")}. ` +
            "Pass --force to overwrite them."
        )
      );
    }

    p.outro(
      theme.success(`Generated ${files.length} artifacts in the target directory.`)
    );
  });
