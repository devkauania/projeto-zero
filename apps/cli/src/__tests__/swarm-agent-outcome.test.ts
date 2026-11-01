import { describe, it, expect } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import {
  StreamJsonMonitor,
  evaluateAgentOutcome,
  superviseAgent,
} from "../lib/swarm/agent-outcome.js";

// Regression: `swarm --live` used to report "Swarm ... complete" and exit 0
// even when every child `claude` died at argument parsing (exit 1) or
// printed non-JSON output. These tests lock in that only a clean exit with
// a successful stream-json `result` event counts as success.

const OK_RESULT = JSON.stringify({
  type: "result",
  subtype: "success",
  is_error: false,
  result: "done",
});

function monitorOf(...lines: string[]): StreamJsonMonitor {
  const m = new StreamJsonMonitor();
  m.push(lines.map((l) => l + "\n").join(""));
  m.end();
  return m;
}

describe("evaluateAgentOutcome", () => {
  it("non-zero exit is a failure even with a success result", () => {
    const o = evaluateAgentOutcome(1, null, monitorOf(OK_RESULT));
    expect(o.ok).toBe(false);
    expect(o.reason).toMatch(/code 1/);
  });

  it("a signal is a failure", () => {
    const o = evaluateAgentOutcome(null, "SIGTERM", monitorOf(OK_RESULT));
    expect(o.ok).toBe(false);
    expect(o.reason).toMatch(/SIGTERM/);
  });

  it("unparseable stdout is a failure", () => {
    const o = evaluateAgentOutcome(
      0,
      null,
      monitorOf("error: unknown option '--temperature'", OK_RESULT)
    );
    expect(o.ok).toBe(false);
    expect(o.reason).toMatch(/not stream-json/);
  });

  it("exit 0 without a result event is a failure", () => {
    const o = evaluateAgentOutcome(
      0,
      null,
      monitorOf(JSON.stringify({ type: "system", subtype: "init" }))
    );
    expect(o.ok).toBe(false);
    expect(o.reason).toMatch(/no stream-json result/);
  });

  it("a result with is_error or a non-success subtype is a failure", () => {
    const err = JSON.stringify({ type: "result", subtype: "error_max_turns", is_error: true });
    expect(evaluateAgentOutcome(0, null, monitorOf(err)).ok).toBe(false);
    const budget = JSON.stringify({ type: "result", subtype: "error_max_budget_usd" });
    expect(evaluateAgentOutcome(0, null, monitorOf(budget)).ok).toBe(false);
  });

  it("subtype success with is_error true is a failure", () => {
    // Claude Code reports some failures this way, an invalid API key among them.
    const err = JSON.stringify({ type: "result", subtype: "success", is_error: true, result: "Invalid API key" });
    const o = evaluateAgentOutcome(0, null, monitorOf(err));
    expect(o.ok).toBe(false);
    expect(o.reason).toMatch(/is_error=true/);
  });

  it("a later error result overrides an earlier success", () => {
    const err = JSON.stringify({ type: "result", subtype: "error_during_execution", is_error: true });
    const o = evaluateAgentOutcome(0, null, monitorOf(OK_RESULT, err));
    expect(o.ok).toBe(false);
    expect(o.reason).toMatch(/error_during_execution/);
  });

  it("a result without subtype is a failure", () => {
    const o = evaluateAgentOutcome(0, null, monitorOf(JSON.stringify({ type: "result", is_error: false })));
    expect(o.ok).toBe(false);
  });

  it("exit 0 + valid stream-json + success result is a success", () => {
    const o = evaluateAgentOutcome(
      0,
      null,
      monitorOf(JSON.stringify({ type: "system", subtype: "init" }), OK_RESULT)
    );
    expect(o).toEqual({ ok: true });
  });
});

describe("StreamJsonMonitor", () => {
  it("reassembles lines split across chunks (CRLF too)", () => {
    const m = new StreamJsonMonitor();
    const half = Math.floor(OK_RESULT.length / 2);
    expect(m.push(OK_RESULT.slice(0, half))).toEqual([]);
    expect(m.push(OK_RESULT.slice(half) + "\r\n")).toEqual([OK_RESULT]);
    expect(m.end()).toEqual([]);
    expect(m.parseError).toBeUndefined();
    expect(m.result?.subtype).toBe("success");
  });

  it("parses a trailing line without a newline on end()", () => {
    const m = new StreamJsonMonitor();
    m.push(OK_RESULT);
    expect(m.end()).toEqual([OK_RESULT]);
    expect(m.result).toBeDefined();
  });
});

describe("superviseAgent waits for the output, not for the exit", () => {
  it("counts a result that arrives after the process has exited", async () => {
    // A child's exit can overtake the last of its stdout, or a grandchild can
    // still hold the pipe. Node reports that as exit, then data, then close.
    const proc = new EventEmitter() as EventEmitter & { stdout: PassThrough };
    proc.stdout = new PassThrough();
    const outcome = superviseAgent(proc as unknown as ChildProcess);
    proc.emit("exit", 0, null);
    await new Promise((r) => setTimeout(r, 20));
    proc.stdout.write(OK_RESULT + "\n");
    await new Promise((r) => setTimeout(r, 20));
    proc.emit("close", 0, null);
    expect(await outcome).toEqual({ ok: true });
  });
});

describe("superviseAgent — real child processes", () => {
  function child(script: string) {
    return spawn(process.execPath, ["-e", script], {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
  }

  it("child that prints an error and exits 1 → failure", async () => {
    const proc = child(
      "console.error(\"error: unknown option '--temperature'\"); process.exit(1)"
    );
    const o = await superviseAgent(proc);
    expect(o.ok).toBe(false);
    expect(o.reason).toMatch(/code 1/);
  }, 15000);

  it("child that exits 0 with garbage stdout → failure", async () => {
    const proc = child("console.log('bad option: --permission-mode')");
    const o = await superviseAgent(proc);
    expect(o.ok).toBe(false);
    expect(o.reason).toMatch(/not stream-json/);
  }, 15000);

  it("child that streams a success result and exits 0 → success, lines forwarded", async () => {
    const proc = child(
      `console.log(${JSON.stringify(JSON.stringify({ type: "system", subtype: "init" }))});` +
        `console.log(${JSON.stringify(OK_RESULT)});`
    );
    const lines: string[] = [];
    const o = await superviseAgent(proc, (l) => lines.push(l));
    expect(o).toEqual({ ok: true });
    expect(lines.length).toBe(2);
  }, 15000);

  it("a result written with no trailing newline still counts, and is forwarded", async () => {
    const proc = child(`process.stdout.write(${JSON.stringify(OK_RESULT)})`);
    const lines: string[] = [];
    const o = await superviseAgent(proc, (l) => lines.push(l));
    expect(o).toEqual({ ok: true });
    expect(lines).toEqual([OK_RESULT]);
  }, 15000);

  it("a success followed by an error result → failure", async () => {
    const err = JSON.stringify({ type: "result", subtype: "error_during_execution", is_error: true });
    const proc = child(`console.log(${JSON.stringify(OK_RESULT)}); console.log(${JSON.stringify(err)});`);
    const o = await superviseAgent(proc);
    expect(o.ok).toBe(false);
  }, 15000);

  it("waits for stdout to drain: a result after a large stream is not missed", async () => {
    // The process exits while most of this is still in the pipe, so deciding on
    // "exit" instead of "close" reports that no result arrived.
    const filler = JSON.stringify({ type: "assistant", text: "x".repeat(1000) });
    const proc = child(
      `const line = ${JSON.stringify(filler + "\n")}.repeat(4000);` +
        `process.stdout.write(line + ${JSON.stringify(OK_RESULT + "\n")}, () => process.exit(0));`
    );
    const o = await superviseAgent(proc);
    expect(o).toEqual({ ok: true });
  }, 30000);

  it("a child that exits non-zero after a success result → failure", async () => {
    const proc = child(`console.log(${JSON.stringify(OK_RESULT)}); process.exitCode = 7;`);
    const o = await superviseAgent(proc);
    expect(o.ok).toBe(false);
    expect(o.reason).toMatch(/code 7/);
  }, 15000);

  it("missing binary → failure (spawn error), never hangs", async () => {
    const proc = spawn(
      process.platform === "win32"
        ? "C:\\does\\not\\exist\\pz-missing.exe"
        : "/does/not/exist/pz-missing",
      [],
      { shell: false, stdio: ["ignore", "pipe", "pipe"] }
    );
    const o = await superviseAgent(proc);
    expect(o.ok).toBe(false);
    expect(o.reason).toMatch(/ENOENT/);
  }, 15000);
});
