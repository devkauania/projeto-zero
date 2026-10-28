# Stage 0 — Security Preflight Signoff (v1.1.0)

**Purpose:** Mechanical gate before any v1.1.0 coding begins. Each row requires user initials. Session-gate fails if any row is unchecked on HEAD.

**Plan reference:** private planning doc `fuzzy-conjuring-puppy.md` (not in repo) § Stage 0.

---

## 0.1 — Token Hygiene (user action required)

> **Status:** T1 and T2 are still unchecked: their revocation has not been
> confirmed with evidence in this repo. Only the maintainer can confirm it
> (`npm token list`) and tick the boxes with evidence; see "Pending owner
> actions" in [`docs/RELEASING.md`](../docs/RELEASING.md#pending-owner-actions).

| # | Action | Evidence | Initials |
|---|---|---|---|
| T1 | Revoke the first npm token leaked in chat on 2026-04-15 (prefix removed from this file) | Screenshot or `npm token list` showing token absent | `[ ]` |
| T2 | Revoke the second npm token leaked in chat on 2026-04-15 (prefix removed from this file) | Same | `[ ]` |
| T3 | Generate new Granular Access Token: scope `@projeto-zero/*`, packages-and-scopes, **Bypass 2FA = ON**, 90-day expiry | Token stored in OS keychain or `~/.npmrc` with 0600 perms; NEVER pasted in chat | `[ ]` |
| T4 | Enable 2FA `auth-and-writes` on npm account (npm web → Account → 2FA) | `npm profile get` returns `two-factor auth: auth-and-writes` | `[ ]` |
| T5 | Confirm new token works for publish via `npm whoami --registry=https://registry.npmjs.org/` | Prints `devkauania` | `[ ]` |

---

## 0.2 — Automated Supply-Chain Scans (completed 2026-04-16)

| # | Check | Result | Status |
|---|---|---|---|
| A1 | Working-tree secret scan: `npm_[A-Za-z0-9]{20,}` | No matches across `apps/`, `scripts/`, `.agents/`, `docs/` | ✅ CLEAN |
| A2 | Working-tree secret scan: `sk-ant-[A-Za-z0-9_-]{20,}` | No matches | ✅ CLEAN |
| A3 | Working-tree secret scan: `ANTHROPIC_API_KEY\s*=` | No matches | ✅ CLEAN |
| A4 | Working-tree secret scan: `Bearer\s+[A-Za-z0-9_\-\.]{20,}` | No matches | ✅ CLEAN |
| A5 | Full git-history scan (all branches, all commits): same four patterns | No matches | ✅ CLEAN |
| A6 | `npm audit signatures` | 73 packages registry-verified, 21 with attestations | ✅ ALL VERIFIED |
| A7 | `npm audit --production` | 0 vulnerabilities | ✅ CLEAN |
| A8 | Lockfile SHA-256 (root `package-lock.json`) | `2c86021e7c22bb15051183808d3e64c40900546930d767dbbafa156dd102fede` | ✅ RECORDED |
| A9 | `apps/cli/package-lock.json` existence | Does not exist; monorepo uses single root lockfile | ℹ️ NOTED |

---

## 0.3 — Working-Tree State Disclosure

At Stage 0 scan time, `git status --short` showed uncommitted changes:

```
 M apps/cli/package.json
 M package-lock.json
```

**Analysis:**
- `apps/cli/package.json` diff: adds `"@projeto-zero/cli": "^1.0.0"` to dependencies (the self-dep bug).
- `package-lock.json` diff: bumps `apps/cli` workspace version 0.1.0 → 1.0.0 and replaces the pre-publish file-based self-dep (`file:projeto-zero-cli-0.1.0.tgz`) with the npm version spec.
- **Root cause:** `npm install @projeto-zero/cli` was run during post-publish verification (previous session), which polluted the workspace `package.json` with a self-dep entry.
- **Git HEAD is clean** (`git show HEAD:apps/cli/package.json` has no self-dep).

**Decision for v1.1.0 coding:**
- [ ] User will `git checkout -- apps/cli/package.json package-lock.json` before Stage 1 begins, OR
- [ ] User will intentionally keep the working-tree self-dep so Stage 5 regression test can demonstrate the fix against the polluted state.

Record the decision with initials once chosen: `_______`

---

## 0.4 — Published Package Audit (v1.0.0 on npm)

Fetched `npm pack @projeto-zero/cli@1.0.0` and inspected the tarball.

| Finding | Evidence |
|---|---|
| Tarball SHA-1 | `3df2405316c3c42df76d2099d9ffd01b249f17c9` (matches prior record) |
| Self-dep SHIPPED in published tarball | `package/package.json` contains `"@projeto-zero/cli": "^1.0.0"` in `dependencies` |
| Severity assessment | **High** (upgraded from Low) — downstream consumers running `npm install @projeto-zero/cli` can trigger recursive resolution |
| Remediation | Stage 5 of v1.1.0 plan removes self-dep + adds `scripts/check-no-self-dep.mjs` CI guard |

Tarball extraction artifacts kept at `/tmp/pz-stage0-check/` for post-audit diffing; delete after Stage 5 regression test records its own golden tarball.

---

## 0.5 — Outstanding Follow-Ups for Stage 1 Kickoff

- [ ] Add `.gitleaks.toml` pre-commit config (deferred to Stage 4 Phase 1 if gitleaks not already installed)
- [ ] Decision on working-tree cleanup (see § 0.3)
- [ ] Confirm 2FA + Granular Token ready (see § 0.1)

---

## Signoff

Stage 0 is complete **only** when all rows in §§ 0.1 and 0.3 are checked and initialed by the user. Rows in §§ 0.2 and 0.4 are machine-recorded and do not require initials — they serve as the snapshot against which future drift is measured.

| Role | Name | Date | Initials |
|---|---|---|---|
| Author (machine scans) | Claude (session continuing v1.0.0 → v1.1.0) | 2026-04-16 | `ML` |
| Owner (token actions) | devkauania | `_____` | `_____` |
| Gate verifier | `scripts/session-gate.mjs` v1.1 (to be extended in Stage 1) | — | auto |

**Anti-gaming tripwire:** `scripts/session-gate.mjs` must be extended in Stage 1 to mechanically fail if this file's user-initial rows remain blank. The LLM cannot self-certify the user's initials — `git blame` on the initial cells must show a human commit, not an LLM-authored commit.
