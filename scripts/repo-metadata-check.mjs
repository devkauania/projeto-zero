#!/usr/bin/env node
// repo-metadata-check.mjs — apps/cli/package.json metadata correctness.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const PKG_PATH = join(REPO_ROOT, "apps", "cli", "package.json");

const REQUIRED_STRING_FIELDS = [
  "name", "version", "description", "main", "type", "license", "author",
];

// Same pattern source as placeholder-scan (kept in sync manually).
const PLACEHOLDER_PATTERN = new RegExp(
  "\\b(TODO|FIXME|XXX|HACK|placeholder|change[- ]?me|example\\.com|" +
    "github\\.com/projeto-zero|your-org-here|lorem ipsum)\\b",
  "i"
);

const REPO_URL_RE = /^https:\/\/github\.com\/[^/]+\/[^/]+\.git$/;

function checkEnginesNode(spec) {
  if (typeof spec !== "string") return false;
  // Accept forms like ">=20", ">=20.0.0", ">=20.5.1".
  const m = spec.match(/>=\s*(\d+)/);
  if (!m) return false;
  return Number(m[1]) >= 20;
}

function main() {
  if (!existsSync(PKG_PATH)) {
    console.log(`FAIL repo-metadata: ${PKG_PATH} missing`);
    process.exit(1);
  }
  const pkg = JSON.parse(readFileSync(PKG_PATH, "utf8"));
  const problems = [];

  for (const f of REQUIRED_STRING_FIELDS) {
    if (typeof pkg[f] !== "string" || pkg[f].trim() === "") {
      problems.push(`missing/empty string field: ${f}`);
    }
  }

  if (!pkg.bin || typeof pkg.bin !== "object" || Object.keys(pkg.bin).length === 0) {
    problems.push("missing/empty bin mapping");
  }

  const repoUrl = pkg.repository && pkg.repository.url;
  if (!repoUrl) {
    problems.push("missing repository.url");
  } else {
    if (!REPO_URL_RE.test(repoUrl)) {
      problems.push(`repository.url '${repoUrl}' does not match ^https://github.com/<owner>/<repo>.git$`);
    }
    if (PLACEHOLDER_PATTERN.test(repoUrl)) {
      problems.push(`repository.url '${repoUrl}' matches placeholder regex (rule R12)`);
    }
  }

  const engines = pkg.engines && pkg.engines.node;
  if (!checkEnginesNode(engines)) {
    problems.push(`engines.node '${engines}' does not satisfy >=20`);
  }

  const scripts = pkg.scripts || {};
  const pre = scripts.prepublishOnly;
  if (!pre) {
    problems.push("missing scripts.prepublishOnly");
  } else {
    if (!/build/.test(pre) || !/test/.test(pre)) {
      problems.push(`scripts.prepublishOnly '${pre}' must reference both build and test`);
    }
  }

  if (problems.length === 0) {
    console.log("PASS repo-metadata: apps/cli/package.json metadata is complete and valid.");
    process.exit(0);
  }
  console.log(`FAIL repo-metadata: ${problems.length} issue(s):`);
  for (const p of problems) console.log(`  ${p}`);
  process.exit(1);
}

main();
