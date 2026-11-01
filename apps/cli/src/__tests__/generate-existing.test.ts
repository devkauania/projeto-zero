// generate against a folder that is not empty: the README's own Quickstart
// runs it in `.`, and a re-run is normal. Fresh temp dirs can't catch this.

import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { assertBuilt, linkDir, runCli, writeSavedWizard } from "./helpers/cli.js";
import { scaffoldProject } from "../lib/scaffolder.js";
import type { WizardConfig } from "../lib/config.js";

let base: string;
let cfgDir: string;
let target: string;
let env: Record<string, string>;

beforeAll(assertBuilt);
beforeEach(async () => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), "pz-existing-"));
  cfgDir = path.join(base, "cfg");
  target = path.join(base, "repo");
  fs.mkdirSync(target);
  env = { ANTIGRAVITY_CONFIG_DIR: cfgDir };
  // Saved by the real init, so it has the defaults.targetDir real configs have.
  const r = await runCli(["init"], { env, stdin: "demo-app\ncoder mcp\ny\n" });
  expect(r.code, r.all).toBe(0);
});
afterEach(() => {
  fs.rmSync(base, { recursive: true, force: true, maxRetries: 3 });
});

const read = (rel: string) => fs.readFileSync(path.join(target, rel), "utf8");

describe("generate -d: where the files land", { timeout: 60000 }, () => {
  it("-d wins over the saved defaults.targetDir and cwd stays untouched", async () => {
    const cwd = path.join(base, "elsewhere");
    fs.mkdirSync(cwd);
    const r = await runCli(["generate", "-d", target], { env, cwd });
    expect(r.code, r.all).toBe(0);
    expect(read("CLAUDE.md").split(/\r?\n/)[0]).toBe("# demo-app");
    expect(fs.readdirSync(cwd)).toEqual([]);
  });

  it("with no -d it uses the saved default, the current directory", async () => {
    const r = await runCli(["generate"], { env, cwd: target });
    expect(r.code, r.all).toBe(0);
    expect(read("CLAUDE.md").split(/\r?\n/)[0]).toBe("# demo-app");
  });
});

describe("generate never destroys a file it did not write", { timeout: 60000 }, () => {
  const MINE = "# MY HAND WRITTEN MEMORY\n";
  const MY_AGENT = "my own coder agent\n";

  beforeEach(() => {
    fs.writeFileSync(path.join(target, "CLAUDE.md"), MINE);
    fs.mkdirSync(path.join(target, ".agents"), { recursive: true });
    fs.writeFileSync(path.join(target, ".agents", "coder.md"), MY_AGENT);
  });

  it("keeps existing files, writes the missing ones, and says what it skipped", async () => {
    const r = await runCli(["generate", "-d", target], { env });
    expect(r.code, r.all).toBe(0);
    expect(read("CLAUDE.md")).toBe(MINE);
    expect(read(".agents/coder.md")).toBe(MY_AGENT);
    expect(fs.existsSync(path.join(target, "skills", "coder", "SKILL.md"))).toBe(true);
    expect(fs.existsSync(path.join(target, ".agents", "mcp.md"))).toBe(true);
    expect(r.all).toMatch(/CLAUDE\.md/);
    expect(r.all).toMatch(/\.agents\/coder\.md/);
    expect(r.all).toMatch(/--force/);
    expect(r.all).toMatch(/skipped 2/i);
  });

  it("--force overwrites them", async () => {
    const r = await runCli(["generate", "-d", target, "--force"], { env });
    expect(r.code, r.all).toBe(0);
    expect(read("CLAUDE.md").split(/\r?\n/)[0]).toBe("# demo-app");
    expect(read(".agents/coder.md")).toMatch(/^---\nname: coder/);
    expect(r.all).not.toMatch(/skipped/i);
  });

  it("running generate twice changes nothing the second time", async () => {
    const clean = path.join(base, "fresh");
    await runCli(["generate", "-d", clean], { env });
    const first = fs.readFileSync(path.join(clean, "CLAUDE.md"), "utf8");
    const again = await runCli(["generate", "-d", clean], { env });
    expect(again.code, again.all).toBe(0);
    expect(fs.readFileSync(path.join(clean, "CLAUDE.md"), "utf8")).toBe(first);
    expect(again.all).toMatch(/Created 0 artifacts/);
  });
});

describe("generate does not write through a link in the target tree", { timeout: 60000 }, () => {
  it.each([
    [".agents", ["coder.md"]],
    ["skills", ["coder"]],
    [".mcp", ["x.json"]],
  ])("a %s link is refused and nothing lands outside", async (name, escaped) => {
    const config: WizardConfig = {
      projectName: "p",
      agents: ["coder"],
      includeTemplates: true,
      mcpConnectors: {
        x: { id: "x", label: "x", description: "x", tools: [], requiredFor: [] },
      },
    };
    writeSavedWizard(cfgDir, config);
    const outside = path.join(base, "outside");
    fs.mkdirSync(outside);
    linkDir(outside, path.join(target, name));
    const r = await runCli(["generate", "-d", target], { env });
    expect(r.code, r.all).toBe(1);
    expect(r.all).toMatch(/through a link/);
    expect(r.all).toContain(name);
    for (const e of escaped) expect(fs.existsSync(path.join(outside, e))).toBe(false);
    expect(fs.readdirSync(outside)).toEqual([]);
    // Refused up front, so the target was not half written either.
    expect(fs.existsSync(path.join(target, "CLAUDE.md"))).toBe(false);
  });

  it("--force does not get around it", async () => {
    const outside = path.join(base, "outside");
    fs.mkdirSync(outside);
    linkDir(outside, path.join(target, ".agents"));
    const r = await runCli(["generate", "-d", target, "--force"], { env });
    expect(r.code, r.all).toBe(1);
    expect(fs.readdirSync(outside)).toEqual([]);
  });

  it("a link in the path leading to the target is the user's choice and still works", async () => {
    const realTarget = path.join(base, "real-target");
    fs.mkdirSync(realTarget);
    const viaLink = path.join(base, "via-link");
    linkDir(realTarget, viaLink);
    const r = await runCli(["generate", "-d", viaLink], { env });
    expect(r.code, r.all).toBe(0);
    expect(fs.existsSync(path.join(realTarget, "CLAUDE.md"))).toBe(true);
  });
});

describe("a tampered config is refused before the first write", { timeout: 60000 }, () => {
  const conn = { id: "x", label: "x", description: "x", tools: [], requiredFor: [] };
  it.each([
    ["inherited agent name", { projectName: "p", agents: ["constructor"], includeTemplates: true }, /agent/],
    ["unknown agent", { projectName: "p", agents: ["wizard"], includeTemplates: true }, /agent/],
    ["agent not a string", { projectName: "p", agents: [1], includeTemplates: true }, /agent/],
    ["null connector", { projectName: "p", agents: ["coder"], includeTemplates: true, mcpConnectors: { ok: null } }, /connector/],
    ["no project name", { agents: ["coder"], includeTemplates: true }, /projectName/],
    ["blank project name", { projectName: " ", agents: ["coder"], includeTemplates: true }, /projectName/],
    ["agents missing", { projectName: "p", includeTemplates: true, mcpConnectors: { x: conn } }, /agents/],
    ["bad defaults", { projectName: "p", agents: ["coder"], includeTemplates: true, defaults: { targetDir: 5 } }, /targetDir/],
    ["saved target above the cwd", { projectName: "p", agents: ["coder"], includeTemplates: true, defaults: { targetDir: "../../outside" } }, /targetDir/],
    ["saved target with .. inside it", { projectName: "p", agents: ["coder"], includeTemplates: true, defaults: { targetDir: "a/../../outside" } }, /targetDir/],
    ["saved target with a backslash ..", { projectName: "p", agents: ["coder"], includeTemplates: true, defaults: { targetDir: "..\\outside" } }, /targetDir/],
    ["saved absolute target", { projectName: "p", agents: ["coder"], includeTemplates: true, defaults: { targetDir: path.resolve("/somewhere") } }, /targetDir/],
    ["saved drive-relative target", { projectName: "p", agents: ["coder"], includeTemplates: true, defaults: { targetDir: "C:outside" } }, /targetDir/],
  ])("%s exits 1 with no file written", async (_label, wizard, message) => {
    writeSavedWizard(cfgDir, wizard);
    const r = await runCli(["generate", "-d", target], { env });
    expect(r.code, r.all).toBe(1);
    expect(r.all).toMatch(message);
    expect(r.all).not.toMatch(/TypeError/);
    expect(fs.readdirSync(target)).toEqual([]);
  });

  it("a tampered saved target cannot send a bare generate out of the cwd", async () => {
    const cwd = path.join(target, "a", "b");
    fs.mkdirSync(cwd, { recursive: true });
    writeSavedWizard(cfgDir, {
      projectName: "p",
      agents: ["coder"],
      includeTemplates: true,
      defaults: { targetDir: "../../escaped" },
    });
    const r = await runCli(["generate"], { env, cwd });
    expect(r.code, r.all).toBe(1);
    expect(fs.existsSync(path.join(target, "escaped"))).toBe(false);
  });

  it("a saved target below the cwd still works", async () => {
    writeSavedWizard(cfgDir, {
      projectName: "p",
      agents: ["coder"],
      includeTemplates: false,
      defaults: { targetDir: "sub/dir" },
    });
    const r = await runCli(["generate"], { env, cwd: target });
    expect(r.code, r.all).toBe(0);
    expect(fs.existsSync(path.join(target, "sub", "dir", "CLAUDE.md"))).toBe(true);
  });

  it("the sink refuses a bad config even without going through loadConfig", async () => {
    const bad = { projectName: "p", agents: ["constructor"], includeTemplates: true } as WizardConfig;
    await expect(scaffoldProject(bad, target)).rejects.toThrow(/agent/);
    expect(fs.readdirSync(target)).toEqual([]);
  });
});
