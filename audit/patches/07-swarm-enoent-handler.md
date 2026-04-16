# Patch 07 — swarm --live ENOENT handler for missing `claude` binary

**Closes:** Phase 2b adversarial-sweep finding (post-ledger; no ledger
row — presentation and robustness, no security surface).
**Severity:** Low (not a security issue; a user who hasn't installed
Claude Code sees an unhandled-error hang instead of a friendly exit).
**Files touched:**
- `apps/cli/src/commands/swarm.ts` (live spawn loop)
- `apps/cli/src/__tests__/swarm-spawner.test.ts` (new ENOENT test)

## Scope

`swarm --live` calls `spawnClaudeAgent` per agent and awaits each
child's `'exit'` event. When the `claude` binary is not on `PATH`,
`child_process.spawn` emits an `'error'` event *without* firing
`'exit'`. Without an `'error'` listener:

1. Node's default EventEmitter behavior treats unhandled `'error'`
   as an uncaught exception — logged to stderr.
2. The per-agent `Promise` for `new Promise(resolve => proc.on('exit'))`
   never resolves.
3. `Promise.all(...)` hangs forever. The user sees a cryptic stderr
   line and a wedged process.

## Reproduction (pre-fix)

```
$ antigravity swarm --live --count 1
# on a machine without claude installed:
# → Unhandled error: spawn claude ENOENT
# → Process hangs (Promise.all never resolves)
```

## Fix

In `commands/swarm.ts`, each per-agent wait promise now listens for
whichever of `'exit'` or `'error'` fires first, with a `settled` flag
to prevent double-resolve:

```ts
const done = () => { if (settled) return; settled = true; resolve(); };
s.proc.on("exit", done);
s.proc.on("error", (err) => {
  const hint = /ENOENT/.test(err.message) && /claude/i.test(err.message)
    ? ` — is Claude Code installed and on PATH? (https://docs.claude.com/claude-code)`
    : "";
  console.error(`${tag} ${theme.warning(`spawn failed: ${err.message}${hint}`)}`);
  failures.push(`agent-${a.index}: ${err.message}`);
  done();
});
```

After `Promise.all` resolves, if `failures.length > 0`, swarm prints a
tally line and `process.exit(1)`. The tag-prefixed hint only references
the upstream docs URL (`https://docs.claude.com/claude-code`) — no
registry, brand, or version lock-in.

## Security surface

Unchanged. The spawn itself never happened, so every ledger-row-4
property (argv-array only, `shell: false`, env allowlist) is vacuously
satisfied. This patch is UX + robustness.

## Regression test

`swarm-spawner.test.ts` → "missing-binary behavior (ENOENT)" locks the
underlying invariant that Node's `spawn` emits `'error'` (not a sync
throw) when the binary cannot be located. The test spawns with
`bin = "/does/not/exist/pz-missing-bin"` (platform-adjusted) and
asserts the first event observed is `'error'` with an `ENOENT` message.
This is the property the swarm live-loop depends on — if a future Node
version changed it to a sync throw, the test would catch it and the
loop's outer try/catch in swarm.ts would take over.

## Acceptance

- `npx vitest run src/__tests__/swarm-spawner.test.ts` → 6/6 pass
- Full suite: 98 tests passing across 13 files (was 97/13)
- `node scripts/verdict.mjs` → PRODUCTION-READY
- Tarball size unchanged (~40 kB / 72 files)

## Reviewer signoff

Patch applied. No ledger row opens or closes — this is Phase 2b
robustness scope, recorded as patch 07 so the audit trail matches
the filesystem.
