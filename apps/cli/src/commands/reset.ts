import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { clearConfig, loadConfig } from "../lib/config.js";
import { theme } from "../lib/theme.js";

export const resetCommand = new Command("reset")
  .description("Clear the saved wizard configuration")
  .action(async () => {
    if (!process.stdin.isTTY) {
      p.log.warning("Reset requires an interactive terminal.");
      return;
    }

    p.intro(pc.bgRed(pc.white(" DANGER ZONE ")));

    const existing = loadConfig();
    if (!existing) {
      p.note(theme.muted("No configuration to clear."), "Nothing to do");
      p.outro(theme.muted("Reset skipped."));
      return;
    }

    const confirmed = await p.confirm({
      message:
        "Are you sure you want to clear the configuration? This cannot be undone.",
      initialValue: false,
    });

    if (p.isCancel(confirmed)) {
      p.cancel("Operation aborted.");
      process.exit(0);
    }

    if (!confirmed) {
      p.outro(theme.muted("Reset cancelled. Configuration left untouched."));
      return;
    }

    const s = p.spinner();
    s.start("Clearing...");
    try {
      clearConfig();
      s.stop("Cleared.");
    } catch (err) {
      s.stop("Failed to clear configuration.");
      p.log.error(theme.error(String(err)));
      process.exit(1);
    }

    p.outro(theme.warning("Configuration has been reset to zero."));
  });
