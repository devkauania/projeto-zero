#!/usr/bin/env node
// verdict.mjs — rule R14 enforcement. The ONLY legitimate source of the
// strings "PRODUCTION-READY" / "NOT-READY". Runs preflight, captures its
// exit code + output, and prints one verdict line.

import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const PREFLIGHT = join(REPO_ROOT, "scripts", "preflight.mjs");

function main() {
  const res = spawnSync("node", [PREFLIGHT], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    shell: true,
  });
  const out = (res.stdout || "") + "\n" + (res.stderr || "");
  process.stdout.write(out);

  if (res.status === 0) {
    console.log("PRODUCTION-READY");
    process.exit(0);
  }

  // Extract failing check names from the summary line: "preflight: FAILED (a, b)".
  const m = out.match(/preflight:\s*FAILED\s*\(([^)]*)\)/);
  if (!m) {
    console.log("PARSE-ERROR: could not extract failure details from preflight output");
    process.exit(2);
  }
  const failing = m[1].trim();
  console.log(`NOT-READY: ${failing}`);
  process.exit(1);
}

main();
