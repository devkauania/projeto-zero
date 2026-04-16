#!/usr/bin/env node
// check-non-tty-connectors.mjs — Static tripwire for the non-TTY connector
// default-ALL bug (vulnerability-ledger row 2).
//
// Root cause: `apps/cli/src/commands/init.ts` non-TTY branch passed `undefined`
// as the `selectedConnectors` arg to `buildWizardConfig`. `filterConnectors`
// returns the full seed connector map when `selectedIds` is `undefined`, so
// running `echo "" | antigravity init --yes` wrote every MCP connector to
// `.mcp/` even though the user never chose mcp.
//
// Fix (applied in Stage 5): always pass `[]` — non-TTY never prompts for
// connector selection, so the correct default is always empty.
//
// This script detects if the bad pattern is reintroduced. It searches the
// TypeScript source for the exact anti-pattern rather than the compiled output
// so it catches regressions at the earliest possible point (pre-build).

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcPath = join(__dirname, "..", "apps", "cli", "src", "commands", "init.ts");
const src = readFileSync(srcPath, "utf8");

// The exact pattern that caused the bug: ternary that falls through to `undefined`
// as the connector arg. Both `? [] : undefined` and `? undefined : []` variants
// are dangerous — flag both.
const BAD_PATTERNS = [
  /nonTtyAnswers\.agents\.includes\([^)]+\)\s*\?\s*\[\s*\]\s*:\s*undefined/,
  /nonTtyAnswers\.agents\.includes\([^)]+\)\s*\?\s*undefined\s*:\s*\[\s*\]/,
];

const hit = BAD_PATTERNS.find((re) => re.test(src));
if (hit) {
  console.error(
    "check-non-tty-connectors: FAIL — non-TTY branch of buildWizardConfig call " +
    "passes `undefined` as selectedConnectors. This causes all MCP connectors to be " +
    "written when mcp agent is not selected. Fix: replace the ternary with `[]`.\n" +
    `  Pattern matched: ${hit}`
  );
  process.exit(1);
}

console.log("check-non-tty-connectors: PASS — non-TTY connector default is safe");
