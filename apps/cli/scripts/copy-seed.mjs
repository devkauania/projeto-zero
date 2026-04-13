#!/usr/bin/env node
// Copies the monorepo seed `.agents/default-wizard-config.json` into the
// CLI's dist/ directory so that the published tarball is self-contained.
// When the CLI is installed globally, findSeedConfigPath() resolves the seed
// relative to its compiled file location — no walk back to the monorepo root
// is possible from `<npm-prefix>/lib/node_modules/@projeto-zero/cli/dist/...`.
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, "..");
const src = resolve(pkgRoot, "../../.agents/default-wizard-config.json");
const destDir = resolve(pkgRoot, "dist");
const dest = resolve(destDir, "default-wizard-config.json");

if (!existsSync(src)) {
  console.error(`[copy-seed] source not found: ${src}`);
  process.exit(1);
}
mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);

// Validate the copied file is valid JSON (M6: build must not pass with invalid seed)
try {
  JSON.parse(readFileSync(dest, "utf8"));
} catch (err) {
  console.error(`[copy-seed] copied file is not valid JSON: ${dest}`);
  console.error(`[copy-seed] ${err.message}`);
  process.exit(1);
}

console.log(`[copy-seed] ${src} -> ${dest}`);
