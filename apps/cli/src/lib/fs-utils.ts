import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Check whether a directory exists on disk.
 */
export async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fsp.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Check whether a file exists on disk.
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stat = await fsp.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

/**
 * Ensure a directory exists, creating it (and parents) if necessary.
 * Returns true if the directory was created, false if it already existed.
 */
export async function ensureDir(dirPath: string): Promise<boolean> {
  if (await directoryExists(dirPath)) return false;
  await fsp.mkdir(dirPath, { recursive: true });
  return true;
}

/**
 * Copy a file from src to dest, creating parent directories as needed.
 */
export async function copyFile(src: string, dest: string): Promise<void> {
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  await fsp.copyFile(src, dest);
}

/**
 * Read a JSON file and parse it. Returns null if the file doesn't exist.
 */
export async function readJsonFile<T = unknown>(
  filePath: string
): Promise<T | null> {
  if (!(await fileExists(filePath))) return null;
  const content = await fsp.readFile(filePath, "utf-8");
  try {
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * Write an object as formatted JSON to a file, creating parent dirs as needed.
 */
export async function writeJsonFile(
  filePath: string,
  data: unknown
): Promise<void> {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

/**
 * Locate the `default-wizard-config.json` seed file.
 *
 * Resolution strategy (in order), walking up from the given anchor URL
 * (typically `import.meta.url` of the caller):
 *   1. A sibling/upward `default-wizard-config.json` — this is the packaged
 *      layout: when the CLI is installed via `npm i -g`, the seed is shipped
 *      inside the published tarball under `dist/default-wizard-config.json`,
 *      and compiled callers live under `dist/commands/` or `dist/lib/`.
 *   2. A `.agents/default-wizard-config.json` walking up — this is the dev
 *      monorepo layout where the seed lives at the repo root `.agents/`.
 *   3. A cwd-relative `.agents/default-wizard-config.json` fallback.
 *
 * Returns null if not found.
 */
export function findSeedConfigPath(anchorUrl: string): string | null {
  const startDir = path.dirname(fileURLToPath(anchorUrl));

  // Strategy 1 + 2 interleaved while walking up.
  let dir = startDir;
  for (let i = 0; i < 8; i++) {
    const packaged = path.join(dir, "default-wizard-config.json");
    if (fs.existsSync(packaged)) return packaged;
    const dev = path.join(dir, ".agents", "default-wizard-config.json");
    if (fs.existsSync(dev)) return dev;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  // Strategy 3.
  const cwdCandidate = path.resolve(".agents", "default-wizard-config.json");
  if (fs.existsSync(cwdCandidate)) return cwdCandidate;

  return null;
}
