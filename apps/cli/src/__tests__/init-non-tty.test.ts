// The path the README advertises for scripts and CI: answers on stdin. These
// assert what init actually saved, read from the store file, and the exit code
// a script would branch on.

import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { assertBuilt, readSavedWizard, runCli } from "./helpers/cli.js";
import { readNonInteractiveAnswers } from "../commands/init.js";

let cfgDir: string;

beforeAll(assertBuilt);
beforeEach(() => {
  cfgDir = fs.mkdtempSync(path.join(os.tmpdir(), "pz-nontty-"));
});
afterEach(() => {
  fs.rmSync(cfgDir, { recursive: true, force: true, maxRetries: 3 });
});

function init(stdin: string | undefined, extra: { stdinDelayMs?: number } = {}) {
  return runCli(["init"], { env: { ANTIGRAVITY_CONFIG_DIR: cfgDir }, stdin, ...extra });
}

describe("init from stdin saves exactly what was answered", { timeout: 60000 }, () => {
  it("name, agents and templates all land in the right field", async () => {
    const r = await init("demo-app\ncoder auditor\ny\n");
    expect(r.code, r.all).toBe(0);
    const saved = readSavedWizard(cfgDir);
    expect(saved?.projectName).toBe("demo-app");
    expect(saved?.agents).toEqual(["coder", "auditor"]);
    expect(saved?.includeTemplates).toBe(true);
  });

  it("selects no MCP connector, even with the mcp agent chosen (ledger row 2)", async () => {
    const r = await init("x\nmcp coder\ny\n");
    expect(r.code, r.all).toBe(0);
    const saved = readSavedWizard(cfgDir);
    expect(saved?.agents).toEqual(["mcp", "coder"]);
    expect(saved?.mcpConnectors).toEqual({});
  });

  it("keeps the seed defaults, which is what real configs look like", async () => {
    await init("x\ncoder\ny\n");
    expect(readSavedWizard(cfgDir)?.defaults).toEqual({ targetDir: "." });
  });

  it.each([
    ["y", true],
    ["Y", true],
    ["yes", true],
    ["", true],
    ["n", false],
    ["N", false],
    ["no", false],
  ])("template answer %j saves includeTemplates=%j", async (answer, expected) => {
    const r = await init(`x\ncoder\n${answer}\n`);
    expect(r.code, r.all).toBe(0);
    expect(readSavedWizard(cfgDir)?.includeTemplates).toBe(expected);
  });

  it.each(["designer,auditor", "designer, auditor", "designer auditor", "DESIGNER  Auditor"])(
    "agent list %j means designer and auditor",
    async (line) => {
      const r = await init(`x\n${line}\ny\n`);
      expect(r.code, r.all).toBe(0);
      expect(readSavedWizard(cfgDir)?.agents).toEqual(["designer", "auditor"]);
    }
  );

  it("a blank name and a blank agent line fall back to the documented defaults", async () => {
    const r = await init("\n\n\n");
    expect(r.code, r.all).toBe(0);
    const saved = readSavedWizard(cfgDir);
    expect(saved?.projectName).toBe("my-project");
    expect(saved?.agents).toEqual(["coder"]);
  });

  it("accepts a last line with no trailing newline, and CRLF", async () => {
    expect((await init("win\r\ncoder\r\nn")).code).toBe(0);
    const saved = readSavedWizard(cfgDir);
    expect(saved?.projectName).toBe("win");
    expect(saved?.includeTemplates).toBe(false);
  });

  it("waits for a slow producer instead of treating it as a cancel", async () => {
    const r = await init("slow-app\ncoder\ny\n", { stdinDelayMs: 1500 });
    expect(r.code, r.all).toBe(0);
    expect(readSavedWizard(cfgDir)?.projectName).toBe("slow-app");
  });
});

describe("init from stdin refuses to report success when it saved nothing", { timeout: 60000 }, () => {
  it.each([
    ["no input at all", undefined],
    ["one line", "only-a-name\n"],
    ["two lines", "name\ncoder\n"],
  ])("%s exits non-zero and saves nothing", async (_label, stdin) => {
    const r = await init(stdin);
    expect(r.code, r.all).toBe(1);
    expect(r.all).toMatch(/expected 3 lines/i);
    expect(readSavedWizard(cfgDir)).toBeNull();
    expect(r.all).not.toMatch(/\n\s+at\s/);
  });

  it("an unknown agent exits non-zero, names it, and saves nothing", async () => {
    const r = await init("x\ncoder wizard\ny\n");
    expect(r.code, r.all).toBe(1);
    expect(r.all).toContain("wizard");
    expect(readSavedWizard(cfgDir)).toBeNull();
  });

  it("an unreadable template answer exits non-zero instead of guessing", async () => {
    const r = await init("x\ncoder\nmaybe\n");
    expect(r.code, r.all).toBe(1);
    expect(r.all).toContain("maybe");
    expect(readSavedWizard(cfgDir)).toBeNull();
  });

  it("an `init && generate` chain with no answers stops at init and writes nothing", async () => {
    const out = path.join(cfgDir, "chain");
    const first = await init(undefined);
    const second = await runCli(["generate", "-d", out], { env: { ANTIGRAVITY_CONFIG_DIR: cfgDir } });
    expect(first.code).toBe(1);
    expect(second.code).toBe(1);
    expect(second.all).toMatch(/init/);
    expect(fs.existsSync(out)).toBe(false);
  });
});

describe("readNonInteractiveAnswers", () => {
  it("gives up on a stream that stays open and silent", async () => {
    const input = new PassThrough();
    input.write("name\n");
    const r = await readNonInteractiveAnswers(input, 50);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/timed out/i);
    input.destroy();
  });

  it("each new line restarts the wait", async () => {
    const input = new PassThrough();
    const pending = readNonInteractiveAnswers(input, 300);
    for (const line of ["slow\n", "coder\n", "n\n"]) {
      await new Promise((r) => setTimeout(r, 150));
      input.write(line);
    }
    const r = await pending;
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.answers.projectName).toBe("slow");
    input.destroy();
  });

  it("stops at the third line without waiting for the stream to end", async () => {
    const input = new PassThrough();
    input.write("a\ncoder\nn\nignored extra line\n");
    const r = await readNonInteractiveAnswers(input, 60000);
    expect(r.ok).toBe(true);
    input.destroy();
  });
});
