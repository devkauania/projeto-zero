import { rmSync } from "node:fs";
import { compileWindowsShim } from "./src/__tests__/helpers/fake-claude.js";

// Runs once, before any worker. Compiling the Windows shim here means the
// test files only copy it, so they do not race csc.exe.
export function setup(): () => void {
  const sandbox = process.env.PZ_TEST_SANDBOX as string;
  compileWindowsShim(sandbox);
  return () => {
    rmSync(sandbox, { recursive: true, force: true, maxRetries: 3 });
  };
}
