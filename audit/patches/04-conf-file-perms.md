# Patch 04 — Conf data file 0600 on POSIX (ledger row 11)

**Closes:** ledger row 11 (Conf file world-readable)
**Severity:** Low
**Files touched:** `apps/cli/src/lib/config.ts`
**Commit:** (bundled with patch 03 in the Stage 5 hardening commit)

## Exploitation theory

On POSIX the default umask on many dev machines is `022`, which makes
newly-created files mode `0644` — world-readable. The Conf store is
stored in this mode by default. If a user ever extends `WizardConfig`
to hold a token, API key, or anything sensitive (which is not the
current design, but defense-in-depth), every local user on the box
would be able to read it.

## Fix

`hardenConfFile(store)` in `apps/cli/src/lib/config.ts` calls
`fs.chmodSync(store.path, 0o600)` immediately after `saveConfig` writes.
Windows is skipped — `%APPDATA%` ACLs already restrict to the profile
owner, and POSIX file modes don't map cleanly there.

The call is best-effort: wrapped in try/catch and silent on failure.
Exotic filesystems (FAT32, SMB mounts, some CI scratch disks) return
EPERM on chmod; breaking the CLI over a permissioning failure is worse
than relaxed perms on a disk the user already implicitly trusts.

## Regression tests

No new test file — the behavior is observable only on POSIX systems and
only after `saveConfig`. The existing `config store round-trip` suite
exercises the save path; on POSIX CI runners the chmod runs but its
effect isn't asserted. Rationale: the cost of a cross-platform perms
assertion (careful `stat().mode & 0o777` check with Windows skips)
exceeds the risk reduction for a Low-severity defense-in-depth change.

Acceptable because:
- Row 11 is Low severity.
- The chmod is best-effort by design — a test that fails when chmod
  silently doesn't take effect would produce false negatives.
- Manual verification: `ANTIGRAVITY_CONFIG_DIR=/tmp/pz-perm-check \
  antigravity init ...; stat -c '%a' /tmp/pz-perm-check/.../config.json`
  returns `600` on Linux.

## Reviewer signoff

Patch applied. Row 11 marked CLOSED in
`audit/vulnerability-ledger.md`.
