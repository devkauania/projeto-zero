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
  const nums = [...content.matchAll(/Sess(?:ão|ao|ion)\s+(\d+)/g)].map((m) => Number(m[1]));
  if (nums.length === 0) return null;
  return Math.max(...nums);
}

function findHandoff(sessionN) {
  // Search both .agents/ and .agents/handoffs/ for session handoffs.
  const dirs = [
    join(REPO_ROOT, ".agents"),
    join(REPO_ROOT, ".agents", "handoffs"),
  ];
  const candidates = [];
  const re = new RegExp(`Session\\s+${sessionN}\\b`, "i");
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".md")) continue;
      const full = join(dir, f);
      const head = readFileSync(full, "utf8").slice(0, 400);
      if (re.test(head) || f === `session-${sessionN}.md` || f.startsWith(`session-${sessionN}-`)) {
        candidates.push(full);
      }
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
  // Allow handoff + roadmap + validation artifacts dirty. Handoffs live in
  // .agents/handoffs/, validations in .agents/validations/, and a few
  // session-named files live directly under .agents/.
  const allowedRe = new RegExp(
    `^[ MARCU?]{1,2}\\s+(\\.agents/PROJECT_ROADMAP\\.md|\\.agents/handoffs/.*\\.md|\\.agents/validations/.*\\.md|\\.agents/.*session.*\\.md)$`,
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

function checkVerificationArtifact() {
  const vpath = join(REPO_ROOT, "apps", "cli", "VERIFICATION.md");
  if (!existsSync(vpath)) {
    log("SKIP", "verification-artifact", "apps/cli/VERIFICATION.md not present (pre-Stage-1)");
    return true;
  }
  const body = readFileSync(vpath, "utf8");
  const lines = body.split(/\r?\n/);

  // Only scrutinize rows in the row table. The table header contains the
  // column sequence "Feels right? | Bug? | Notes"; we key off that.
  let inRowsTable = false;
  const issues = [];

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    // Detect the row-table header line.
    if (!inRowsTable) {
      if (/\|\s*Feels right\?\s*\|\s*Bug\?\s*\|\s*Notes\s*\|/.test(l)) {
        inRowsTable = true;
      }
      continue;
    }
    if (!/^\|/.test(l)) continue; // exited table

    // Skip the markdown divider row.
    if (/^\|[\s:|-]+\|?\s*$/.test(l)) continue;

    const cells = l.split("|").map((c) => c.trim());
    // cells: ["", #, Feature, Invocation, Expected, Source, FeelsRight, Bug, Notes, ""]
    if (cells.length < 10) continue;
    const lineNo = i + 1;
    const rowNum = cells[1];
    const feels = cells[6];
    const bug = cells[7];
    const notes = cells[8];

    // Rule 1: [!] in Bug column requires an issue or URL in Notes.
    if (/\[!\]/.test(bug)) {
      const hasIssue = /#\d+|https?:\/\//.test(notes);
      if (!hasIssue) {
        issues.push(`row ${rowNum} (line ${lineNo}): Bug=[!] but no #NNN or URL in Notes`);
      }
    }

    // Rule 2: [x] in Feels right? must have been introduced by a non-LLM
    // commit. Inspect the blame for this specific line.
    if (/\[x\]/i.test(feels)) {
      const blame = spawnSync(
        "git",
        ["blame", "-L", `${lineNo},${lineNo}`, "--porcelain", "apps/cli/VERIFICATION.md"],
        { cwd: REPO_ROOT, encoding: "utf8", shell: true }
      );
      if (blame.status !== 0) {
        issues.push(`row ${rowNum} (line ${lineNo}): git blame failed — cannot verify authorship`);
        continue;
      }
      const sha = (blame.stdout.split(/\s+/)[0] || "").trim();
      if (!sha || /^0+$/.test(sha)) {
        // Uncommitted working-tree change — the user hasn't committed the
        // flip yet. Gate must fail; otherwise an in-session LLM could flip
        // boxes and claim victory without a paper trail.
        issues.push(`row ${rowNum} (line ${lineNo}): Feels right=[x] in uncommitted working tree`);
        continue;
      }
      const msg = spawnSync("git", ["log", "-1", "--format=%B", sha], {
        cwd: REPO_ROOT, encoding: "utf8", shell: true,
      });
      if (msg.status !== 0) continue;
      if (/Co-Authored-By:\s*Claude/i.test(msg.stdout)) {
        issues.push(
          `row ${rowNum} (line ${lineNo}): Feels right=[x] was introduced by LLM-co-authored commit ${sha.slice(0, 7)} — ` +
          `anti-gaming tripwire. Only the human operator may flip this box.`
        );
      }
    }
  }

  if (issues.length > 0) {
    log("FAIL", "verification-artifact", `${issues.length} issue(s) in apps/cli/VERIFICATION.md`);
    for (const it of issues) console.log(`  ${it}`);
    return false;
  }
  log("PASS", "verification-artifact", "no unresolved [!] without issue link; no LLM-authored [x] flips");
  return true;
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
  const verOk = checkVerificationArtifact();

  const ok = pre.ok && handoffOk && gitOk && verOk && sessionN != null;
  console.log(`\nsession-gate: ${ok ? "PASS" : "FAIL"}`);
  process.exit(ok ? 0 : 1);
}

main();
