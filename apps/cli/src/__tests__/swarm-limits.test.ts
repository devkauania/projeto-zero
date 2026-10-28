import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseMaxBudgetUsd, parseMaxTurns } from "../commands/swarm.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const CLI_ENTRY = path.resolve(here, "..", "..", "dist", "index.js");

// Regression: before this fix `swarm` turned any value it could not use into
// the default, so `--max-budget-usd 0,5` (comma decimal) silently became a
// 5.00 USD cap per agent, ten times what the operator asked for, and
// `--max-turns 1.5` reached Claude Code as a non-integer.

describe("parseMaxBudgetUsd", () => {
  it("returns undefined when the flag is absent (default applies later)", () => {
    expect(parseMaxBudgetUsd(undefined)).toBeUndefined();
  });

  it.each([
    ["0.5", 0.5],
    ["2", 2],
    ["5.00", 5],
    [".25", 0.25],
    [" 1.5 ", 1.5],
    ["0.01", 0.01],
  ])("accepts %j", (raw, expected) => {
    expect(parseMaxBudgetUsd(raw)).toBe(expected);
  });

  it.each(["0,5", "0", "-1", "abc", "", "1e3", "Infinity", "0.001", "5usd"])(
    "refuses %j instead of falling back to the default",
    (raw) => {
      expect(() => parseMaxBudgetUsd(raw)).toThrow(/--max-budget-usd/);
    }
  );
});

describe("parseMaxTurns", () => {
  it("returns undefined when the flag is absent (default applies later)", () => {
    expect(parseMaxTurns(undefined)).toBeUndefined();
  });

  it.each([
    ["1", 1],
    ["20", 20],
    [" 3 ", 3],
  ])("accepts %j", (raw, expected) => {
    expect(parseMaxTurns(raw)).toBe(expected);
  });

  it.each(["0", "-2", "1.5", "x", ""])(
    "refuses %j instead of falling back to the default",
    (raw) => {
      expect(() => parseMaxTurns(raw)).toThrow(/--max-turns/);
    }
  );
});

describe("swarm CLI refuses invalid limits (built dist)", () => {
  it.each([
    [["--max-budget-usd", "0,5"], /--max-budget-usd must be/],
    [["--max-turns", "0"], /--max-turns must be/],
  ])("%j exits 1 with one 'swarm:' prefix and no plan", (flags, message) => {
    if (!fsSync.existsSync(CLI_ENTRY)) {
      throw new Error(`Built CLI not found at ${CLI_ENTRY}. Run \`npm run build\` first.`);
    }
    const r = spawnSync(
      process.execPath,
      [CLI_ENTRY, "swarm", "--dry-run", ...flags],
      { encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } }
    );
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(message);
    expect(r.stderr).not.toMatch(/swarm: swarm:/);
    expect(r.stdout).not.toMatch(/swarm-id:/);
  });
});
