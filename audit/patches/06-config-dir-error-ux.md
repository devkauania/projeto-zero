# Patch 06 — Friendly error UX for out-of-scope ANTIGRAVITY_CONFIG_DIR

**Closes:** Phase 2 E2E finding (post-ledger; no ledger row — this is a
UX side-effect of the row 8 hardening, not a new vulnerability).
**Severity:** Low (security behavior already correct; presentation only).
**Files touched:**
- `apps/cli/src/commands/info.ts`
- `apps/cli/src/commands/generate.ts`
- `apps/cli/src/commands/reset.ts`
- `apps/cli/src/__tests__/config-dir-errors.test.ts` (new)

## Scope

Ledger row 8 (`audit/patches/03-config-dir-hardening.md`) made
`validateConfigDir()` throw when `ANTIGRAVITY_CONFIG_DIR` points at a
path outside `$HOME` or `$TMPDIR`. The throw blocks the unsafe write
correctly, but three commands — `info`, `generate`, `reset` — called
`loadConfig()` without a try/catch. End-users saw a raw Node stack
trace instead of a one-line message.

`init` already handled this through its existing `try { saveConfig(...) }`
wrapper, so the defect was limited to the read-side commands.

## Reproduction (pre-fix)

```
$ ANTIGRAVITY_CONFIG_DIR="C:\ProgramData\bad" node dist/index.js info
file:///.../lib/config.js:61
        throw new Error(`ANTIGRAVITY_CONFIG_DIR: "${resolved}" is outside ...
              ^
Error: ANTIGRAVITY_CONFIG_DIR: "C:\ProgramData\bad" is outside the allowed scope...
    at validateConfigDir (file:///.../lib/config.js:61:15)
    at getStore (file:///.../lib/config.js:74:28)
    at loadConfig (file:///.../lib/config.js:106:12)
    at Command.<anonymous> (file:///.../commands/info.js:8:20)
    ...
Node.js v24.14.0
```

## Fix

Each of `info`, `generate`, `reset` now wraps the `loadConfig()` call
in a try/catch that mirrors the existing pattern in `init`:

```ts
let config;
try {
  config = loadConfig();
} catch (err) {
  console.error(theme.error(String(err instanceof Error ? err.message : err)));
  process.exit(1);
}
```

`generate` and `reset` route through the clack log surface (`p.log.error`
+ `p.outro`) so the error shows inside the intro/outro frame the user
already sees. `info` uses plain `console.error` — it never opens a
clack frame.

No library-level changes. `validateConfigDir` still throws exactly as
before; only the presentation changed.

## Post-fix behavior

```
$ ANTIGRAVITY_CONFIG_DIR="C:\ProgramData\bad" node dist/index.js info
ANTIGRAVITY_CONFIG_DIR: "C:\ProgramData\bad" is outside the allowed scope (home or tmp). Refusing to write the Conf store there.
# exit 1, no stack trace
```

## Regression test

`apps/cli/src/__tests__/config-dir-errors.test.ts` spawns the built
CLI with `ANTIGRAVITY_CONFIG_DIR` set to a path known to be outside
both `$HOME` and `$TMPDIR` (`Z:\pz-bad-scope` on Windows,
`/opt/pz-bad-scope` on POSIX) and asserts, for each of `info` and
`generate`:

1. Exit code is 1.
2. Combined stdout+stderr contains either `outside the allowed scope`
   or `ANTIGRAVITY_CONFIG_DIR`.
3. Combined output does NOT match a stack trace pattern
   (`\n\s+at\s+[^\n]+:\d+:\d+`).
4. Combined output does NOT match the `Error:\s...\n  at` crash form.

`reset` is TTY-gated and exits early under piped stdio, so its
loadConfig path is covered by the library-level tests in
`config.test.ts` plus the inline try/catch (defense in depth for
interactive users who type a bad env var).

## Acceptance

- `npx vitest run src/__tests__/config-dir-errors.test.ts` → 2/2 pass
- Full suite: 97 tests passing across 13 files (was 95/12)
- `node scripts/verdict.mjs` → PRODUCTION-READY at HEAD post-commit
- End-to-end tarball install + manual repro: friendly one-line error,
  exit 1, no stack frames

## Reviewer signoff

Patch applied. Row 8 remains CLOSED in the ledger; this patch is a
post-verification UX complement and recorded as patch 06 so the audit
trail matches the filesystem.
