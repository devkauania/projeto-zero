#!/usr/bin/env node
// placeholder-scan.mjs — rule R12 enforcement.
// Walks the tracked file tree, rejects placeholder/TODO/example strings.
// Zero dependencies beyond node: built-ins.

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(fileURLToPath(import.meta.url), "..", "..");

const IGNORED_DIRS = new Set([
  "node_modules",
  "dist",
  ".turbo",
  ".git",
  ".next",
  "coverage",
  ".claude",
]);

// Directories where the presence of these terms is narrative/prompt/meta and
// does not indicate a shipping-artifact placeholder. The scan's real target
// is everything that actually ends up in the published npm package.
const IGNORED_DIR_PREFIXES = [
  // Agent-facing prompt library — prompts naturally reference the terms.
  join(".agents", "prompts"),
  // Validation reports — read-only narrative about other sessions.
  join(".agents", "validations"),
  // Session handoffs — narrative documents about past sessions.
  join(".agents", "handoffs"),
  // Security audit reports — narrative documents that legitimately quote
  // gate/check names (e.g., "placeholder-scan PASS") as evidence. Never
  // shipped: apps/cli/package.json files[] = ["dist", "README.md"].
  "audit",
];

const IGNORED_FILES = new Set([
  // The contract file legitimately documents the placeholder regex itself.
  join(".agents", "prompts", "_production-contract.txt"),
  // This scan script itself contains the regex source.
  join("scripts", "placeholder-scan.mjs"),
  // Other gate scripts reference the pattern by name.
  join("scripts", "repo-metadata-check.mjs"),
  join("scripts", "preflight.mjs"),
  join("scripts", "session-gate.mjs"),
  join("scripts", "verdict.mjs"),
  // The allowlist documents allowed exceptions.
  join("scripts", "placeholder-allowlist.txt"),
  // Tarball audit script — legitimately lists the scan keywords as data.
  join("scripts", "audit-tarball.mjs"),
  // Narrative project-management docs in .agents/ root.
  join(".agents", "PROJECT_ROADMAP.md"),
  join(".agents", "antigravity-taxonomy.md"),
  join(".agents", "plano-sessoes-restantes.md"),
  "CHANGELOG.md",
  // Root package.json references the npm script name "scan:placeholders".
  "package.json",
  "package-lock.json",
]);

const IGNORED_EXTENSIONS = new Set([
  ".tgz", ".zip", ".gz", ".png", ".jpg", ".jpeg", ".gif", ".webp",
  ".ico", ".pdf", ".lock", ".log",
]);

// Case-insensitive regex per the prompt. Kept as a string source so the
// file itself is not flagged by the patterns it contains.
const PATTERN_SOURCE =
  "\\b(TODO|FIXME|XXX|HACK|placeholder|change[- ]?me|example\\.com|" +
  "github\\.com/projeto-zero|your-org-here|lorem ipsum)\\b";
const PATTERN = new RegExp(PATTERN_SOURCE, "i");

function loadAllowlist() {
  const p = join(REPO_ROOT, "scripts", "placeholder-allowlist.txt");
  if (!existsSync(p)) return [];
  const lines = readFileSync(p, "utf8").split(/\r?\n/);
  const out = [];
  let lastComment = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { lastComment = null; continue; }
    if (line.startsWith("#")) { lastComment = line; continue; }
    if (!lastComment) {
      console.error(
        `placeholder-allowlist.txt: regex '${line}' has no preceding ` +
          `comment explaining why — rejecting.`
      );
      process.exit(2);
    }
    try {
      out.push(new RegExp(line, "i"));
    } catch (e) {
      console.error(`placeholder-allowlist.txt: bad regex '${line}': ${e.message}`);
      process.exit(2);
    }
    lastComment = null;
  }
  return out;
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) {
      if (IGNORED_DIRS.has(entry)) continue;
      yield* walk(full);
    } else if (st.isFile()) {
      yield full;
    }
  }
}

function isIgnoredFile(relPath) {
  // relPath uses forward slashes; IGNORED_FILES entries may use native sep from join().
  const asNative = sep !== "/" ? relPath.replace(/\//g, sep) : relPath;
  if (IGNORED_FILES.has(relPath) || IGNORED_FILES.has(asNative)) return true;
  for (const prefix of IGNORED_DIR_PREFIXES) {
    const normPrefix = prefix.replace(/\\/g, "/");
    if (relPath === normPrefix || relPath.startsWith(normPrefix + "/")) {
      return true;
    }
  }
  const lower = relPath.toLowerCase();
  for (const ext of IGNORED_EXTENSIONS) {
    if (lower.endsWith(ext)) return true;
  }
  return false;
}

function main() {
  const allowlist = loadAllowlist();
  const hits = [];
  for (const absPath of walk(REPO_ROOT)) {
    const rel = relative(REPO_ROOT, absPath).replace(/\\/g, "/");
    if (isIgnoredFile(rel)) continue;
    let content;
    try { content = readFileSync(absPath, "utf8"); } catch { continue; }
    // Skip binary-ish files.
    if (content.includes("\u0000")) continue;
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(PATTERN);
      if (!m) continue;
      const allowed = allowlist.some((re) => re.test(lines[i]));
      if (allowed) continue;
      hits.push(`${rel.split(sep).join("/")}:${i + 1}: ${m[0]} — ${lines[i].trim()}`);
    }
  }
  if (hits.length === 0) {
    console.log("PASS placeholder-scan: no forbidden strings found.");
    process.exit(0);
  }
  console.log(`FAIL placeholder-scan: ${hits.length} hit(s):`);
  for (const h of hits) console.log(`  ${h}`);
  process.exit(1);
}

main();
