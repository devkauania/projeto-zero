#!/usr/bin/env node
// pack-sanity.mjs — runs `npm pack --dry-run --json` in apps/cli and
// asserts (a) every files[] entry is represented in the pack list
// ("friends"), (b) no forbidden patterns appear ("enemies"), (c) size
// sanity bounds.

import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const CLI_DIR = join(REPO_ROOT, "apps", "cli");

const FORBIDDEN = [
  /^src\//,
  /\.test\./,
  /tsconfig/,
  /\.turbo/,
  /\.env/,
  /\.DS_Store/,
];

const MIN_BYTES = 5 * 1024;
const MAX_BYTES = 5 * 1024 * 1024;

function main() {
  const pkgPath = join(CLI_DIR, "package.json");
  if (!existsSync(pkgPath)) {
    console.log(`FAIL pack-sanity: ${pkgPath} missing`);
    process.exit(1);
  }
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const declaredFiles = Array.isArray(pkg.files) ? pkg.files : [];

  const res = spawnSync("npm", ["pack", "--dry-run", "--json"], {
    cwd: CLI_DIR,
    encoding: "utf8",
    shell: true,
  });
  if (res.status !== 0) {
    console.log("FAIL pack-sanity: npm pack --dry-run --json failed");
    if (res.stderr) console.log(res.stderr);
    if (res.stdout) console.log(res.stdout);
    process.exit(1);
  }
  // npm may print warnings before the JSON. Locate the JSON array.
  const out = res.stdout;
  const start = out.indexOf("[");
  if (start === -1) {
    console.log("FAIL pack-sanity: could not locate JSON in npm pack output");
    console.log(out);
    process.exit(1);
  }
  let parsed;
  try {
    parsed = JSON.parse(out.slice(start));
  } catch (e) {
    console.log(`FAIL pack-sanity: JSON parse error: ${e.message}`);
    process.exit(1);
  }
  const info = Array.isArray(parsed) ? parsed[0] : parsed;
  const entries = (info.files || []).map((f) => f.path.replace(/\\/g, "/"));
  const size = info.size || info.unpackedSize || 0;

  const problems = [];

  // (a) friends: every declared files[] entry must have at least one
  // member in the pack list. A directory entry matches by prefix.
  for (const declared of declaredFiles) {
    const norm = declared.replace(/\\/g, "/").replace(/^\.\//, "");
    const hit = entries.some(
      (e) => e === norm || e.startsWith(`${norm}/`)
    );
    if (!hit) problems.push(`declared files[] entry missing from pack: ${declared}`);
  }

  // (b) enemies
  for (const entry of entries) {
    for (const re of FORBIDDEN) {
      if (re.test(entry)) {
        problems.push(`forbidden entry in pack: ${entry} (matches ${re})`);
      }
    }
  }

  // (c) size
  if (size && (size < MIN_BYTES || size > MAX_BYTES)) {
    problems.push(
      `pack size ${size} bytes outside sanity bounds [${MIN_BYTES}, ${MAX_BYTES}]`
    );
  }

  if (problems.length === 0) {
    console.log(
      `PASS pack-sanity: ${entries.length} files, ${size} bytes, all declared files[] present, no forbidden patterns.`
    );
    process.exit(0);
  }
  console.log(`FAIL pack-sanity: ${problems.length} issue(s):`);
  for (const p of problems) console.log(`  ${p}`);
  process.exit(1);
}

main();
