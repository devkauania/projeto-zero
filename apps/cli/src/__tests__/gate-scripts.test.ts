// The gates themselves must work on a path with a space, a common case on
// Windows (C:\Users\First Last) that CI runners never have. The real scripts run
// in a throwaway copy of the repo layout where every check they call is a stub,
// so this tests the scripts' plumbing and nothing recurses into the real suite.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const REAL_SCRIPTS = path.resolve(here, "..", "..", "..", "..", "scripts");

let root: string;

function setUpCopy(failing: string[] = []): void {
  const scripts = path.join(root, "scripts");
  fs.mkdirSync(scripts, { recursive: true });
  for (const name of fs.readdirSync(REAL_SCRIPTS)) {
    if (!name.endsWith(".mjs")) continue;
    const stub = failing.includes(name) ? "process.exit(1);\n" : "console.log('stub ok');\n";
    fs.writeFileSync(path.join(scripts, name), stub);
  }
  for (const real of ["preflight.mjs", "verdict.mjs", "session-gate.mjs"]) {
    fs.copyFileSync(path.join(REAL_SCRIPTS, real), path.join(scripts, real));
  }
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({
      name: "stub",
      private: true,
      scripts: { build: "node -e 0", lint: "node -e 0", test: "node -e 0" },
    })
  );
}

function runScript(name: string) {
  return spawnSync(process.execPath, [path.join(root, "scripts", name)], {
    cwd: root,
    encoding: "utf8",
    timeout: 120000,
  });
}

beforeEach(() => {
  root = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "pz gate ação ")), "a b");
  fs.mkdirSync(root);
});
afterEach(() => {
  fs.rmSync(path.dirname(root), { recursive: true, force: true, maxRetries: 3 });
});

describe("gate scripts on a path with a space and an accent", { timeout: 180000 }, () => {
  it("preflight runs every check and passes", () => {
    setUpCopy();
    const r = runScript("preflight.mjs");
    expect(r.stdout + r.stderr).not.toMatch(/Cannot find module/);
    expect(r.stdout).toMatch(/preflight: ALL PASS/);
    expect(r.status).toBe(0);
  });

  it("preflight still fails, and names the check, when a check really fails", () => {
    setUpCopy(["check-workflows.mjs"]);
    const r = runScript("preflight.mjs");
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/preflight: FAILED \(check-workflows\)/);
  });

  it("verdict reads preflight's real result in both directions", () => {
    setUpCopy();
    const pass = runScript("verdict.mjs");
    expect(pass.stdout).toMatch(/^PRODUCTION-READY/m);
    expect(pass.status).toBe(0);

    setUpCopy(["pack-sanity.mjs"]);
    const fail = runScript("verdict.mjs");
    expect(fail.stdout).toMatch(/NOT-READY: pack-sanity/);
    expect(fail.status).toBe(1);
  });

  it("session-gate reaches preflight and sees it pass", () => {
    setUpCopy();
    const r = runScript("session-gate.mjs");
    expect(r.stdout).toMatch(/PASS preflight/);
    expect(r.stdout + r.stderr).not.toMatch(/Cannot find module/);
  });
});
