import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { saveConfig, type WizardConfig } from "../lib/config.js";
import { infoCommand } from "../commands/info.js";

// Isolate Conf so we never clobber the user's real store.
let tmp: string;
let prevEnv: string | undefined;
let logs: string[] = [];
let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "pz-info-"));
  prevEnv = process.env.ANTIGRAVITY_CONFIG_DIR;
  process.env.ANTIGRAVITY_CONFIG_DIR = tmp;
  logs = [];
  logSpy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    logs.push(args.map(String).join(" "));
  });
});

afterEach(async () => {
  logSpy.mockRestore();
  if (prevEnv === undefined) delete process.env.ANTIGRAVITY_CONFIG_DIR;
  else process.env.ANTIGRAVITY_CONFIG_DIR = prevEnv;
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("info command — defensive rendering", () => {
  it("prints empty-state warning when no config is stored", async () => {
    await infoCommand.parseAsync(["node", "info"]);
    expect(logs.some((l) => /No setup configuration found/.test(l))).toBe(true);
  });

  it("does not crash on a partially-populated config (no mcpConnectors, no defaults, empty agents)", async () => {
    const partial = {
      projectName: "partial",
      agents: [],
      includeTemplates: false,
    } as unknown as WizardConfig;
    saveConfig(partial);
    await infoCommand.parseAsync(["node", "info"]);
    const joined = logs.join("\n");
    expect(joined).toContain("partial");
    expect(joined).toContain("agents:");
    expect(joined).toContain("mcpConnectors:");
    expect(joined).toContain("defaults:");
    // "(none)" placeholder printed in three places.
    expect((joined.match(/\(none\)/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it("survives a connector missing its tools array", async () => {
    const weird = {
      projectName: "weird",
      agents: ["coder"],
      includeTemplates: false,
      mcpConnectors: {
        supabase: {
          id: "supabase",
          label: "Supabase",
          description: "db",
          requiredFor: ["coder"],
          // tools omitted on purpose
        },
      },
    } as unknown as WizardConfig;
    saveConfig(weird);
    await infoCommand.parseAsync(["node", "info"]);
    const joined = logs.join("\n");
    expect(joined).toContain("supabase");
    expect(joined).toContain("0 tools");
  });
});
