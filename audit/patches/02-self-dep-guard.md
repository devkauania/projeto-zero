# Patch 02 — Self-Dependency CI Guard

**Ledger ref:** vulnerability-ledger row 1  
**Severity:** High (upgraded from Low — see Stage 0 audit finding)  
**Stage:** 5 (v1.0.1 bugfixes bundled into v1.1.0)  
**Status:** Bug pre-existing in v1.0.0 published tarball; working-tree/HEAD already clean; CI guard added

---

## Summary

The published `@projeto-zero/cli@1.0.0` tarball contained a self-referential dependency entry in `package.json`:

```json
"dependencies": {
  "@projeto-zero/cli": "^1.0.0",
  ...
}
```

**How it got there:** During post-publish verification in the v1.0.0 session, the developer ran `npm install @projeto-zero/cli` inside the monorepo workspace, which wrote the resolved package back into `apps/cli/package.json` as a dependency entry. This was committed (or included in the pack) before the cycle was caught.

**Impact:** Downstream consumers `npm install`-ing `@projeto-zero/cli` could trigger recursive resolution. npm deduplications typically prevent an infinite loop, but the entry is structurally wrong and signals an unreliable release process.

---

## State at Start of Stage 5

- `git show HEAD:apps/cli/package.json` — no self-dep (HEAD is clean)
- Published npm tarball `@projeto-zero/cli@1.0.0` — self-dep present (historical; cannot be retroactively patched on npm without a new publish)
- Working tree — reverted before coding began (per Stage 0 § 0.3 decision)

The self-dep is therefore already absent from source. This patch adds the CI guard to prevent recurrence.

---

## Fix

**New file:** `scripts/check-no-self-dep.mjs`

Reads `apps/cli/package.json` at CI time and checks `dependencies`, `devDependencies`, `peerDependencies`, and `optionalDependencies` for an entry whose key equals `pkg.name`. Exits non-zero on any hit. Wired into `scripts/preflight.mjs`.

No source change to `apps/cli/package.json` required — it is already clean at HEAD.

---

## Regression Tests

### Static check (CI)
`scripts/check-no-self-dep.mjs` — validates `apps/cli/package.json` at every `preflight` run:

```
check-no-self-dep: PASS — "@projeto-zero/cli" is not self-referencing
```

### Manual verification
```
node scripts/check-no-self-dep.mjs
```

---

## Process Note

To prevent recurrence: never run `npm install <own-package-name>` inside the workspace during post-publish verification. Instead, use `npm pack --dry-run` and `npm ls` against a fresh install in a temp directory.

---

## Reviewer Signoff

| Role | Name | Date | Initials |
|---|---|---|---|
| Patch author | Claude (Stage 5) | 2026-04-16 | `ML` |
| Owner review | devkauania | `_____` | `_____` |
