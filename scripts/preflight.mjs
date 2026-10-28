#!/usr/bin/env node
// preflight.mjs — orchestrator. Single command a developer runs to know if
// the repo is shippable. Exits 0 only when every check passes.

import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(fileURLToPath(import.meta.url), "..", "..");

const CHECKS = [
  { name: "build",            cmd: "npm",  args: ["run", "build"], cwd: REPO_ROOT },
  { name: "lint",             cmd: "npm",  args: ["run", "lint"],  cwd: REPO_ROOT },
  { name: "test",             cmd: "npm",  args: ["run", "test"],  cwd: REPO_ROOT },
  { name: "files-exist",      cmd: "node", args: [join(REPO_ROOT, "scripts", "files-exist.mjs")] },
  { name: "pack-sanity",      cmd: "node", args: [join(REPO_ROOT, "scripts", "pack-sanity.mjs")] },
  { name: "repo-metadata",    cmd: "node", args: [join(REPO_ROOT, "scripts", "repo-metadata-check.mjs")] },
  { name: "placeholder-scan",      cmd: "node", args: [join(REPO_ROOT, "scripts", "placeholder-scan.mjs")] },
  { name: "check-no-self-dep",     cmd: "node", args: [join(REPO_ROOT, "scripts", "check-no-self-dep.mjs")] },
  { name: "check-non-tty-connectors", cmd: "node", args: [join(REPO_ROOT, "scripts", "check-non-tty-connectors.mjs")] },
  { name: "check-no-multi-llm",    cmd: "node", args: [join(REPO_ROOT, "scripts", "check-no-multi-llm.mjs")] },
  { name: "check-workflows",       cmd: "node", args: [join(REPO_ROOT, "scripts", "check-workflows.mjs")] },
];

function run(check) {
  const started = Date.now();
  const res = spawnSync(check.cmd, check.args, {
    cwd: check.cwd || REPO_ROOT,
    encoding: "utf8",
    shell: true,
    stdio: "inherit",
  });
  return {
    name: check.name,
    status: res.status === 0 ? "PASS" : "FAIL",
    code: res.status == null ? -1 : res.status,
    ms: Date.now() - started,
  };
}

function main() {
  const results = [];
  for (const c of CHECKS) {
    console.log(`\n=== preflight: ${c.name} ===`);
    results.push(run(c));
  }

  console.log("\n=== preflight summary ===");
  const pad = (s, n) => (s + " ".repeat(n)).slice(0, n);
  console.log(pad("check", 20), pad("status", 8), "ms");
  console.log("-".repeat(40));
  for (const r of results) {
    console.log(pad(r.name, 20), pad(r.status, 8), r.ms);
  }
  const failed = results.filter((r) => r.status !== "PASS").map((r) => r.name);
  if (failed.length === 0) {
    console.log("\npreflight: ALL PASS");
    process.exit(0);
  }
  console.log(`\npreflight: FAILED (${failed.join(", ")})`);
  process.exit(1);
}

main();
