#!/usr/bin/env node
// check-no-multi-llm.mjs — CI guard for the v1.1.0 Claude-only lock.
//
// Stage 2 of the fuzzy-conjuring-puppy plan retargeted @projeto-zero/cli at
// Claude Code specifically: subagents live in .agents/, skills in skills/,
// CLAUDE.md is the project memory root. Shipping surface copy or agent labels
// that imply multi-LLM support (OpenAI, Gemini, generic "LLM") would be
// false advertising and undermine the Claude-native scaffold shape.
//
// This tripwire greps the repo for forbidden phrases and legacy agent
// identifiers (ClaudeCoder / AntigravityDesigner / AntigravityAuditor /
// MCPConfigurator) that Stage 2a renamed. Historical docs (CHANGELOG,
// migration notes, audit trail, handoffs) are excluded — the point is to
// keep live user-facing surfaces aligned with the Claude-only positioning,
// not to rewrite history.

import { readFileSync, statSync } from "node:fs";
import { join, dirname, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { readdirSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// Case-insensitive forbidden substrings. These signal drift away from the
// Claude-only lock. Keep the list tight — false positives erode trust in
// the guard.
const DENYLIST = [
  "multi-LLM",
  "multiple LLMs",
  "OpenAI",
  "Gemini",
  "ClaudeCoder",
  "AntigravityDesigner",
  "AntigravityAuditor",
  "MCPConfigurator",
];

// Paths (relative to repo root, using forward slashes) that are allowed to
// reference the legacy terms. Historical / migration / audit context stays
// honest — we only police the live product surface (apps/cli/** minus dist,
// root README, root docs).
//
// The repo's own planning history lives under .agents/ (session prompts,
// validations, roadmaps). That material documents how the codebase was
// built across multiple LLMs and legacy agent names — it is NOT shipped
// (apps/cli/package.json `files` = ["dist", "README.md"]). Excluding it
// keeps the guard targeted at the product surface users see.
const EXCLUDED_PREFIXES = [
  "CHANGELOG.md",
  "docs/MIGRATION",
  "audit/",
  ".agents/",
  ".claude/",
  "scripts/check-no-multi-llm.mjs", // this file, which lists the denylist
  "scripts/preflight.mjs", // references the guard by filename (check-no-multi-llm)
  "node_modules/",
  ".git/",
  "dist/",
  "apps/cli/dist/",
  ".turbo/",
];

// Explicit inclusion: scan apps/cli/src + apps/cli/README + apps/cli/package.json
// even under the apps/cli subtree, since those are live surfaces.
// (Handled naturally — no extra logic needed. Just documenting intent.)

// File types we scan. Binary formats and lockfiles are skipped entirely —
// they cannot meaningfully contain Claude-positioning copy.
const SCAN_EXTENSIONS = new Set([
  ".md",
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".yml",
  ".yaml",
  ".txt",
]);

function isExcluded(relPath) {
  const posix = relPath.split(sep).join("/");
  return EXCLUDED_PREFIXES.some((prefix) => posix.startsWith(prefix));
}

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    const rel = relative(ROOT, full);
    if (isExcluded(rel)) continue;
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (entry.isFile()) {
      const dot = entry.name.lastIndexOf(".");
      const ext = dot >= 0 ? entry.name.slice(dot) : "";
      if (SCAN_EXTENSIONS.has(ext)) out.push(full);
    }
  }
  return out;
}

const files = walk(ROOT);
const hits = [];

for (const file of files) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  const lower = text.toLowerCase();
  for (const term of DENYLIST) {
    const idx = lower.indexOf(term.toLowerCase());
    if (idx >= 0) {
      // Find the line number of the first match for a friendlier error.
      const before = text.slice(0, idx);
      const line = before.split(/\r?\n/).length;
      hits.push({ file: relative(ROOT, file), term, line });
    }
  }
}

if (hits.length > 0) {
  console.error("check-no-multi-llm: FAIL — forbidden terms found in live surface:");
  for (const h of hits) {
    console.error(`  ${h.file}:${h.line} — "${h.term}"`);
  }
  console.error(
    "\nThe v1.1.0 Claude-only lock forbids multi-LLM framing and legacy agent ids " +
    "on live surfaces. Historical docs (CHANGELOG, docs/MIGRATION*, audit/, " +
    ".agents/handoffs/) are excluded — move the reference there, or rename it."
  );
  process.exit(1);
}

console.log(
  `check-no-multi-llm: PASS — ${files.length} files scanned, no forbidden terms`
);
