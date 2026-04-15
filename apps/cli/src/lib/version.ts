import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Single source of truth for the CLI version.
 * Read from the shipped package.json so `antigravity --version`, the
 * figlet banner, and `package.json.version` can never drift.
 *
 * Layout in both the published tarball and the built dist:
 *   dist/lib/version.js
 *   package.json
 * So `../../package.json` relative to this compiled file resolves to the
 * package's package.json in every install location.
 */
const here = dirname(fileURLToPath(import.meta.url));
const pkgPath = join(here, "..", "..", "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string };

export const VERSION: string = pkg.version;
