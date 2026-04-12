#!/usr/bin/env node
// Copies the monorepo seed `.agents/default-wizard-config.json` into the
// CLI's dist/ directory so that the published tarball is self-contained.
// When the CLI is installed globally, findSeedConfigPath() resolves the seed
// relative to its compiled file location — no walk back to the monorepo root
// is possible from `<npm-prefix>/lib/node_modules/@projeto-zero/cli/dist/...`.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
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
console.log(`[copy-seed] ${src} -> ${dest}`);
