#!/usr/bin/env node

import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { generateCommand } from "./commands/generate.js";
import { infoCommand } from "./commands/info.js";
import { resetCommand } from "./commands/reset.js";

const program = new Command();

program
  .name("antigravity")
  .description("Interactive CLI Setup Wizard — Antigravity")
  .version("0.1.0");

program.addCommand(initCommand);
program.addCommand(generateCommand);
program.addCommand(infoCommand);
program.addCommand(resetCommand);

program.parse();
