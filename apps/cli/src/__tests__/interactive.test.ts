// The interactive paths, through a real pseudo-terminal. Piped stdio can never
// reach these prompts: init takes its non-TTY path and reset refuses to run.

import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { assertBuilt, CLI_ENTRY, readSavedWizard, writeSavedWizard } from "./helpers/cli.js";

const require = createRequire(import.meta.url);
const pty = require("@lydell/node-pty") as typeof import("@lydell/node-pty");

const DOWN = "\x1b[B";
const LEFT = "\x1b[D";
const SPACE = " ";
const ENTER = "\r";
const CTRL_C = "\x03";

const strip = (s: string) =>
  s
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/\x1b\][^\x07]*\x07/g, "")
    .replace(/\r/g, "");

interface PtyResult {
  exitCode: number;
  text: string;
  stepsDone: number;
}

/** Run the CLI in a terminal. Each step waits for text, then types keys. */
function drive(
  args: string[],
  cfgDir: string,
  steps: Array<[RegExp, string]>,
  cwd: string
): Promise<PtyResult> {
  return new Promise((resolve, reject) => {
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) if (typeof v === "string") env[k] = v;
    env.ANTIGRAVITY_CONFIG_DIR = cfgDir;
    env.NO_COLOR = "1";
    env.TERM = "xterm";

    const term = pty.spawn(process.execPath, [CLI_ENTRY, ...args], { cols: 200, rows: 50, cwd, env });
    let out = "";
    let seenUpTo = 0;
    let i = 0;
    let finished = false;

    const tick = setInterval(() => {
      if (i >= steps.length) return;
      const [re, keys] = steps[i];
      if (re.test(strip(out.slice(seenUpTo)))) {
        seenUpTo = out.length;
        i++;
        // Clack redraws after the text appears; type once it is listening.
        setTimeout(() => {
          try {
            term.write(keys);
          } catch {
            /* the process already left; onExit reports it */
          }
        }, 200);
      }
    }, 50);

    const hang = setTimeout(() => {
      if (finished) return;
      finished = true;
      clearInterval(tick);
      try {
        term.kill();
      } catch {
        /* already gone */
      }
      reject(new Error(`pty timed out at step ${i}/${steps.length}: ${strip(out).slice(-400)}`));
    }, 60000);

    term.onData((d) => (out += d));
    term.onExit(({ exitCode }) => {
      if (finished) return;
      finished = true;
      clearInterval(tick);
      clearTimeout(hang);
      // ConPTY can deliver the last output just after the exit event.
      setTimeout(() => resolve({ exitCode, text: strip(out), stepsDone: i }), 150);
    });
  });
}

let base: string;
let cfg: string;

beforeAll(assertBuilt);
beforeEach(() => {
  base = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "pz-pty ")));
  cfg = path.join(base, "cfg");
});
afterEach(() => {
  fs.rmSync(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

const NAME = /project name/i;
const AGENTS = /subagents to scaffold/i;
const CONNECTORS = /MCP connectors/i;
const TEMPLATES = /template files/i;

describe("init in a terminal", { timeout: 90000 }, () => {
  it("saves the typed name and only the chosen agents and connectors", async () => {
    const r = await drive(
      ["init"],
      cfg,
      [
        [NAME, "Ação Demo" + ENTER],
        // Options are coder, designer, auditor, mcp: pick coder and mcp.
        [AGENTS, SPACE + DOWN + DOWN + DOWN + SPACE + ENTER],
        // Seed order is supabase, vercel, stripe, figma, netlify: pick 1st and 3rd.
        [CONNECTORS, SPACE + DOWN + DOWN + SPACE + ENTER],
        [TEMPLATES, ENTER],
      ],
      base
    );
    expect(r.exitCode, r.text).toBe(0);
    const saved = readSavedWizard(cfg);
    expect(saved?.projectName).toBe("Ação Demo");
    expect(saved?.agents).toEqual(["coder", "mcp"]);
    expect(Object.keys(saved?.mcpConnectors as object).sort()).toEqual(["stripe", "supabase"]);
    expect(saved?.includeTemplates).toBe(true);
    expect(saved?.defaults).toEqual({ targetDir: "." });
  });

  it("does not let you pick no subagents at all", async () => {
    const r = await drive(
      ["init"],
      cfg,
      [
        [NAME, "x" + ENTER],
        // Enter with nothing selected: the prompt must stay and ask again.
        [AGENTS, ENTER],
        [/select at least one/i, SPACE + ENTER],
        [TEMPLATES, ENTER],
      ],
      base
    );
    expect(r.exitCode, r.text).toBe(0);
    expect(r.stepsDone).toBe(4);
    expect(readSavedWizard(cfg)?.agents).toEqual(["coder"]);
  });

  it("does not offer or save connectors unless the mcp agent is chosen", async () => {
    const r = await drive(
      ["init"],
      cfg,
      [
        [NAME, "plain" + ENTER],
        [AGENTS, SPACE + ENTER],
        [TEMPLATES, LEFT + ENTER],
      ],
      base
    );
    expect(r.exitCode, r.text).toBe(0);
    expect(r.text).not.toMatch(CONNECTORS);
    const saved = readSavedWizard(cfg);
    expect(saved?.agents).toEqual(["coder"]);
    expect(saved?.mcpConnectors).toEqual({});
  });

  it.each<[string, Array<[RegExp, string]>]>([
    ["the name prompt", [[NAME, CTRL_C]]],
    ["the agents prompt", [[NAME, "x" + ENTER], [AGENTS, CTRL_C]]],
    ["the connectors prompt", [[NAME, "x" + ENTER], [AGENTS, DOWN + DOWN + DOWN + SPACE + ENTER], [CONNECTORS, CTRL_C]]],
    ["the templates prompt", [[NAME, "x" + ENTER], [AGENTS, SPACE + ENTER], [TEMPLATES, CTRL_C]]],
  ])("Ctrl-C at %s exits 0, with no stack trace and nothing saved", async (_label, steps) => {
    const r = await drive(["init"], cfg, steps, base);
    expect(r.stepsDone).toBe(steps.length);
    expect(r.exitCode, r.text).toBe(0);
    expect(r.text).toMatch(/cancelled/i);
    expect(r.text).not.toMatch(/\n\s+at\s/);
    expect(readSavedWizard(cfg)).toBeNull();
  });
});

describe("reset in a terminal", { timeout: 90000 }, () => {
  const good = { projectName: "keep-me", agents: ["coder"], includeTemplates: false };
  const CONFIRM = /Are you sure/i;

  it("Enter takes the default answer, No, and keeps the config", async () => {
    writeSavedWizard(cfg, good);
    const r = await drive(["reset"], cfg, [[CONFIRM, ENTER]], base);
    expect(r.exitCode, r.text).toBe(0);
    expect(readSavedWizard(cfg)?.projectName).toBe("keep-me");
    expect(r.text).toMatch(/left untouched/i);
  });

  it("answering Yes clears it", async () => {
    writeSavedWizard(cfg, good);
    const r = await drive(["reset"], cfg, [[CONFIRM, LEFT + ENTER]], base);
    expect(r.exitCode, r.text).toBe(0);
    expect(readSavedWizard(cfg)).toBeNull();
  });

  it("Ctrl-C keeps it", async () => {
    writeSavedWizard(cfg, good);
    const r = await drive(["reset"], cfg, [[CONFIRM, CTRL_C]], base);
    expect(r.exitCode, r.text).toBe(0);
    expect(readSavedWizard(cfg)?.projectName).toBe("keep-me");
  });

  it("with nothing saved it says so and does not ask", async () => {
    const r = await drive(["reset"], cfg, [], base);
    expect(r.exitCode, r.text).toBe(0);
    expect(r.text).toMatch(/No configuration to clear/);
  });

  it("clears a tampered store that still parses", async () => {
    writeSavedWizard(cfg, { projectName: "p", agents: [], mcpConnectors: { "../../x": {} } });
    const r = await drive(["reset"], cfg, [[CONFIRM, LEFT + ENTER]], base);
    expect(r.exitCode, r.text).toBe(0);
    expect(readSavedWizard(cfg)).toBeNull();
  });

  it("clears a store that is not even JSON, after naming it", async () => {
    fs.mkdirSync(cfg, { recursive: true });
    const file = path.join(cfg, "config.json");
    fs.writeFileSync(file, "{malformed");
    const r = await drive(["reset"], cfg, [[CONFIRM, LEFT + ENTER]], base);
    expect(r.exitCode, r.text).toBe(0);
    expect(r.text.replace(/\s+/g, "")).toContain(file.replace(/\s+/g, ""));
    expect(fs.existsSync(file)).toBe(false);
  });

  it("answering No on an unparseable store leaves the bytes alone", async () => {
    fs.mkdirSync(cfg, { recursive: true });
    const file = path.join(cfg, "config.json");
    fs.writeFileSync(file, "{malformed");
    const r = await drive(["reset"], cfg, [[CONFIRM, ENTER]], base);
    expect(r.exitCode, r.text).toBe(0);
    expect(fs.readFileSync(file, "utf8")).toBe("{malformed");
  });
});

describe("generate in a terminal", { timeout: 90000 }, () => {
  it("asks for a directory when neither -d nor a saved default gives one", async () => {
    writeSavedWizard(cfg, { projectName: "p", agents: ["coder"], includeTemplates: false });
    const r = await drive(
      ["generate"],
      cfg,
      [[/Where should we generate/i, "pasta nova" + ENTER]],
      base
    );
    expect(r.exitCode, r.text).toBe(0);
    expect(fs.existsSync(path.join(base, "pasta nova", "CLAUDE.md"))).toBe(true);
  });
});
