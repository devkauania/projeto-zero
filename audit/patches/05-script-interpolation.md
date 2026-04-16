# Patch 05 — Script interpolation audit + audit-tarball conversion (ledger row 9)

**Closes:** ledger row 9 (Script interpolation)
**Severity:** Medium
**Files touched:** `scripts/audit-tarball.mjs`
**Commit:** (bundled with patch 03/04 in the Stage 5 hardening commit)

## Scope

Row 9 flagged "unvalidated strings to shells via `&&`" across
`scripts/*.mjs` and `.agents/**`. This patch documents the audit of
every `execSync` / `spawnSync` call with `shell: true` in `scripts/`,
and fixes the one real offender.

## Audit findings

```
scripts/audit-tarball.mjs:11  execSync("npm pack --silent")               [fixed string, low risk]
scripts/audit-tarball.mjs:20  execSync(`tar … "${tgz}"`)                  [TEMPLATE INTERPOLATION — real issue]
scripts/pack-sanity.mjs:39    spawnSync(cmd, args, {shell:true})          [args is array — safe]
scripts/preflight.mjs:29      spawnSync(cmd, args, {shell:true})          [args is array — safe]
scripts/verdict.mjs:17        spawnSync(cmd, args, {shell:true})          [args is array — safe]
scripts/session-gate.mjs:54   spawnSync("node", [file], {shell:true})     [args is array — safe]
scripts/session-gate.mjs:105  spawnSync("git", ["status","--porcelain"])  [args is array — safe]
scripts/session-gate.mjs:184  spawnSync("git", ["blame",…])               [args is array — safe]
scripts/session-gate.mjs:199  spawnSync("git", ["log",…])                 [args is array — safe]
```

When `spawnSync`/`spawn` receives `args` as an **array**, Node handles
quoting — even with `shell: true` — so user-provided or path-resolved
tokens cannot escape into a shell command. The `shell: true` flag is
required on Windows to invoke `.cmd` shims (`npm.cmd`, `git.cmd`) that
ship with the Node for Windows installer.

The one real issue is `audit-tarball.mjs:20` — a template literal
`\`tar … "${tgz}"\`` fed to `execSync`, which accepts a raw shell
command. While `tgz` is computed from a hardcoded path (low real
exposure), the shape is a footgun and drifts the codebase away from the
"argv-array only" discipline the swarm module enforces.

## Fix

`scripts/audit-tarball.mjs` converted:

- `execSync("npm pack ...")` → `spawnSync("npm", ["pack", "--silent"])`
- `execSync(\`tar … "${tgz}"\`)` → `spawnSync("tar", ["--force-local",
  "-xzf", tgz], {shell: false})`
- Hardcoded tarball version `projeto-zero-cli-1.0.0.tgz` replaced with
  `pkgJson.version` read from `apps/cli/package.json` so the script
  survives the v1.1.0 bump without another edit.

`run(cmd, args, opts)` helper consolidates the spawnSync pattern and
throws on non-zero exit.

## Regression tests

No automated regression — the script is a one-shot developer tool,
runs outside the gate harness, and its behavior is inspected manually.
The `shell: false` override on the `tar` call is asserted by static
reading (grep `shell: false` in the file).

## Acceptance

`node scripts/audit-tarball.mjs` produces the same file inventory and
version-string output as before the refactor. No functional regression
expected; the change is purely mechanical safety.

## Reviewer signoff

Patch applied. Row 9 marked CLOSED in `audit/vulnerability-ledger.md`
with audit table preserved above.
