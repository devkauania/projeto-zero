// prompt-browser.ts — discovers .agents/prompts/*.md, returns sorted prompt
// descriptors. The TUI layer (Stage 3 TUI, future) consumes these for the
// pre-launch modal; the dry-run mode prints them plain-text.
//
// Non-TUI by design — the interactive list UI lives in tui-grid and shells
// out here for data only, which keeps discovery testable in a normal
// vitest process.

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export interface PromptDescriptor {
  /** Absolute path to the prompt file. */
  path: string;
  /** Filename without extension, used as the prompt id. */
  id: string;
  /** First non-empty line of the file, trimmed to 120 chars. */
  summary: string;
  /** Size in bytes. */
  bytes: number;
}

export interface DiscoverOptions {
  /** Prompts directory. Defaults to `<cwd>/.agents/prompts`. */
  dir?: string;
  /** Glob extension to match. Default: ".md". */
  ext?: string;
}

/**
 * Walk the prompts directory (non-recursively) and return the descriptors
 * sorted by id. Returns an empty array if the directory does not exist —
 * callers decide whether that's a soft miss or a hard error.
 */
export function discoverPrompts(opts: DiscoverOptions = {}): PromptDescriptor[] {
  const dir = opts.dir ?? path.join(process.cwd(), ".agents", "prompts");
  const ext = opts.ext ?? ".md";

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }

  const out: PromptDescriptor[] = [];
  for (const name of entries) {
    if (!name.endsWith(ext)) continue;
    // Skip .gitkeep and dotfiles generally — they're not prompts.
    if (name.startsWith(".")) continue;
    const full = path.join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (!st.isFile()) continue;

    const id = name.slice(0, name.length - ext.length);
    let summary = "";
    try {
      const body = readFileSync(full, "utf8");
      // First non-empty, non-frontmatter line.
      const lines = body.split(/\r?\n/);
      let inFrontmatter = lines[0]?.trim() === "---";
      for (let i = inFrontmatter ? 1 : 0; i < lines.length; i++) {
        const l = lines[i].trim();
        if (inFrontmatter) {
          if (l === "---") {
            inFrontmatter = false;
            continue;
          }
          continue;
        }
        if (l.length > 0) {
          summary = l.replace(/^#+\s*/, "").slice(0, 120);
          break;
        }
      }
    } catch {
      /* unreadable — leave summary empty */
    }

    out.push({ path: full, id, summary, bytes: st.size });
  }

  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}
