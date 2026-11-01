// The saved config store: where it lives, what happens when it is damaged, and
// whether the override can be walked out of scope through a link.

import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { assertBuilt, linkDir, readSavedWizard, runCli } from "./helpers/cli.js";
import {
  clearConfig,
  ConfigStoreCorruptError,
  loadConfig,
  saveConfig,
  type WizardConfig,
} from "../lib/config.js";

const sample: WizardConfig = { projectName: "store-test", agents: ["coder"], includeTemplates: false };

let base: string;
let saved: NodeJS.ProcessEnv;

beforeAll(assertBuilt);
beforeEach(() => {
  base = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "pz-store-")));
  saved = { ...process.env };
});
afterEach(() => {
  // In place: env-paths keeps a reference to the original process.env object, so
  // swapping it would make later tests in this file set variables Conf never sees.
  for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
  Object.assign(process.env, saved);
  fs.rmSync(base, { recursive: true, force: true, maxRetries: 3 });
});

describe("ANTIGRAVITY_CONFIG_DIR scope check", { timeout: 60000 }, () => {
  it("a folder merely named like home or tmp is not inside them", async () => {
    const home = path.join(base, "h");
    const tmp = path.join(base, "t");
    fs.mkdirSync(home);
    fs.mkdirSync(tmp);
    for (const dir of [home + "-sibling", tmp + "-sibling"]) {
      const r = await runCli(["init"], {
        env: {
          HOME: home,
          USERPROFILE: home,
          TMPDIR: tmp,
          TEMP: tmp,
          TMP: tmp,
          ANTIGRAVITY_CONFIG_DIR: dir,
        },
        stdin: "app\ncoder\ny\n",
      });
      expect(r.code, r.all).toBe(1);
      expect(r.all).toMatch(/outside the allowed scope/);
      expect(fs.existsSync(path.join(dir, "config.json"))).toBe(false);
    }
  });

  it("a one-character override is refused, whatever folder it would land in", async () => {
    const r = await runCli(["init"], {
      cwd: base,
      env: { ANTIGRAVITY_CONFIG_DIR: "x" },
      stdin: "app\ncoder\ny\n",
    });
    expect(r.code, r.all).toBe(1);
    expect(r.all).toMatch(/too-short/);
    expect(fs.existsSync(path.join(base, "x"))).toBe(false);
  });
});

describe("ANTIGRAVITY_CONFIG_DIR inside home", { timeout: 60000 }, () => {
  function homeEnv(home: string) {
    return { HOME: home, USERPROFILE: home };
  }

  it.each([
    [".ssh"],
    [".gnupg"],
    [".aws"],
    [".kube"],
    [".docker"],
    [".azure"],
    [path.join(".config", "gcloud")],
    [".SSH"],
    [path.join(".ssh", "deeper")],
  ])("refuses the credentials folder %s and writes nothing there", async (rel) => {
    const home = path.join(base, "home");
    const dir = path.join(home, rel);
    fs.mkdirSync(home, { recursive: true });
    const r = await runCli(["init"], {
      env: { ...homeEnv(home), ANTIGRAVITY_CONFIG_DIR: dir },
      stdin: "app\ncoder\ny\n",
    });
    // A POSIX home has .SSH and .ssh as different folders, and .SSH is harmless.
    if (rel === ".SSH" && process.platform !== "win32" && process.platform !== "darwin") {
      expect(r.code, r.all).toBe(0);
      return;
    }
    expect(r.code, r.all).toBe(1);
    expect(r.all).toMatch(/credentials/);
    expect(fs.existsSync(path.join(dir, "config.json"))).toBe(false);
  });

  it("refuses a link inside home that leads to one", async () => {
    const home = path.join(base, "home");
    fs.mkdirSync(path.join(home, ".ssh"), { recursive: true });
    const link = path.join(home, "innocent");
    linkDir(path.join(home, ".ssh"), link);
    const r = await runCli(["init"], {
      env: { ...homeEnv(home), ANTIGRAVITY_CONFIG_DIR: path.join(link, "sub") },
      stdin: "app\ncoder\ny\n",
    });
    expect(r.code, r.all).toBe(1);
    expect(fs.existsSync(path.join(home, ".ssh", "sub"))).toBe(false);
  });

  it("still accepts an ordinary folder in home, and one merely named like them", async () => {
    const home = path.join(base, "home");
    for (const rel of ["my-config", ".sshfoo"]) {
      const dir = path.join(home, rel);
      fs.mkdirSync(dir, { recursive: true });
      const r = await runCli(["init"], {
        env: { ...homeEnv(home), ANTIGRAVITY_CONFIG_DIR: dir },
        stdin: "app\ncoder\ny\n",
      });
      expect(r.code, r.all).toBe(0);
      expect(readSavedWizard(dir)?.projectName).toBe("app");
    }
  });
});

describe("the tests themselves stay away from the real store", () => {
  it("an empty override means the default location, and here that is a sandbox", () => {
    // Point every default the store could resolve to at this test's own folder.
    const home = path.join(base, "home");
    process.env.APPDATA = path.join(home, "appdata");
    process.env.XDG_CONFIG_HOME = path.join(home, "xdg");
    process.env.HOME = home;
    process.env.USERPROFILE = home;
    process.env.ANTIGRAVITY_CONFIG_DIR = "";

    expect(() => saveConfig(sample)).not.toThrow();

    const found = fs
      .readdirSync(home, { recursive: true, encoding: "utf8" })
      .filter((f) => path.basename(f) === "config.json");
    expect(found).toHaveLength(1);
    expect(JSON.parse(fs.readFileSync(path.join(home, found[0]), "utf8")).wizard.projectName).toBe(
      "store-test"
    );
  });

  it("the suite redirects the defaults for every test and child process", () => {
    const sandbox = process.env.PZ_TEST_SANDBOX as string;
    for (const name of ["APPDATA", "XDG_CONFIG_HOME", "HOME"]) {
      expect(path.relative(sandbox, process.env[name] as string).startsWith("..")).toBe(false);
    }
  });
});

describe.skipIf(process.platform === "win32")("store file permissions (ledger row 11)", () => {
  it("is readable only by the owner after a save", () => {
    process.env.ANTIGRAVITY_CONFIG_DIR = base;
    saveConfig(sample);
    const mode = fs.statSync(path.join(base, "config.json")).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it("is tightened again if it was left open", () => {
    process.env.ANTIGRAVITY_CONFIG_DIR = base;
    saveConfig(sample);
    fs.chmodSync(path.join(base, "config.json"), 0o644);
    saveConfig(sample);
    expect(fs.statSync(path.join(base, "config.json")).mode & 0o777).toBe(0o600);
  });
});

describe("a store that is not valid JSON", { timeout: 60000 }, () => {
  let cfgDir: string;
  let file: string;
  let env: Record<string, string>;

  beforeEach(() => {
    cfgDir = path.join(base, "cfg");
    fs.mkdirSync(cfgDir);
    file = path.join(cfgDir, "config.json");
    fs.writeFileSync(file, "{malformed");
    env = { ANTIGRAVITY_CONFIG_DIR: cfgDir };
  });

  it("loadConfig throws an error naming the file", () => {
    process.env.ANTIGRAVITY_CONFIG_DIR = cfgDir;
    expect(() => loadConfig()).toThrow(ConfigStoreCorruptError);
    expect(() => loadConfig()).toThrow(file);
  });

  it("clearConfig removes it, so the store is usable again", () => {
    process.env.ANTIGRAVITY_CONFIG_DIR = cfgDir;
    clearConfig();
    expect(fs.existsSync(file)).toBe(false);
    saveConfig(sample);
    expect(loadConfig()).toEqual(sample);
  });

  it.each([
    ["info", ["info"], undefined],
    ["generate", ["generate", "-d", "out"], undefined],
    ["init", ["init"], "x\ncoder\ny\n"],
  ])("%s exits 1, names the file and leaves it alone", async (_name, args, stdin) => {
    const r = await runCli(args, { env, stdin, cwd: base });
    expect(r.code, r.all).toBe(1);
    expect(r.all.replace(/\s+/g, "")).toContain(file.replace(/\s+/g, ""));
    expect(r.all).toMatch(/reset/);
    expect(r.all).not.toMatch(/\n\s+at\s/);
    expect(fs.readFileSync(file, "utf8")).toBe("{malformed");
  });
});

describe("ANTIGRAVITY_CONFIG_DIR stays in scope through links (ledger row 8)", { timeout: 60000 }, () => {
  // Home and tmp are moved inside this test's folder, so "outside" is a real
  // out-of-scope directory on any machine and nothing leaks when a test fails.
  let home: string;
  let tmp: string;
  let outside: string;
  let scope: Record<string, string>;

  beforeEach(() => {
    home = path.join(base, "home");
    tmp = path.join(base, "tmp");
    outside = path.join(base, "outside");
    for (const d of [home, tmp, outside]) fs.mkdirSync(d);
    scope = { HOME: home, USERPROFILE: home, TMPDIR: tmp, TEMP: tmp, TMP: tmp };
  });

  const run = (dir: string) =>
    runCli(["init"], {
      env: { ...scope, ANTIGRAVITY_CONFIG_DIR: dir },
      stdin: "x\ncoder\ny\n",
    });

  it("the override itself being a link is refused", async () => {
    const link = path.join(home, "link");
    linkDir(outside, link);
    const r = await run(link);
    expect(r.code, r.all).toBe(1);
    expect(r.all).toMatch(/symlink/);
    expect(fs.readdirSync(outside)).toEqual([]);
  });

  it("a link further up the path is refused too", async () => {
    const link = path.join(home, "link");
    linkDir(outside, link);
    const r = await run(path.join(link, "sub", "deeper"));
    expect(r.code, r.all).toBe(1);
    expect(r.all).toMatch(/outside the allowed scope/);
    expect(fs.readdirSync(outside)).toEqual([]);
  });

  it("a link that stays in scope still works", async () => {
    const inHome = path.join(home, "dotfiles");
    fs.mkdirSync(inHome);
    const link = path.join(home, "link");
    linkDir(inHome, link);
    const r = await run(path.join(link, "sub"));
    expect(r.code, r.all).toBe(0);
    expect(readSavedWizard(path.join(inHome, "sub"))?.projectName).toBe("x");
  });

  it("a plain folder under home or tmp works, even one that does not exist yet", async () => {
    expect((await run(path.join(home, "a", "b"))).code).toBe(0);
    expect((await run(path.join(tmp, "c"))).code).toBe(0);
    expect(readSavedWizard(path.join(home, "a", "b"))?.projectName).toBe("x");
  });

  it("a plain folder outside home and tmp is refused", async () => {
    const r = await run(path.join(outside, "x"));
    expect(r.code, r.all).toBe(1);
    expect(r.all).toMatch(/outside the allowed scope/);
    expect(fs.readdirSync(outside)).toEqual([]);
  });
});
