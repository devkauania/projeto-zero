// One-shot audit of the packaged tarball. Not wired into gate scripts.
// Usage: node scripts/audit-tarball.mjs
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const cliDir = path.resolve("apps/cli");
process.chdir(cliDir);

execSync("npm pack --silent", { stdio: "inherit" });
const tgz = path.join(cliDir, "projeto-zero-cli-1.0.0.tgz");
if (!fs.existsSync(tgz)) {
  throw new Error("tarball not produced: " + tgz);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "audit-"));
// On Windows, msys tar interprets `C:` as a hostname — use --force-local.
// Run from the tmp dir with tgz passed as absolute to sidestep path-quoting quirks.
execSync(`tar --force-local -xzf "${tgz}"`, {
  stdio: "inherit",
  cwd: tmp,
});
fs.unlinkSync(tgz);

function walk(dir, base = "") {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const e of entries) {
    const rel = path.posix.join(base, e.name);
    if (e.isDirectory()) out.push(...walk(path.join(dir, e.name), rel));
    else out.push({ rel, size: fs.statSync(path.join(dir, e.name)).size });
  }
  return out;
}

const pkgDir = path.join(tmp, "package");
const files = walk(pkgDir);
console.log(`=== ALL ${files.length} FILES IN TARBALL ===`);
for (const f of files) {
  console.log(String(f.size).padStart(7), f.rel);
}
console.log();

const pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, "package.json"), "utf8"));
console.log("=== PUBLISHED package.json ===");
console.log(JSON.stringify(pkg, null, 2));
console.log();

// Shebang check on bin entry
for (const [binName, binPath] of Object.entries(pkg.bin || {})) {
  const full = path.join(pkgDir, binPath.replace(/^\.\//, ""));
  const firstLine = fs.readFileSync(full, "utf8").split("\n")[0];
  console.log(`=== bin.${binName} -> ${binPath} shebang: ${JSON.stringify(firstLine)}`);
}
console.log();

// Suspicious content scan (case-insensitive literal substring)
console.log("=== SUSPICIOUS CONTENT SCAN ===");
const suspicious = [
  "TODO",
  "FIXME",
  "XXX",
  "example.com",
  "localhost:",
  "api_key",
  "apikey",
  "secret:",
  "password:",
  "Bearer ",
  "sk-ant-",
  "ghp_",
  "ghs_",
  "npm_",
];
let hits = 0;
for (const f of files) {
  if (f.rel.endsWith(".map")) continue;
  if (!/\.(js|ts|json|md|mjs|cjs)$/.test(f.rel)) continue;
  const content = fs.readFileSync(path.join(pkgDir, f.rel), "utf8");
  const lower = content.toLowerCase();
  const lines = content.split("\n");
  for (const s of suspicious) {
    const needle = s.toLowerCase();
    if (lower.includes(needle)) {
      lines.forEach((ln, i) => {
        if (ln.toLowerCase().includes(needle)) {
          console.log(`[${s}] ${f.rel}:${i + 1}: ${ln.trim().slice(0, 120)}`);
          hits++;
        }
      });
    }
  }
}
if (hits === 0) console.log("(no hits)");
console.log();

// README embedded version check
const readme = fs.readFileSync(path.join(pkgDir, "README.md"), "utf8");
const readmeVersions = readme.match(/v?\d+\.\d+\.\d+/g) || [];
console.log("=== README version strings ===");
console.log(readmeVersions.length ? readmeVersions.join(", ") : "(none)");
console.log();

fs.rmSync(tmp, { recursive: true, force: true });
console.log("audit-tarball: DONE");
