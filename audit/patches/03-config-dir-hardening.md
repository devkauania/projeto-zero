# Patch 03 — Config dir symlink + scope hardening (ledger row 8)

**Closes:** ledger row 8 (Config dir symlink traversal)
**Severity:** Medium
**Files touched:** `apps/cli/src/lib/config.ts`, `apps/cli/src/__tests__/config.test.ts`
**Commit:** (included in the Stage 5 hardening commit; see `git log --grep='ledger row 8'`)

## Exploitation theory

`ANTIGRAVITY_CONFIG_DIR` is an env-var override that lets CI / tests point
the Conf store at an isolated directory. Without validation, a
mis-configured or malicious invocation could set the variable to:

1. A symlink pointing at a sensitive path (classic trick: symlink a new
   empty dir to `~/.ssh` so that `fs.writeFileSync(storePath, ...)` clobbers
   `authorized_keys`).
2. A directory outside the user's scope (e.g. `/etc/`, `C:\Program Files\`)
   where the CLI's write would either fail with a permissions error or
   succeed and corrupt shared state on a multi-tenant host.

The Conf library itself does not re-lstat or validate the cwd — it
trusts the caller.

## Fix

`validateConfigDir(override)` in `apps/cli/src/lib/config.ts`:

1. Rejects empty / absurdly-short overrides.
2. `path.resolve()` + `lstat()` to detect a symlink at the override path;
   throws if the path itself is a symlink (target-following happens later
   and inherits the check because `path.resolve` also resolves `..`).
3. Confines the resolved path to `path.resolve(os.homedir())` or
   `path.resolve(os.tmpdir())`. Any override outside both prefixes throws.
4. `ENOENT` is tolerated — Conf creates the dir on first write, and the
   above checks still apply to the resolved-but-nonexistent path.

`saveConfig` now also calls `hardenConfFile(store)` which `chmod 0600` on
POSIX (no-op on Windows — ACLs under `%APPDATA%` already restrict to the
profile owner). Best-effort: chmod failures are swallowed to avoid
breaking the CLI on FAT32/SMB filesystems.

## Regression tests

`apps/cli/src/__tests__/config.test.ts` — new `config dir hardening` block:

- `rejects ANTIGRAVITY_CONFIG_DIR outside $HOME or $TMPDIR`
- `rejects a symlink at the override path` (self-skips on Windows without
  `SeCreateSymbolicLinkPrivilege`)
- `rejects empty override string` — locks the "empty means no override"
  semantic so future refactors don't accidentally tighten it.

All three pass; full suite 92/92 green.

## Reviewer signoff

Patch applied and tests run. Row 8 marked CLOSED in
`audit/vulnerability-ledger.md`.
