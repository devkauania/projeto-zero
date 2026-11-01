// A stand-in for the `claude` binary, found the same way the real one is:
// first on PATH, spawned with shell:false. It records what it actually
// received (cwd, argv, stdin, env), then behaves as told. Tests assert on that
// record, not on the launcher's source text or on the plan it intended.
//
// On Windows the usual fake is the .cmd an npm install writes, which the launcher
// reads to find the script. A compiled .exe, needed only for the real-binary case,
// is a new unsigned program each time: antivirus can hold it for many seconds,
// and spawn then fails with UNKNOWN, which has nothing to do with the launcher.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export type FakeMode =
  | "ok"
  | "iserror"
  | "fail"
  | "noresult"
  | "notrail"
  | "noread"
  | "okthenerr"
  | "garbage"
  | "errorresult"
  | "signal";

export interface FakeCall {
  cwd: string;
  argv: string[];
  stdin: string;
  stdinClosed: boolean;
  env: Record<string, string>;
}

const FAKE_SCRIPT = String.raw`
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

let behavior = { default: "ok" };
try {
  behavior = JSON.parse(fs.readFileSync(path.join(__dirname, "behavior.json"), "utf8"));
} catch {}
const agent = path.basename(process.cwd());
const mode = behavior[agent] || behavior.default || "ok";

const OK = '{"type":"result","subtype":"success","is_error":false}';
const INIT = '{"type":"system","subtype":"init"}';

function record(stdin, stdinClosed) {
  const file = path.join(__dirname, "calls", process.pid + "-" + crypto.randomUUID() + ".json");
  fs.writeFileSync(file, JSON.stringify({
    cwd: process.cwd(),
    argv: process.argv.slice(2),
    stdin,
    stdinClosed,
    env: { ...process.env },
  }));
}

function respond() {
  const out = (s) => process.stdout.write(s);
  switch (mode) {
    case "iserror":
      out(INIT + "\n" + '{"type":"result","subtype":"success","is_error":true,"result":"Invalid API key"}' + "\n");
      break;
    case "fail":
      process.stderr.write("error: boom\n");
      process.exitCode = 1;
      break;
    case "noresult":
      out(INIT + "\n");
      break;
    case "notrail":
      out(INIT + "\n" + OK);
      break;
    case "okthenerr":
      out(OK + "\n" + '{"type":"result","subtype":"error_during_execution","is_error":true}' + "\n");
      break;
    case "garbage":
      out("this is not json\n" + OK + "\n");
      break;
    case "errorresult":
      out('{"type":"result","subtype":"error_max_turns","is_error":true}' + "\n");
      break;
    default:
      out(INIT + "\n" + OK + "\n");
  }
}

if (mode === "noread") {
  record("", false);
  respond();
} else {
  const chunks = [];
  let finished = false;
  const done = (closed) => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    record(Buffer.concat(chunks).toString("utf8"), closed);
    // A launcher that never closes stdin would hang real claude -p forever.
    // Record that and leave, so the failure is an assertion and not a hang.
    if (!closed) process.exit(3);
    respond();
  };
  const timer = setTimeout(() => done(false), 15000);
  process.stdin.on("data", (c) => chunks.push(c));
  process.stdin.on("end", () => done(true));
  process.stdin.on("error", () => done(false));
}
`;

const WINDOWS_SHIM = String.raw`
using System;
using System.Diagnostics;
using System.IO;

class Shim {
  static int Main() {
    string dir = AppDomain.CurrentDomain.BaseDirectory;
    string node = File.ReadAllText(Path.Combine(dir, "node-path.txt")).Trim();
    string script = Path.Combine(dir, "fake-claude.cjs");
    // Hand the raw command line over untouched, so argv quoting is exactly
    // what the launcher produced.
    string raw = Environment.CommandLine.TrimStart();
    int end = raw.StartsWith("\"") ? raw.IndexOf('"', 1) + 1 : raw.IndexOf(' ');
    string rest = end <= 0 || end >= raw.Length ? "" : raw.Substring(end);
    ProcessStartInfo psi = new ProcessStartInfo(node, "\"" + script + "\" " + rest);
    psi.UseShellExecute = false;
    using (Process p = Process.Start(psi)) {
      p.WaitForExit();
      return p.ExitCode;
    }
  }
}
`;

function shimPath(sandbox: string): string {
  return path.join(sandbox, "claude-shim.exe");
}

/** Build the Windows shim once. A no-op on POSIX. */
export function compileWindowsShim(sandbox: string): void {
  if (process.platform !== "win32") return;
  const windir = process.env.WINDIR ?? process.env.SystemRoot ?? "C:\\Windows";
  const csc = path.join(windir, "Microsoft.NET", "Framework64", "v4.0.30319", "csc.exe");
  const src = path.join(sandbox, "claude-shim.cs");
  fs.writeFileSync(src, WINDOWS_SHIM);
  const r = spawnSync(csc, ["/nologo", `/out:${shimPath(sandbox)}`, src], { encoding: "utf8" });
  if (r.status !== 0) {
    throw new Error(`could not compile the fake claude shim: ${r.error ?? ""} ${r.stdout} ${r.stderr}`);
  }
}

export class FakeClaude {
  /** `dir` holds the fake's state. `binDir` is what goes on PATH. */
  constructor(
    readonly dir: string,
    readonly binDir: string = dir
  ) {}

  /** Set how the fake behaves, as a default and per agent (`agent-1`). */
  behave(behavior: { default?: FakeMode } & Record<string, FakeMode | undefined>): void {
    fs.writeFileSync(path.join(this.dir, "behavior.json"), JSON.stringify(behavior));
  }

  /** Forget earlier calls and go back to the default behaviour. */
  reset(): void {
    const dir = path.join(this.dir, "calls");
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir);
    this.behave({ default: "ok" });
  }

  /** Every invocation so far, ordered by the agent directory it ran in. */
  calls(): FakeCall[] {
    const dir = path.join(this.dir, "calls");
    return fs
      .readdirSync(dir)
      .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as FakeCall)
      .sort((a, b) => a.cwd.localeCompare(b.cwd));
  }

  /** A parent env with this fake first on PATH. */
  env(extra: Record<string, string> = {}): Record<string, string> {
    const base: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) {
      if (typeof v === "string" && k.toUpperCase() !== "PATH") base[k] = v;
    }
    return {
      ...base,
      PATH: this.binDir + path.delimiter + (process.env.PATH ?? ""),
      ...extra,
    };
  }
}

/** Create a fake inside `parent`, which must exist. */
export function createFakeClaude(parent: string): FakeClaude {
  const dir = path.join(parent, "fake-bin");
  fs.mkdirSync(path.join(dir, "calls"), { recursive: true });
  fs.writeFileSync(path.join(dir, "fake-claude.cjs"), FAKE_SCRIPT);
  if (process.platform === "win32") {
    fs.writeFileSync(path.join(dir, "claude.cmd"), '@ECHO off\r\n"%~dp0\\fake-claude.cjs" %*\r\n');
  } else {
    const wrapper = path.join(dir, "claude");
    fs.writeFileSync(
      wrapper,
      `#!/bin/sh\nexec "${process.execPath}" "${path.join(dir, "fake-claude.cjs")}" "$@"\n`
    );
    fs.chmodSync(wrapper, 0o755);
  }
  return new FakeClaude(dir);
}

// The two shapes npm's cmd-shim writes for a global install on Windows. The
// first is what `npm install -g @anthropic-ai/claude-code` produces today.
const NPM_SHIM_EXE = String.raw`@ECHO off
GOTO start
:find_dp0
SET dp0=%~dp0
EXIT /b
:start
SETLOCAL
CALL :find_dp0
"%dp0%\node_modules\@anthropic-ai\claude-code\bin\claude.exe"   %*
`;
const NPM_SHIM_JS = String.raw`@ECHO off
GOTO start
:find_dp0
SET dp0=%~dp0
EXIT /b
:start
SETLOCAL
CALL :find_dp0

IF EXIST "%dp0%\node.exe" (
  SET "_prog=%dp0%\node.exe"
) ELSE (
  SET "_prog=node"
  SET PATHEXT=%PATHEXT:;.JS;=;%
)

endLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & "%_prog%"  "%dp0%\node_modules\@anthropic-ai\claude-code\cli.js" %*
`;

/** Until antivirus lets go of a program that was written a moment ago. */
function waitUntilRunnable(exe: string): void {
  const deadline = Date.now() + 90000;
  for (;;) {
    const r = spawnSync(exe, [], { input: "", cwd: path.dirname(exe), encoding: "utf8" });
    if (!r.error) return;
    if (Date.now() > deadline) throw new Error(`${exe} never became runnable: ${r.error}`);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }
}

/**
 * A Windows npm global install: a .cmd on PATH, the program under node_modules.
 * Windows only. With `shape` "exe" the target is a binary, with "js" a script.
 */
export function createFakeNpmClaude(parent: string, shape: "exe" | "js"): FakeClaude {
  const binDir = path.join(parent, "npm-global-" + shape);
  const rel = shape === "exe" ? ["bin"] : [];
  const dir = path.join(binDir, "node_modules", "@anthropic-ai", "claude-code", ...rel);
  fs.mkdirSync(path.join(dir, "calls"), { recursive: true });
  if (shape === "exe") {
    fs.writeFileSync(path.join(dir, "fake-claude.cjs"), FAKE_SCRIPT);
    fs.copyFileSync(shimPath(process.env.PZ_TEST_SANDBOX as string), path.join(dir, "claude.exe"));
    fs.writeFileSync(path.join(dir, "node-path.txt"), process.execPath);
    fs.writeFileSync(path.join(binDir, "claude.cmd"), NPM_SHIM_EXE);
    waitUntilRunnable(path.join(dir, "claude.exe"));
  } else {
    fs.writeFileSync(path.join(dir, "cli.js"), FAKE_SCRIPT);
    fs.writeFileSync(path.join(binDir, "claude.cmd"), NPM_SHIM_JS);
  }
  return new FakeClaude(dir, binDir);
}

export { NPM_SHIM_EXE, NPM_SHIM_JS };
