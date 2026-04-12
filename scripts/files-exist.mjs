#!/usr/bin/env node
// files-exist.mjs — rule R16 "friends not enemies" check.
// Reads apps/cli/package.json `files` array and asserts each entry exists
// on disk (relative to apps/cli/). Would have caught the Session 11
// missing-README bug.

import { readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const CLI_DIR = join(REPO_ROOT, "apps", "cli");

function main() {
  const pkgPath = join(CLI_DIR, "package.json");
  if (!existsSync(pkgPath)) {
    console.log(`FAIL files-exist: ${pkgPath} does not exist`);
    process.exit(1);
  }
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const files = pkg.files;
  if (!Array.isArray(files) || files.length === 0) {
    console.log("FAIL files-exist: apps/cli/package.json has no files[] array");
    process.exit(1);
  }
  const missing = [];
  for (const entry of files) {
    const target = join(CLI_DIR, entry);
    if (!existsSync(target)) {
      missing.push(entry);
      continue;
    }
    // A directory is fine; a file is fine. Empty directories are suspicious.
    const st = statSync(target);
    if (st.isDirectory()) {
      // Leave emptiness check to pack-sanity.
    }
  }
  if (missing.length === 0) {
    console.log(`PASS files-exist: all ${files.length} entries in apps/cli/package.json files[] exist.`);
    process.exit(0);
  }
  console.log(`FAIL files-exist: ${missing.length} declared file(s) missing from disk:`);
  for (const m of missing) console.log(`  apps/cli/${m}`);
  process.exit(1);
}

main();
