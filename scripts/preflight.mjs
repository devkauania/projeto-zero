#!/usr/bin/env node
// preflight.mjs — orchestrator. Single command a developer runs to know if
// the repo is shippable. Exits 0 only when every check passes.

import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(fileURLToPath(import.meta.url), "..", "..");

// Node scripts run without a shell, so a space in the clone path is just part of
// an argument. Only npm needs cmd.exe, for its .cmd shim on Windows, and its
// arguments are fixed strings; the path reaches it as cwd.
const script = (name) => ({ cmd: process.execPath, args: [join(REPO_ROOT, "scripts", name)] });

const CHECKS = [
  { name: "build",            npm: "run build" },
  { name: "lint",             npm: "run lint" },
  { name: "test",             npm: "run test" },
  { name: "files-exist",      ...script("files-exist.mjs") },
  { name: "pack-sanity",      ...script("pack-sanity.mjs") },
  { name: "pack-smoke",       ...script("pack-smoke.mjs") },
  { name: "repo-metadata",    ...script("repo-metadata-check.mjs") },
  { name: "placeholder-scan",      ...script("placeholder-scan.mjs") },
  { name: "check-no-self-dep",     ...script("check-no-self-dep.mjs") },
  { name: "check-no-multi-llm",    ...script("check-no-multi-llm.mjs") },
  { name: "check-workflows",       ...script("check-workflows.mjs") },
];

function run(check) {
  const started = Date.now();
  const res = check.npm
    ? spawnSync(`npm ${check.npm}`, { cwd: REPO_ROOT, shell: true, stdio: "inherit" })
    : spawnSync(check.cmd, check.args, { cwd: REPO_ROOT, stdio: "inherit" });
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
