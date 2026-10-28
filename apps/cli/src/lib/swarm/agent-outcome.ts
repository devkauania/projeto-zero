// agent-outcome.ts — decides whether a spawned `claude -p --output-format
// stream-json` agent actually succeeded.
//
// Before this module, the swarm launcher treated every child "exit" as a
// success: an agent that died at argument parsing (exit 1) still produced
// "Swarm ... complete" and exit code 0. Now an agent only counts as a
// success when ALL of these hold:
//   1. the process exited with code 0 and no signal,
//   2. every non-empty stdout line parsed as JSON (stream-json emits one
//      JSON object per line),
//   3. a final `{"type":"result", ...}` event was seen, and
//   4. that result has `subtype: "success"` and `is_error` not true.
// Anything else is a failure with a human-readable reason.

import type { ChildProcess } from "node:child_process";

export interface AgentOutcome {
  ok: boolean;
  /** Present when ok=false. */
  reason?: string;
}

interface ResultEvent {
  type: "result";
  subtype?: unknown;
  is_error?: unknown;
}

/**
 * Incremental line splitter + parser for stream-json stdout. Chunks may end
 * mid-line, so partial lines are buffered until the next newline or `end()`.
 */
export class StreamJsonMonitor {
  private buffer = "";
  private lineNo = 0;
  /** First parse failure, e.g. `line 3 is not JSON: "bad option"`. */
  parseError: string | undefined;
  /** Last `type: "result"` event seen, if any. */
  result: ResultEvent | undefined;

  /** Feed a stdout chunk. Returns the complete lines it contained. */
  push(chunk: string): string[] {
    this.buffer += chunk;
    const parts = this.buffer.split(/\r?\n/);
    this.buffer = parts.pop() ?? "";
    for (const line of parts) this.consume(line);
    return parts.filter((l) => l.length > 0);
  }

  /** Flush the trailing partial line (call once stdout has closed). */
  end(): string[] {
    const rest = this.buffer;
    this.buffer = "";
    if (rest.length === 0) return [];
    this.consume(rest);
    return [rest];
  }

  private consume(line: string): void {
    this.lineNo++;
    if (line.trim().length === 0) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      if (!this.parseError) {
        const shown = line.length > 120 ? `${line.slice(0, 120)}...` : line;
        this.parseError = `stdout line ${this.lineNo} is not stream-json: ${JSON.stringify(shown)}`;
      }
      return;
    }
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      (parsed as { type?: unknown }).type === "result"
    ) {
      this.result = parsed as ResultEvent;
    }
  }
}

/** Pure decision function. See the module header for the rules. */
export function evaluateAgentOutcome(
  code: number | null,
  signal: NodeJS.Signals | null,
  monitor: StreamJsonMonitor
): AgentOutcome {
  if (signal) return { ok: false, reason: `killed by signal ${signal}` };
  if (code !== 0) return { ok: false, reason: `exited with code ${code}` };
  if (monitor.parseError) return { ok: false, reason: monitor.parseError };
  const r = monitor.result;
  if (!r) {
    return { ok: false, reason: "no stream-json result event (output incomplete)" };
  }
  if (r.is_error === true || r.subtype !== "success") {
    return {
      ok: false,
      reason: `result event reports failure (subtype=${String(r.subtype)}, is_error=${String(r.is_error)})`,
    };
  }
  return { ok: true };
}

/**
 * Watch a spawned agent until its stdio closes. Each complete stdout line is
 * handed to `onStdoutLine` (for live display). Resolves with the outcome;
 * never rejects. A spawn "error" (e.g. ENOENT) is a failure.
 */
export function superviseAgent(
  proc: ChildProcess,
  onStdoutLine: (line: string) => void = () => {}
): Promise<AgentOutcome> {
  const monitor = new StreamJsonMonitor();
  return new Promise<AgentOutcome>((resolve) => {
    let settled = false;
    const finish = (o: AgentOutcome) => {
      if (settled) return;
      settled = true;
      resolve(o);
    };
    proc.stdout?.setEncoding("utf8");
    proc.stdout?.on("data", (chunk: string) => {
      for (const line of monitor.push(chunk)) onStdoutLine(line);
    });
    proc.on("error", (err: Error) => {
      finish({ ok: false, reason: `spawn failed: ${err.message}` });
    });
    // "close" (not "exit") fires after stdout is fully drained, so the final
    // result event is never missed.
    proc.on("close", (code: number | null, signal: NodeJS.Signals | null) => {
      for (const line of monitor.end()) onStdoutLine(line);
      finish(evaluateAgentOutcome(code, signal, monitor));
    });
  });
}
