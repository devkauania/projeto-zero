#!/usr/bin/env node
// check-no-self-dep.mjs — CI guard: fails if @projeto-zero/cli appears in its
// own dependency fields. This bug shipped in v1.0.0 (self-dep introduced during
// post-publish verification via `npm install @projeto-zero/cli` in the workspace).
// Regression: a recursive dep entry confuses npm resolution and signals a broken
// release process. Wired into scripts/preflight.mjs.

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = join(__dirname, "..", "apps", "cli", "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

const SELF = pkg.name; // "@projeto-zero/cli"
const fields = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
const hits = fields.filter((f) => pkg[f]?.[SELF]);

if (hits.length > 0) {
  console.error(
    `check-no-self-dep: FAIL — "${SELF}" found in ${hits.join(", ")} of apps/cli/package.json. ` +
    `Remove the self-referential entry and regenerate the lockfile.`
  );
  process.exit(1);
}

console.log(`check-no-self-dep: PASS — "${SELF}" is not self-referencing`);
