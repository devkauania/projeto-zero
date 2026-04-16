# Patch 01 — Non-TTY Connector Default-ALL Bug

**Ledger ref:** vulnerability-ledger row 2  
**Severity:** High  
**Stage:** 5 (v1.0.1 bugfixes bundled into v1.1.0)  
**Status:** Fixed

---

## Summary

When `antigravity init` was invoked with piped (non-TTY) stdin — e.g., in CI as `echo "" | antigravity init --yes` — every MCP connector in the seed config was written to `.mcp/` regardless of whether the user selected the `mcp` agent. This is because the non-TTY code path passed `undefined` as the `selectedConnectors` argument to `buildWizardConfig`, and `filterConnectors(all, undefined)` returns the full connector map unchanged.

The TTY path correctly derives a concrete `string[]` from the interactive prompt:
```ts
const selectedConnectors = answers.agents.includes("mcp")
  ? (answers.connectors as string[])
  : [];
```

The non-TTY path had an asymmetric ternary:
```ts
nonTtyAnswers.agents.includes("mcp") ? [] : undefined   // BUG
```

---

## Root Cause

`filterConnectors` treats `undefined` as "no filter requested — return everything". This is intentional for callers that genuinely want all connectors, but the non-TTY init path never prompts for connector selection and should always default to empty.

---

## Fix

**File:** `apps/cli/src/commands/init.ts`  
**Line:** ~183 (before fix), now line ~183 (comment updated)

```diff
-       nonTtyAnswers.agents.includes("mcp") ? [] : undefined
+       [] // non-TTY never prompts for connectors; always empty regardless of agent selection
```

Both TTY and non-TTY paths now pass a concrete `string[]` to `buildWizardConfig`. The comment makes the intent explicit.

---

## Regression Tests

### Unit (vitest)
`apps/cli/src/___tests__/init-helpers.test.ts` — "filterConnectors — non-TTY regression" block:

- `filterConnectors(connectors, undefined)` returns full map (documents the dangerous path — must never reach `buildWizardConfig` from non-TTY)
- `filterConnectors(connectors, [])` returns `{}` (the correct non-TTY outcome)

### Static tripwire (CI)
`scripts/check-non-tty-connectors.mjs` — greps `apps/cli/src/commands/init.ts` for the exact ternary-with-`undefined` pattern. Exits non-zero if reintroduced. Wired into `scripts/preflight.mjs`.

---

## Verification Steps

1. `npm run test` — all vitest suites pass (including new regression block)
2. `node scripts/check-non-tty-connectors.mjs` → `check-non-tty-connectors: PASS`
3. Manual smoke: `printf "my-proj\ncoder\ny\n" | node apps/cli/dist/index.js init` → `.mcp/` directory must be absent or empty after run
4. `node scripts/preflight.mjs` → all checks including `check-non-tty-connectors` pass

---

## Reviewer Signoff

| Role | Name | Date | Initials |
|---|---|---|---|
| Patch author | Claude (Stage 5) | 2026-04-16 | `ML` |
| Owner review | devkauania | `_____` | `_____` |
