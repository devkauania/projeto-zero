#!/usr/bin/env node
// check-workflows.mjs — CI guard for .github/workflows/*.yml hardening.
// Wired into scripts/preflight.mjs. Plain text checks (no YAML dependency).
//
// Fails if:
//   - any `uses:` references a remote action by tag/branch instead of a full
//     40-character commit SHA (tags can be moved to malicious commits);
//   - a workflow has no top-level `permissions:` block, or uses write-all;
//   - a workflow uses the `pull_request_target` trigger;
//   - `id-token: write` appears outside release.yml;
//   - release.yml loses its release gates: the production `npm audit`, the
//     credential-free build/test + `--ignore-scripts` publish, Node >= 22 and
//     npm >= 11.5.1 (needed for npm Trusted Publishing).

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WF_DIR = join(ROOT, ".github", "workflows");

const failures = [];
const fail = (file, msg) => failures.push(`${file}: ${msg}`);

function cmpSemver(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  }
  return 0;
}

const files = readdirSync(WF_DIR).filter((f) => /\.ya?ml$/.test(f));
if (files.length === 0) {
  console.error("check-workflows: FAIL — no workflow files found");
  process.exit(1);
}

for (const file of files) {
  const src = readFileSync(join(WF_DIR, file), "utf8").replace(/\r\n/g, "\n");
  const lines = src.split("\n");

  lines.forEach((line, i) => {
    const m = line.match(/^\s*-?\s*uses:\s*([^\s#]+)/);
    if (!m) return;
    const ref = m[1].replace(/^["']|["']$/g, "");
    if (ref.startsWith("./") || ref.startsWith("docker://")) return;
    if (!/@[0-9a-f]{40}$/.test(ref)) {
      fail(file, `line ${i + 1}: action "${ref}" is not pinned to a full commit SHA`);
    }
  });

  if (!/^permissions:/m.test(src)) fail(file, "no top-level permissions: block");
  if (/write-all/.test(src)) fail(file, "uses write-all permissions");
  if (/pull_request_target/.test(src)) fail(file, "uses the pull_request_target trigger");
  if (file !== "release.yml" && /id-token:\s*write/.test(src)) {
    fail(file, "grants id-token: write outside release.yml");
  }

  if (file === "release.yml") {
    if (!/^permissions:\s*\{\s*\}\s*$/m.test(src)) {
      fail(file, "top-level permissions must be {} (grant per job)");
    }
    if (!/npm audit --omit=dev --audit-level=high/.test(src)) {
      fail(file, "missing `npm audit --omit=dev --audit-level=high` gate");
    }
    if (!/npm publish[^\n]*--ignore-scripts/.test(src)) {
      fail(file, "npm publish must use --ignore-scripts (build/test run in an earlier step)");
    }
    const node = src.match(/node-version:\s*["']?(\d+)/);
    if (!node || Number(node[1]) < 22) {
      fail(file, "node-version must be >= 22 (npm Trusted Publishing)");
    }
    const npm = src.match(/npm install -g npm@(\d+\.\d+\.\d+)/);
    if (!npm || cmpSemver(npm[1], "11.5.1") < 0) {
      fail(file, "must install an exact npm >= 11.5.1 (npm Trusted Publishing)");
    }
  }
}

if (failures.length > 0) {
  console.error(`check-workflows: FAIL — ${failures.length} problem(s):`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`check-workflows: PASS — ${files.length} workflow(s) hardened`);
