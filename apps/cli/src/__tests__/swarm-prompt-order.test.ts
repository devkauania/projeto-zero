// Which agent gets which prompt depends on this order. NTFS and many Linux
// filesystems happen to list names sorted, so a test on a real folder cannot tell
// whether the code sorts at all. Here the listing comes back in the wrong order.

import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    default: actual,
    readdirSync: (dir: string) => (actual.readdirSync(dir) as string[]).slice().reverse(),
  };
});

describe("discoverPrompts", () => {
  it("returns prompts sorted by id whatever order the filesystem lists them in", async () => {
    const { discoverPrompts } = await import("../lib/swarm/prompt-browser.js");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pz-order-"));
    try {
      for (const name of ["a.md", "b.md", "c.md"]) fs.writeFileSync(path.join(dir, name), "# x\n");
      expect(discoverPrompts({ dir }).map((p) => p.id)).toEqual(["a", "b", "c"]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
