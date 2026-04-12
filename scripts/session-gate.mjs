#!/usr/bin/env node
// session-gate.mjs — rule R15 enforcement. Runs all the preflight checks,
// then validates the session handoff on disk.

import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const ROADMAP = join(REPO_ROOT, ".agents", "PROJECT_ROADMAP.md");

function log(status, name, detail = "") {
  console.log(`${status} ${name}${detail ? " — " + detail : ""}`);
}

function detectSessionNumber() {
  if (process.env.SESSION_NUMBER) return Number(process.env.SESSION_NUMBER);
  if (!existsSync(ROADMAP)) return null;
  const content = readFileSync(ROADMAP, "utf8");
  // Find the highest "Sessão <N>" mentioned. Validation rows use <N>v so
  // strip any trailing letter.
  const nums = [...content.matchAll(/Sess(?:ão|ao)\s+(\d+)/g)].map((m) => Number(m[1]));
  if (nums.length === 0) return null;
  return Math.max(...nums);
}

function findHandoff(sessionN) {
  const dir = join(REPO_ROOT, ".agents");
  if (!existsSync(dir)) return null;
  // Allow both naming patterns: session-<N>-*.md or any *.md whose first
  // heading references the session. The roadmap-declared handoffs use
  // descriptive names (e.g. process-hardening.md), so a simple grep
  // over .agents/*.md for "Session <N>" is the pragmatic match.
  const candidates = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".md")) continue;
    const full = join(dir, f);
    const head = readFileSync(full, "utf8").slice(0, 400);
    const re = new RegExp(`Session\\s+${sessionN}\\b`, "i");
    if (re.test(head) || f === `session-${sessionN}.md` || f.startsWith(`session-${sessionN}-`)) {
      candidates.push(full);
    }
  }
  return candidates[0] || null;
}

function checkPreflight() {
  const res = spawnSync("node", [join(REPO_ROOT, "scripts", "preflight.mjs")], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    shell: true,
  });
  return { ok: res.status === 0, out: (res.stdout || "") + (res.stderr || "") };
}

function checkHandoff(sessionN) {
  const path = findHandoff(sessionN);
  if (!path) {
    log("FAIL", "handoff-exists", `no .agents/*.md references Session ${sessionN}`);
    return false;
  }
  log("PASS", "handoff-exists", path);
  const body = readFileSync(path, "utf8");

  const hasGrading = /##\s+(?:\d+\.?\s+)?Self-?Grading\s+Table/i.test(body);
  log(hasGrading ? "PASS" : "FAIL", "self-grading-table", hasGrading ? "present" : "missing ## Self-Grading Table");

  const hasGateTx = /##\s+(?:\d+\.?\s+)?Gate\s+Transcript/i.test(body);
  log(hasGateTx ? "PASS" : "FAIL", "gate-transcript", hasGateTx ? "present" : "missing ## Gate Transcript");

  // If the verdict section claims PRODUCTION-READY but any row isn't DONE,
  // that's an R10/R14 violation.
  const claimsReady = /PRODUCTION-READY/.test(body);
  let gradingConsistent = true;
  if (claimsReady && hasGrading) {
    const lines = body.split(/\r?\n/);
    for (const l of lines) {
      // Table row shape: | <bullet> | <status> | <evidence> |
      if (!/^\|/.test(l)) continue;
      const cells = l.split("|").map((c) => c.trim());
      if (cells.length < 4) continue;
      const status = (cells[2] || "").toUpperCase();
      if (!/^(DONE|PARTIAL|SKIPPED|BLOCKED|STATUS|-+)$/.test(status)) continue;
      if (status && status !== "DONE" && status !== "STATUS" && !/^-+$/.test(status)) {
        gradingConsistent = false;
        break;
      }
    }
  }
  log(
    gradingConsistent ? "PASS" : "FAIL",
    "grading-vs-verdict",
    gradingConsistent ? "ok" : "PRODUCTION-READY claimed but a row is not DONE"
  );

  const ok = hasGrading && hasGateTx && gradingConsistent;
  return ok;
}

function checkGitClean(sessionN) {
  const res = spawnSync("git", ["status", "--porcelain"], {
    cwd: REPO_ROOT, encoding: "utf8", shell: true,
  });
  if (res.status !== 0) {
    log("SKIP", "git-clean", "git not available or not a repo");
    return true;
  }
  const dirty = res.stdout.split(/\r?\n/).filter(Boolean);
  if (dirty.length === 0) {
    log("PASS", "git-clean", "working tree clean");
    return true;
  }
  // Allow handoff + roadmap dirty.
  const allowedRe = new RegExp(
    `^[ MARCU?]{1,2}\\s+(\\.agents/PROJECT_ROADMAP\\.md|\\.agents/.*session.*\\.md|\\.agents/process-hardening\\.md)$`,
    "i"
  );
  const unexpected = dirty.filter((l) => !allowedRe.test(l.replace(/\\/g, "/")));
  if (unexpected.length === 0) {
    log("PASS", "git-clean", `only handoff/roadmap dirty (${dirty.length} file(s))`);
    return true;
  }
  log("FAIL", "git-clean", `${unexpected.length} unexpected dirty file(s)`);
  for (const u of unexpected) console.log(`  ${u}`);
  return false;
}

function main() {
  const sessionN = detectSessionNumber();
  console.log(`session-gate: session = ${sessionN ?? "unknown"}`);

  const pre = checkPreflight();
  log(pre.ok ? "PASS" : "FAIL", "preflight", pre.ok ? "all checks green" : "preflight failed (see above)");
  if (!pre.ok) {
    // Echo the preflight output so the gate transcript contains the reason.
    console.log("--- preflight output ---");
    process.stdout.write(pre.out);
    console.log("--- end preflight output ---");
  }

  const handoffOk = sessionN != null ? checkHandoff(sessionN) : false;
  if (sessionN == null) log("FAIL", "session-detection", "could not infer session number");

  const gitOk = checkGitClean(sessionN);

  const ok = pre.ok && handoffOk && gitOk && sessionN != null;
  console.log(`\nsession-gate: ${ok ? "PASS" : "FAIL"}`);
  process.exit(ok ? 0 : 1);
}

main();
