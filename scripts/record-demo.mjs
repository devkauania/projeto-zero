#!/usr/bin/env node
// record-demo.mjs — record a real run of the CLI and render it to
// docs/demo.svg (plus docs/demo.txt, the same capture without colours).
//
//   npm run build && node scripts/record-demo.mjs
//
// Every line of output in the SVG comes from actually running this
// checkout's build (apps/cli/dist/index.js, which is what the package's
// `projeto-zero` bin points at) in a fresh temp directory with a throwaway
// config dir. Nothing is typed in by hand. Three edits are made to the
// capture, all stated here:
//   1. The absolute temp directory is replaced with `<tmp>` so the image
//      does not leak a local user path.
//   2. Each command is echoed as `$ projeto-zero ...` above its output, the
//      way a terminal prompt would show it.
//   3. Trailing blank lines at the end of each command's output are trimmed.
// The one step that is not a CLI call (writing a prompt file) is shown as a
// `#` comment line, not as a fake shell command.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderTerminalSvg, stripAnsi } from "./render-terminal-svg.mjs";

const REPO_ROOT = path.join(fileURLToPath(import.meta.url), "..", "..");
const CLI = path.join(REPO_ROOT, "apps", "cli", "dist", "index.js");
const OUT_SVG = path.join(REPO_ROOT, "docs", "demo.svg");
const OUT_TXT = path.join(REPO_ROOT, "docs", "demo.txt");

if (!fs.existsSync(CLI)) {
  console.error(`record-demo: ${CLI} not found. Run \`npm run build\` first.`);
  process.exit(1);
}

const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "pz-demo-")));
const work = path.join(tmp, "demo-app");
const cfg = path.join(tmp, "config");
fs.mkdirSync(work);
fs.mkdirSync(cfg);

const env = { ...process.env, ANTIGRAVITY_CONFIG_DIR: cfg, FORCE_COLOR: "1" };
delete env.NO_COLOR;

const PROMPT = "\x1b[32m$\x1b[39m ";
let transcript = "";

function cli(args, { input, shown } = {}) {
  const res = spawnSync(process.execPath, [CLI, ...args], {
    cwd: work,
    env,
    input: input ?? "",
    encoding: "utf8",
  });
  if (res.status !== 0) {
    console.error(res.stdout, res.stderr);
    throw new Error(`record-demo: \`${args.join(" ")}\` exited ${res.status}`);
  }
  transcript += PROMPT + (shown ?? `projeto-zero ${args.join(" ")}`) + "\n";
  transcript += trimEnd(res.stdout + res.stderr) + "\n\n";
}

// Trailing whitespace only; keeps colour resets that follow the last line.
function trimEnd(s) {
  return s.replace(/(?:\s|\x1b\[[0-9;?]*[A-Za-z])+$/, (tail) =>
    tail.replace(/\s+/g, "")
  );
}

function run(cmd, args, shown) {
  const res = spawnSync(cmd, args, { cwd: work, env, encoding: "utf8" });
  if (res.status !== 0) throw new Error(`record-demo: ${cmd} exited ${res.status}`);
  if (shown) {
    transcript += PROMPT + shown + "\n" + trimEnd(res.stdout) + "\n\n";
  }
}

try {
  run("git", ["init", "-q"]);

  cli(["--version"]);
  cli(["init"], {
    input: "demo-app\ncoder auditor\ny\n",
    shown: "printf 'demo-app\\ncoder auditor\\ny\\n' | projeto-zero init",
  });
  cli(["generate", "-d", "."]);
  run("git", ["status", "--short", "--untracked-files=all"], "git status --short --untracked-files=all");

  const promptFile = path.join(work, ".agents", "prompts", "add-tests.md");
  fs.writeFileSync(promptFile, "# Add tests\n\nWrite unit tests for the config loader.\n");
  transcript += "\x1b[2m# add one prompt for the swarm: .agents/prompts/add-tests.md\x1b[22m\n\n";

  cli(["swarm", "--count", "2", "--dry-run"]);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

// Hide the local temp path (native, forward-slash and JSON-escaped forms).
const forms = new Set([tmp, tmp.replace(/\\/g, "/"), JSON.stringify(tmp).slice(1, -1)]);
let clean = transcript.trimEnd() + "\n";
for (const f of forms) clean = clean.split(f).join("<tmp>");

fs.writeFileSync(OUT_TXT, stripAnsi(clean));
fs.writeFileSync(
  OUT_SVG,
  renderTerminalSvg(clean, { cols: 104, title: "projeto-zero: init, generate, swarm --dry-run" })
);
console.log(`record-demo: wrote ${path.relative(REPO_ROOT, OUT_SVG)} and ${path.relative(REPO_ROOT, OUT_TXT)}`);
