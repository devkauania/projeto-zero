import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";
import {
  directoryExists,
  fileExists,
  ensureDir,
  copyFile,
  readJsonFile,
  writeJsonFile,
  findSeedConfigPath,
} from "../lib/fs-utils.js";

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "pz-fs-utils-"));
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("directoryExists / fileExists", () => {
  it("returns false for missing paths", async () => {
    expect(await directoryExists(path.join(tmp, "nope"))).toBe(false);
    expect(await fileExists(path.join(tmp, "nope.txt"))).toBe(false);
  });

  it("distinguishes files from directories", async () => {
    const sub = path.join(tmp, "sub");
    await fs.mkdir(sub);
    const file = path.join(tmp, "a.txt");
    await fs.writeFile(file, "hi");

    expect(await directoryExists(sub)).toBe(true);
    expect(await directoryExists(file)).toBe(false);
    expect(await fileExists(file)).toBe(true);
    expect(await fileExists(sub)).toBe(false);
  });
});

describe("ensureDir", () => {
  it("creates a nested directory and reports true the first time", async () => {
    const target = path.join(tmp, "a", "b", "c");
    expect(await ensureDir(target)).toBe(true);
    expect(await directoryExists(target)).toBe(true);
  });

  it("returns false when the directory already exists", async () => {
    const target = path.join(tmp, "already");
    await fs.mkdir(target);
    expect(await ensureDir(target)).toBe(false);
  });
});

describe("copyFile", () => {
  it("copies a file and creates parent directories", async () => {
    const src = path.join(tmp, "src.txt");
    await fs.writeFile(src, "payload");
    const dest = path.join(tmp, "nested", "deep", "dest.txt");

    await copyFile(src, dest);

    expect(await fs.readFile(dest, "utf-8")).toBe("payload");
  });
});

describe("readJsonFile / writeJsonFile", () => {
  it("round-trips structured data", async () => {
    const file = path.join(tmp, "config.json");
    const data = { name: "zero", agents: ["coder", "mcp"], nested: { n: 1 } };

    await writeJsonFile(file, data);
    const roundTrip = await readJsonFile<typeof data>(file);

    expect(roundTrip).toEqual(data);
    // Written JSON should be pretty-printed with a trailing newline.
    const raw = await fs.readFile(file, "utf-8");
    expect(raw.endsWith("\n")).toBe(true);
    expect(raw).toContain("\n  ");
  });

  it("returns null for a missing JSON file", async () => {
    expect(await readJsonFile(path.join(tmp, "missing.json"))).toBeNull();
  });
});

describe("findSeedConfigPath", () => {
  it("locates the real seed config by walking up from an anchor inside the repo", () => {
    // Anchor: this test file's own URL. The real repo seed lives at
    // ../../../../.agents/default-wizard-config.json relative to here.
    const anchor = import.meta.url;
    const found = findSeedConfigPath(anchor);
    expect(found).not.toBeNull();
    expect(found!.endsWith("default-wizard-config.json")).toBe(true);
  });

  it("finds a packaged seed sitting next to the compiled caller (installed layout)", async () => {
    // Simulate `<npm-prefix>/lib/node_modules/@projeto-zero/cli/dist/commands/init.js`
    // with seed at `<...>/dist/default-wizard-config.json`, and NO .agents/
    // folder anywhere in the ancestor chain.
    const fakePkg = path.join(tmp, "lib", "node_modules", "@projeto-zero", "cli");
    const distCommands = path.join(fakePkg, "dist", "commands");
    await fs.mkdir(distCommands, { recursive: true });
    const fakeCaller = path.join(distCommands, "init.js");
    await fs.writeFile(fakeCaller, "");
    const seedDest = path.join(fakePkg, "dist", "default-wizard-config.json");
    await fs.writeFile(seedDest, JSON.stringify({ connectors: {} }));

    // chdir somewhere else entirely so the cwd fallback cannot accidentally succeed.
    const originalCwd = process.cwd();
    process.chdir(tmp);
    try {
      const found = findSeedConfigPath(pathToFileURL(fakeCaller).href);
      expect(found).not.toBeNull();
      expect(path.normalize(found!)).toBe(path.normalize(seedDest));
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("returns null when walking up from a path with no seed anywhere", async () => {
    // Create an isolated temp tree with no .agents folder.
    const deep = path.join(tmp, "a", "b", "c");
    await fs.mkdir(deep, { recursive: true });
    const fakeFile = path.join(deep, "anchor.js");
    await fs.writeFile(fakeFile, "");
    const anchor = pathToFileURL(fakeFile).href;

    // Temporarily chdir somewhere without a seed so the cwd fallback also fails.
    const originalCwd = process.cwd();
    process.chdir(tmp);
    try {
      expect(findSeedConfigPath(anchor)).toBeNull();
    } finally {
      process.chdir(originalCwd);
    }
  });
});
