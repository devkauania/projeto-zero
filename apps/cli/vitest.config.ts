import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { defineConfig } from "vitest/config";

// Every test process, and every CLI those tests spawn, inherits these paths.
// Conf falls back to APPDATA / XDG_CONFIG_HOME / HOME when
// ANTIGRAVITY_CONFIG_DIR is unset, so without this a test that leaves the
// override empty writes over the developer's real saved config.
const sandbox = mkdtempSync(path.join(os.tmpdir(), "pz-vitest-"));
process.env.PZ_TEST_SANDBOX = sandbox;

export default defineConfig({
  test: {
    globalSetup: ["./vitest.global-setup.ts"],
    // These tests spawn real CLIs, git and fake agents. More workers than this
    // mostly produce timeouts that look like failures on a 16 GB machine.
    maxWorkers: 2,
    env: {
      PZ_TEST_SANDBOX: sandbox,
      APPDATA: path.join(sandbox, "appdata"),
      LOCALAPPDATA: path.join(sandbox, "localappdata"),
      XDG_CONFIG_HOME: path.join(sandbox, "xdg-config"),
      HOME: path.join(sandbox, "home"),
      NO_COLOR: "1",
    },
  },
});
