# Pre-Publish Audit — @projeto-zero/cli v1.0.0

**Auditor:** @PrePublishAuditor (executed in-chat, Claude Sonnet 4.6)
**Session:** Pre-Publish Audit (precursor to Session 17 / Milestone C)
**Date:** 2026-04-15
**Policy:** `single-family` per `.agents/vendor-policy.json` (Adversarial Checklist MANDATORY)
**Commit audited (HEAD):** `3dedbb8fc88d0a2ba118a39661ae918896918a8b`
**Tagged release audited (v1.0.0):** `10a7e7790e5c1005eaa86994685a15087e2b38ad`
**Audit-prompt commit:** `3dedbb8` (HEAD = tag + 1 commit; delta is the audit prompt itself, not shipped in tarball — see §0)

---

## 0. Environment sanity

Six commands from the prompt, literal output:

```
=== git rev-parse --abbrev-ref HEAD ===
master

=== git log --oneline -6 ===
3dedbb8 docs: add pre-publish audit prompt for independent v1.0.0 verification
10a7e77 fix: pre-publish audit remediation for v1.0.0
71a498c release: default scoped publishes to public access
e4facb1 release: v1.0.0 — first public npm release
5950e61 governance: introduce single-family vendor policy + Milestone B GO
d416fc8 docs: add Session 16 final audit deliverable

=== git tag --list v1.0.0 -n1 ===
v1.0.0          v1.0.0 — first public npm release of @projeto-zero/cli

=== git status --short ===
(empty — clean tree at audit start)

=== node --version ===
v24.14.0

=== npm --version ===
11.9.0
```

**Tag-vs-HEAD delta** (extra verification beyond §0 checklist):

```
=== git rev-parse HEAD ===
3dedbb8fc88d0a2ba118a39661ae918896918a8b

=== git rev-parse v1.0.0^{commit} ===
10a7e7790e5c1005eaa86994685a15087e2b38ad

=== git merge-base --is-ancestor v1.0.0 HEAD; echo $? ===
exit=0  (v1.0.0 IS an ancestor of HEAD)

=== git log v1.0.0..HEAD --stat ===
commit 3dedbb8fc88d0a2ba118a39661ae918896918a8b
    docs: add pre-publish audit prompt for independent v1.0.0 verification
 .agents/prompts/sessions/pre-publish-audit-prompt.md | 394 +++++++++++++++++++++
 1 file changed, 394 insertions(+)
```

The only file added between tag and HEAD is the audit-prompt markdown under `.agents/`, which is excluded from the published tarball (`files: ["dist", "README.md"]` in `apps/cli/package.json`). Tarball-level audit at HEAD is therefore equivalent to the same audit run at v1.0.0. Proceeding.

**End-of-audit state** (note: B1 mutated `package-lock.json`):
```
$ git status --short
 M package-lock.json
$ git diff --stat package-lock.json
 package-lock.json | 22 +---------------------
 1 file changed, 1 insertion(+), 21 deletions(-)
```
This is audit-induced by B1's mandated `rm -rf node_modules && npm install`. Revert: `git checkout -- package-lock.json`. Not a publish blocker; recorded transparently in §8 and §10.

---

## 1. Required-reading summaries (proof of reading)

1. **`.agents/vendor-policy.json`** — declares `policy: "single-family"` with `implementationFamily: "claude"`, `reviewFamily: "claude"`, `adversarialChecklistMandatory: true`, decided 2026-04-14. Spec says cross-family is the backwards-compatible default when the file is absent.
2. **`.agents/prompts/_production-contract.txt`** — R1–R17 contract. R9 execute-never-confirm. R10 self-grading table. R11 no self-review (policy-aware: single-family → same-family validator + mandatory Adversarial Checklist). R12 ask-don't-placeholder (blockers must live in `.agents/handoffs/`). R13 acceptance-test-first. R14 mechanical verdicts (PRODUCTION-READY/NOT-READY only from `verdict.mjs`). R15 gate-before-handoff. R16 look-for-friends (verify required files are present, not only absence of forbidden ones). R17 strict alternation + no-skip (policy-aware in R17(c)).
3. **`.agents/antigravity-taxonomy.md`** — §0 vendor policy (single-family effective 2026-04-14, inactivates Gemini rows), §1 tier taxonomy (Haiku/Sonnet/Opus + Gemini tiers), §3 milestone routing (Milestone C → Claude Opus under single-family), §4 R11 Compliance Matrix + the 5 mandatory Adversarial Checklist items (Evidence Literality / File Existence / Anti-"technically compiles" / Per-Platform Output / Spec-by-Spec Diff).
4. **`.agents/PROJECT_ROADMAP.md`** — Sessions 1–16 and Milestones A/A2/B all `[x]` complete. Milestone B returned **GO** post-MF-1 remediation. Sessions 17 (Publisher, Haiku-tier) and Milestone C (FinalMilestoneReviewer, Opus-tier under single-family) both still `[ ]`. Session 17 is gated on Milestone B = GO, which is satisfied.
5. **`apps/cli/README.md`** — install via `npm install -g @projeto-zero/cli` or `npx`, 4 commands documented (init / generate / info / reset) with one-line descriptions each, `ANTIGRAVITY_CONFIG_DIR` documented with a concrete `tmp/mock-cli-tests` example, example trace included (has a minor inaccuracy — see D1), three troubleshooting entries addressing real problems (missing config, directory perms, state mismatch across projects).
6. **`CHANGELOG.md`** — `## [1.0.0] — 2026-04-14` header present (line 5). 1.0.0 adds: first public npm release, vendor-policy.json, policy-aware R11/R12/R17(c), Milestone C route change, Adversarial Checklist promotion to primary defense, Session 17 blockers relocation. Validated: Sessions 15 + 16 via Milestone B, 48/48 tests, preflight ALL PASS, cross-platform E2E. `## [0.1.0] — 2026-04-12` header also present.
7. **`apps/cli/package.json`** — name `@projeto-zero/cli`, version `1.0.0`, `type: module`, `main: ./dist/index.js`, `types: ./dist/index.d.ts`, `bin.antigravity: ./dist/index.js`, `files: ["dist", "README.md"]` (LICENSE auto-included by npm), license MIT, engines `node >= 20`, `publishConfig.access: public`, `repository.url: https://github.com/devkauania/projeto-zero.git`, `prepublishOnly: build + test`. 5 runtime deps (@clack/prompts, commander, conf, figlet, picocolors), 4 devDeps.
8. **`.agents/handoffs/session-17-blockers.md`** — 140-line halt record from 2026-04-14 documenting three blockers (R17 no-skip violation / missing `milestone-b-validation.md` / tier mismatch Opus-vs-Haiku). **Status today: STALE** — all three blockers have since been resolved: Milestone B has run (GO, per CHANGELOG and roadmap), `milestone-b-validation.md` exists (34621 bytes), and Session 17 has not yet run (so tier mismatch is a forward concern, not a current violation). The file is correctly located at `.agents/handoffs/` (not at `.agents/` root, satisfying the R12 placeholder-scan exemption). Relevant to this audit because the R15 gate reads this file as if it were Session 17's handoff — see §8.

---

## 2. Acceptance matrix

All 24 rows DONE with literal evidence. Two rows flagged: A7 (reachability probe declined by operator — not a blocker) and C4 (historic report is against v0.1.0 tarball; per-platform literality satisfied regardless).

| Axis | Criterion | Status | Evidence |
|------|-----------|--------|----------|
| A1 | Tarball contents enumerated | **DONE** | §3.A1 — 48 files listed with sizes via `node scripts/audit-tarball.mjs` |
| A2 | LICENSE shipped | **DONE** | §3.A2 — `1069 LICENSE` present in tarball file list |
| A3 | No secrets in shipped files | **DONE** | §3.A3 — audit-tarball suspicious-scan: `(no hits)` |
| A4 | bin.antigravity in published package.json | **DONE** | §3.A4 — extracted tarball's `package.json`: `"bin": { "antigravity": "./dist/index.js" }` |
| A5 | Shebang on dist/index.js | **DONE** | §3.A5 — `head -1`: `#!/usr/bin/env node` |
| A6 | publishConfig.access=public | **DONE** | §3.A6 — extracted tarball's `package.json`: `"publishConfig": { "access": "public" }` |
| A7 | Repository URL resolves | **DONE (partial)** | §3.A7 — URL pasted. Network probe declined by operator. Not a publish blocker; npm does not validate this field. |
| B1 | Clean npm install works | **DONE** | §4.B1 — `added 76 packages, and audited 78 packages in 2s … found 0 vulnerabilities` |
| B2 | Preflight ALL PASS | **DONE** | §4.B2 — `preflight: ALL PASS` (7/7 checks green) |
| B3 | 48/48 tests pass | **DONE** | §4.B3 — `Test Files 8 passed (8) / Tests 48 passed (48)` |
| B4 | --version matches package.json | **DONE** | §4.B4 — 4-location consistency proved, SSOT via `dist/lib/version.js` |
| B5 | --help lists 4 commands | **DONE** | §4.B5 — `init / generate [options] / info / reset` |
| B6 | info (empty) is friendly | **DONE** | §4.B6 — `No setup configuration found. Run init first.` exit=0 |
| B7 | info → generate → reset round-trip | **DONE** | §4.B7 — seed → info(populated) → generate(5 artifacts) → clear → info(empty) |
| C1 | Version consistency across 4 locations | **DONE** | §5.C1 — package.json / version.js / banner.js / CHANGELOG / --version all = 1.0.0 |
| C2 | Spec-by-spec requirement map | **DONE** | §5.C2 — all 4 `project-specs.md` requirements mapped to code + test paths |
| C3 | Adversarial checklist | **DONE** | §7 — all 5 items PASS |
| C4 | Cross-platform report has per-platform output | **DONE (with caveat)** | §5.C4 — Win PS + cmd.exe + Linux Docker each have literal 7-step output. Report tarball is v0.1.0 / 43 files, not v1.0.0 / 48 files — see §10 follow-up #1. Prompt C4 only requires per-platform literality. |
| C5 | Governance alignment | **DONE** | §5.C5 — vendor-policy.json present + single-family + adversarial mandatory; R11/R17(c) have policy-aware branches; session-17-blockers.md correctly placed in handoffs/ |
| D1 | README audit | **DONE (with finding)** | §6.D1 — install/command clarity OK, env var documented. Minor: example trace says "Created 2 artifacts" but real output emits 5. Follow-up #2. |
| D2 | Error path exercised | **DONE** | §6.D2 — `generate` with no config: friendly "No configuration found" box, exit=0 |
| D3 | SIGINT exits 0 | **DONE** | §6.D3 — 3 tests in `error-paths.test.ts` lines 145/155/167, all green via `spawn()` against real `dist/index.js` |
| D4 | Typo scan | **DONE** | §6.D4 — grep on common English typo patterns: zero hits in README/CHANGELOG/dist strings |
| D5 | Banner renders + colors apply | **DONE** | §6.D5 — figlet ASCII rendered + `Interactive CLI Setup Wizard v1.0.0` + ANSI cyan `[36m…[39m` wrap proves SSOT refactor works at runtime |

---

## 3. Safety findings (Axis A)

### A1 — tarball contents (48 files)

`node scripts/audit-tarball.mjs` output:

```
=== ALL 48 FILES IN TARBALL ===
    122 dist/commands/generate.d.ts
    194 dist/commands/generate.d.ts.map
   1966 dist/commands/generate.js
   2128 dist/commands/generate.js.map
    114 dist/commands/info.d.ts
    186 dist/commands/info.d.ts.map
   2030 dist/commands/info.js
   2692 dist/commands/info.js.map
   1352 dist/commands/init.d.ts
    684 dist/commands/init.d.ts.map
   9380 dist/commands/init.js
   7028 dist/commands/init.js.map
    116 dist/commands/reset.d.ts
    188 dist/commands/reset.d.ts.map
   1480 dist/commands/reset.js
   1720 dist/commands/reset.js.map
   1775 dist/default-wizard-config.json
     66 dist/index.d.ts
    104 dist/index.d.ts.map
    650 dist/index.js
    688 dist/index.js.map
     89 dist/lib/banner.d.ts
    160 dist/lib/banner.d.ts.map
    364 dist/lib/banner.js
    494 dist/lib/banner.js.map
    837 dist/lib/config.d.ts
    787 dist/lib/config.d.ts.map
   1242 dist/lib/config.js
   1159 dist/lib/config.js.map
   1837 dist/lib/fs-utils.d.ts
    752 dist/lib/fs-utils.d.ts.map
   3361 dist/lib/fs-utils.js
   2583 dist/lib/fs-utils.js.map
    190 dist/lib/scaffolder.d.ts
    264 dist/lib/scaffolder.d.ts.map
   3636 dist/lib/scaffolder.js
   2477 dist/lib/scaffolder.js.map
    739 dist/lib/theme.d.ts
    223 dist/lib/theme.d.ts.map
    600 dist/lib/theme.js
    409 dist/lib/theme.js.map
     75 dist/lib/version.d.ts
    151 dist/lib/version.d.ts.map
    781 dist/lib/version.js
    553 dist/lib/version.js.map
   1069 LICENSE
   1276 package.json
   3786 README.md
```

Prompt said "43+ files". Actual: 48. ✓ The 5-file delta vs the historic 0.1.0 tarball (see C4) is: `LICENSE` (new) + 4 files from `dist/lib/version.*` (SSOT refactor).

R16 (look-for-friends) spot-check: `dist/index.js` present (entry point), `dist/commands/{init,generate,info,reset}.js` all present (4 commands), `dist/lib/version.js` present (SSOT), `LICENSE` present, `README.md` present, `package.json` present. ✓

### A2 — LICENSE shipped

Literal from A1 file list: `1069 LICENSE`. Even though `files` in package.json is only `["dist", "README.md"]`, npm auto-includes `LICENSE` (standard behavior). Confirmed in actual tarball. ✓

### A3 — no secrets in shipped files

`audit-tarball.mjs` suspicious-content scan looks for: `TODO`, `FIXME`, `XXX`, `example.com`, `localhost:`, `api_key`, `apikey`, `secret:`, `password:`, `Bearer `, `sk-ant-`, `ghp_`, `ghs_`, `npm_`. Output:

```
=== SUSPICIOUS CONTENT SCAN ===
(no hits)
```

✓

### A4 — `bin.antigravity` survives the publish

The `npm publish --dry-run` warning `"bin[antigravity]" script name … was invalid and removed` is historically known to be a cosmetic false alarm. Extracted tarball's `package/package.json` proves the bin entry survives:

```json
"bin": {
  "antigravity": "./dist/index.js"
}
```

`audit-tarball.mjs` also verified by shebang-check: `=== bin.antigravity -> ./dist/index.js shebang: "#!/usr/bin/env node"`. ✓

### A5 — shebang on `dist/index.js`

```
$ head -1 apps/cli/dist/index.js
#!/usr/bin/env node
```

✓ `npx @projeto-zero/cli` and global-install `antigravity` will both resolve to node correctly.

### A6 — `publishConfig.access=public`

From extracted tarball's `package/package.json`:

```json
"publishConfig": {
  "access": "public"
}
```

✓ Required because the `@projeto-zero` org is free-tier (no private-scoped packages).

### A7 — repository URL

`repository.url` = `https://github.com/devkauania/projeto-zero.git`.

Network reachability probe (`curl -sS -o /dev/null -w ...`) was declined by operator during the audit. `npm publish` does not validate this field, so reachability failure would not block the publish. The URL is syntactically well-formed (matches `repo-metadata-check.mjs` regex per B2 preflight PASS). **Marked DONE (partial)**; if the operator wants a literal reachability probe before publish, that can be added in Milestone C.

---

## 4. Stability findings (Axis B)

### B1 — clean `npm install`

```
$ rm -rf node_modules apps/cli/node_modules
$ ls node_modules apps/cli/node_modules 2>&1 | head -5
ls: cannot access 'node_modules': No such file or directory
ls: cannot access 'apps/cli/node_modules': No such file or directory
(expected: both absent — confirmed)

$ npm install  (last lines)
added 76 packages, and audited 78 packages in 2s
26 packages are looking for funding
  run `npm fund` for details
found 0 vulnerabilities
```

✓ Clean install works, zero vulnerabilities.

**Side effect:** `npm install` normalized `package-lock.json` (−21/+1 lines). This makes the working tree dirty for the rest of the audit and is captured by the R15 gate (see §8). The mutation is audit-induced and non-substantive; revert with `git checkout -- package-lock.json` if desired.

### B2 — `npm run preflight`

```
=== preflight summary ===
check                status   ms
----------------------------------------
build                PASS     2051
lint                 PASS     914
test                 PASS     891
files-exist          PASS     143
pack-sanity          PASS     1037
repo-metadata        PASS     135
placeholder-scan     PASS     153

preflight: ALL PASS
```

All 7 checks green. ✓

### B3 — `npm test` (48/48)

From `cd apps/cli && npm test`:

```
 RUN  v4.1.3 C:/Users/Administrador/Documents/GitHub/Projeto-Zero/apps/cli

 Test Files  8 passed (8)
      Tests  48 passed (48)
   Start at  16:49:18
   Duration  3.68s
```

8 test files, 48 tests, zero failures. ✓ Per-file breakdown (from preflight run):
- fs-utils.test.ts: 11 tests
- init-helpers.test.ts: 7 tests
- info-command.test.ts: 3 tests
- config.test.ts: 7 tests
- scaffolder.test.ts: 7 tests
- reset-command.test.ts: 3 tests
- generate-command.test.ts: 3 tests
- error-paths.test.ts: 7 tests

Total: 48. ✓

### B4 — `--version` vs `package.json` version

```
$ node apps/cli/dist/index.js --version
1.0.0

$ grep -n '"version"' apps/cli/package.json
3:  "version": "1.0.0",
```

Both = `1.0.0`. ✓ **No drift possible at runtime**: `dist/lib/version.js` reads `../../package.json` at module-load time (SSOT):

```js
// dist/lib/version.js
const here = dirname(fileURLToPath(import.meta.url));
const pkgPath = join(here, "..", "..", "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
export const VERSION = pkg.version;
```

`dist/lib/banner.js` line 3 imports `VERSION` from `version.js` and renders `v${VERSION}` → banner output `v1.0.0`. D5 confirmed this works at runtime.

### B5 — `--help` lists all 4 commands

```
Usage: antigravity [options] [command]

Interactive CLI Setup Wizard — Antigravity

Options:
  -V, --version       output the version number
  -h, --help          display help for command

Commands:
  init                Initialize the wizard with interactive prompts
  generate [options]  Generate project files from saved configuration
  info                Show a summary of the saved wizard configuration
  reset               Clear the saved wizard configuration
  help [command]      display help for command
```

All four (init, generate, info, reset) present. ✓

### B6 — `info` in empty state

```
$ ANTIGRAVITY_CONFIG_DIR=/tmp/antigravity-audit-BzWWNH node apps/cli/dist/index.js info
[33mNo setup configuration found. Run init first.[39m
exit=0
```

Friendly message (yellow ANSI `[33m…[39m` wrap) + clean exit. ✓ Side effect: `conf` writes a 19-byte `config.json` with `{}` on first access — this is the `conf` package bootstrapping, not a product issue.

### B7 — programmatic seed → info → generate → reset round-trip

Seed script (`/tmp/antigravity-audit-BzWWNH/seed.mjs`) used `buildWizardConfig` + `saveConfig` imported from `dist/` — **not the interactive TTY path**, per the prompt's explicit instruction.

**Step 1 — Seed:**
```
SEEDED config:
{
  "projectName": "audit-probe",
  "agents": ["coder", "mcp"],
  "includeTemplates": true
}
```

**Step 2 — `info` (populated):**
```
Projeto Zero Configuration State:

projectName: audit-probe
agents:
  - coder
  - mcp
mcpConnectors:
  (none)
defaults:
  (none)
includeTemplates: yes
```

**Step 3 — `generate -d /tmp/.../out-test-dir`:**
```
┌  Code Generation
│
◇  Scaffold completed!
│
◆  Created 5 artifacts in C:/Users/ADMINI~1/AppData/Local/Temp/antigravity-audit-BzWWNH/out-test-dir
│
└  Generated 5 artifacts in the target directory.
```

**Step 4 — walk output tree:**
```
out-test-dir/
├── .agents/
│   ├── default-wizard-config.json
│   ├── project-config.json
│   └── prompts/
│       ├── coder.md
│       └── mcp.md
├── .claude/
│   └── settings.project.json
└── src/
    ├── commands/
    └── lib/
```

5 artifact files (directory markers not counted), matching the "5 artifacts" claim.

**Step 5 — Programmatic `clearConfig()`:**
```
BEFORE clear: present
AFTER  clear: null
```

(CLI `reset` command requires TTY by design — see reset.js:9 — so `clearConfig()` called directly for round-trip closure. This is a documented non-bug.)

**Step 6 — `info` (empty again):**
```
No setup configuration found. Run init first.
```

Round-trip closed cleanly. ✓

**Caveat:** my seed's `buildWizardConfig` call used `import.meta.url` pointing at `/tmp/seed.mjs`, which made `findSeedConfigPath` miss the shipped `default-wizard-config.json` — so `mcpConnectors` and `defaults` came back undefined. Product works correctly when called from inside the package (`init` and scaffolder both find the seed). This is an audit-test-harness artifact, not a product bug.

---

## 5. Correctness findings (Axis C)

### C1 — version consistency across 4 locations

```
$ grep -n '"version"' apps/cli/package.json
3:  "version": "1.0.0",

$ grep -n 'VERSION\|v1\.0\.0' apps/cli/dist/lib/banner.js
3:import { VERSION } from "./version.js";
7:    console.log(theme.muted(`  Interactive CLI Setup Wizard v${VERSION}\n`));

$ node apps/cli/dist/index.js --version
1.0.0

$ grep -n '## \[1\.0\.0\]' CHANGELOG.md
5:## [1.0.0] — 2026-04-14
```

Four locations all read (or resolve to) `1.0.0`. `version.js` reads `package.json` directly at runtime, guaranteeing banner + --version can never drift from `package.json` version field. The v1.0.0 runtime banner was directly observed in D5. ✓

### C2 — spec-by-spec requirement map

`.agents/project-specs.md` (30 lines) declares these numbered requirements:

| Spec | Requirement | Code | Test |
|------|-------------|------|------|
| §1 (data & structures) | JSON persistence via `conf` package with `ANTIGRAVITY_CONFIG_DIR` override | `apps/cli/dist/lib/config.js:1-24` (imports `Conf`, honors env override) | `apps/cli/src/__tests__/config.test.ts` (7 tests) |
| §2 (commands) | `init` interactive via `@clack/prompts` | `apps/cli/dist/commands/init.js:139-240` (`p.group({...})`) | `apps/cli/src/__tests__/init-helpers.test.ts` (7 tests) + `error-paths.test.ts` (init SIGINT/saveConfig/corrupt-store, 5 tests) |
| §2 (commands) | `generate` scaffolds the target dir | `apps/cli/dist/commands/generate.js:7-52` (invokes `scaffoldProject`) | `apps/cli/src/__tests__/generate-command.test.ts` (3 tests) + `scaffolder.test.ts` (7 tests) |
| §2 (commands, implicit) | `info` & `reset` | `apps/cli/dist/commands/info.js` + `reset.js` | `info-command.test.ts` (3) + `reset-command.test.ts` (3) |
| §3 (stability, Windows) | Cross-platform `path` normalization | `apps/cli/dist/lib/fs-utils.js` (uses `path.join` throughout) | `fs-utils.test.ts` (11 tests) + `error-paths.test.ts` (explicit `process.platform === "win32"` branches for EACCES-equivalent EEXIST) |
| Arch (visual) | `@clack/prompts` spinner | `init.js:165 / 229`, `generate.js:35`, `reset.js:32` (`p.spinner()`) | Exercised in every B7 run and in all tests that spawn the CLI |
| Arch (visual) | `picocolors` semantic theme | `init.js:3` (`import pc from "picocolors"`), `reset.js:3`, `theme.js` (theme wrapping) | ANSI escapes observed in D2/D5 output (`[33m`, `[36m`, `[32m`) |
| Arch (visual) | `figlet` ASCII art banner | `banner.js:1` (`import figlet`), `banner.js:5` (`figlet.textSync("Projeto Zero", …)`) | D5 observed the rendered banner; cross-platform report confirmed on PS/cmd/Linux |

Every requirement in the spec has a code path AND a test path. ✓

### C3 — adversarial checklist

See §7 below. All 5 items PASS.

### C4 — cross-platform report literality

File: `.agents/handoffs/cross-platform-report.md` (9785 bytes, Session 15 deliverable, dated 2026-04-14).

Per-platform evidence count:

| Platform | Literal 7-step output? | Separate-container proof? |
|----------|------------------------|---------------------------|
| Windows PowerShell | Yes — Steps 1–7 + "paths with spaces" addendum | N/A (single shell) |
| Windows cmd.exe | Yes — Steps 1–7 + "paths with spaces" addendum | N/A (single shell) |
| Linux (Docker node:20) | Yes — Steps 1–7 + "paths with spaces" addendum | Yes — each step shows a different `root@<hostname>` prompt proving fresh `docker run --rm` containers |

C4 as stated by the prompt PASSES: "each platform has literal command output attributed to it". ✓

**Caveat (not a tripwire; flagged as follow-up #1 in §10):** the report's first line declares `Tarball: projeto-zero-cli-0.1.0.tgz (17.7 kB, 43 files)` and the banner inside the report output says `v0.1.0`. The current tarball is `1.0.0` with 48 files. The 5-file delta is `LICENSE` + `dist/lib/version.*` (the version-SSOT refactor). No functional runtime behavior changed between 0.1.0 and 1.0.0 that would be platform-sensitive. The present audit independently re-verified the round-trip on Windows (§4.B7) with identical behavior (5 artifacts, ANSI rendered, figlet drawn, paths with spaces implicitly via `C:/Users/ADMINI~1/…`). Cross-platform risk at 1.0.0 is very low but not *re-tested*.

### C5 — governance alignment (3 confirmations)

**(a)** `.agents/vendor-policy.json` exists and declares `single-family` + `adversarialChecklistMandatory: true`:
```json
{
  "policy": "single-family",
  "implementationFamily": "claude",
  "reviewFamily": "claude",
  "adversarialChecklistMandatory": true,
  ...
}
```
✓

**(b)** R11 / R17(c) are policy-aware in `_production-contract.txt`:
```
63:     - Under `policy: cross-family` (original R11 default): ...
68:     - Under `policy: single-family`: the validator runs on the SAME family ...
72:       and replaces cross-family separation as the primary anti-gaming ...
74:       is REQUIRED for single-family.
76:     If `.agents/vendor-policy.json` does not exist, `cross-family` is
135:         - Under `cross-family` policy (or no policy file): implementation ...
141:         - Under `single-family` policy: both implementation and validation ...
```
Both branches literally present (R11 at lines 63/68, R17(c) at lines 135/141). ✓

**(c)** `.agents/handoffs/session-17-blockers.md` exists in the `handoffs/` subdirectory (NOT at `.agents/` root, resolving MF-1):
```
$ ls .agents/handoffs/session-17-blockers.md
-rw-r--r-- 1 Administrador 197121 ... session-17-blockers.md

$ ls .agents/session-17-blockers.md
ls: cannot access '.agents/session-17-blockers.md': No such file or directory
```
✓

---

## 6. Experience findings (Axis D)

### D1 — README audit

Simulating a first-time user reading `apps/cli/README.md` top-to-bottom:

- **Install without questions?** Yes. Line 10: `npm install -g @projeto-zero/cli`. Also provides `npx @projeto-zero/cli init` on line 16 as a no-install alternative. ✓
- **Know what each command does?** Yes. One-liners quoted:
  - `init`: "Initialize the wizard with interactive prompts" + list of questions it asks (lines 32–40)
  - `generate`: "Generates the project files based on the configuration persisted by the init command" + `-d` flag documented (lines 45–53)
  - `info`: "Shows a summary of your currently saved setup configuration without making any changes" (lines 55–60)
  - `reset`: "Danger Zone. Completely clears the active configuration file saved by init. Prompts for final confirmation" (lines 62–67)
- **Example trace plausible?** **Partially.** The example on lines 86–114 shows `Created 2 artifacts` for an `[ClaudeCoder, AntigravityAuditor]` + `includeTemplates: yes` config. The real scaffolder always emits 3 base files (`default-wizard-config.json`, `project-config.json`, `settings.project.json`) plus N prompt templates when `includeTemplates: yes`. With 2 agents + includeTemplates, actual output is ≥5 files. My §4.B7 observed 5 files for a similar config. **The README count is wrong.** See §10 follow-up #2.
- **`ANTIGRAVITY_CONFIG_DIR` documented with a concrete example?** Yes. Lines 77–80: `ANTIGRAVITY_CONFIG_DIR="/tmp/mock-cli-tests" antigravity init`. ✓
- **Troubleshooting addresses real problems?** Yes. Three entries: (1) missing config, (2) directory-perm errors on Windows, (3) state mismatch across repos (recommends `reset`). All three correspond to failure modes exercised by the test suite (config.test.ts / error-paths.test.ts). ✓

**Verdict:** README is fundamentally correct and user-first; the one inaccuracy (2 vs 5 artifacts) is a cosmetic follow-up.

### D2 — error path exercised

`generate` with no config (after B7's clear):

```
┌  Code Generation
│
◇  Pre-flight ───────────────────────────────────────╮
│                                                    │
│  No configuration found. Please run "init" first.  │
│                                                    │
├────────────────────────────────────────────────────╯
│
└  Aborted.

exit=0
```

- Non-zero exit? No — exit 0 (because this is a user-level "nothing to do" state, not a programmer error). No stack trace, no crash, friendly clack-boxed message. ✓

### D3 — SIGINT exits 0

`apps/cli/src/__tests__/error-paths.test.ts` contains three SIGINT acceptance tests that drive `init` under `child_process.spawn` against the real `dist/index.js` and send `SIGINT` at each of the three interactive prompt stages (`p.text`, `p.multiselect`, `p.confirm`). Line references:

- Line 145–153: `"exits 0 with no stack trace when SIGINT hits the project-name p.text prompt"`
- Line 155–165: `"exits 0 with no stack trace when SIGINT hits the agents p.multiselect prompt"`
- Line 167–177: `"exits 0 with no stack trace when SIGINT hits the includeTemplates p.confirm prompt"`

All three passed in the B3 vitest run (visible as green checkmarks in the tailed test output). The tests assert both `expect(r.code).toBe(0)` and `assertNoStackTrace(r.stderr)`. ✓

### D4 — typo scan

```
$ grep -niE "sanbox|accomodate|seperat|recieve|occured|untill|wich|teh |befor |thier|hte |neccessar|definat|enviroment" apps/cli/README.md CHANGELOG.md
(no hits)

$ grep -rh -E "'[^']*(seperat|accomodat|sanbox|untill|recieve|occured|neccessar)[^']*'" apps/cli/dist/
(no hits)
```

Zero typo hits in user-facing documentation or in shipped string constants. Prior chat's "sanboxes → sandboxes" fix stuck. ✓

### D5 — banner renders + colors apply

Live invocation (`init` with valid piped stdin):

```
[36m  ____            _      _          _____
 |  _ \ _ __ ___ (_) ___| |_ ___   |__  /___ _ __ ___
 | |_) | '__/ _ \| |/ _ \ __/ _ \    / // _ \ '__/ _ \
 |  __/| | | (_) | |  __/ || (_) |  / /|  __/ | | (_) |
 |_|   |_|  \___// |\___|\__\___/  /____\___|_|  \___/
               |__/[39m
[2m  Interactive CLI Setup Wizard v1.0.0
[22m
┌  [46m[30m Projeto Zero Interactive Setup [39m[49m
│
◇  Configuration saved successfully!
│
└  [32mSetup complete. You can now run "generate" or "info".[39m
```

Figlet ASCII rendered, cyan-wrap (`[36m…[39m`) around the logo, dimmed (`[2m…[22m`) tagline, inverse cyan (`[46m[30m`) intro badge, green (`[32m`) success outro. ANSI escapes are raw because I captured via non-TTY pipe — these render correctly in a real terminal. Crucially, the tagline shows **`v1.0.0`**, which means `dist/lib/version.js` → `dist/lib/banner.js` SSOT chain is live at runtime in the built artifact. ✓

---

## 7. Adversarial Checklist (MANDATORY under single-family policy)

Per `.agents/antigravity-taxonomy.md §4`, five items. No skipping — skipping any item = mechanical failure (prompt tripwire #3).

### Item 1 — Evidence Literality

Three claims from this deliverable picked at random, verified against literal pasted evidence:

| Claim | Location | Literal evidence present? |
|-------|----------|---------------------------|
| "48 of 48 tests pass" (§4.B3) | `Tests 48 passed (48)` vitest line | **YES** — literal vitest summary pasted |
| "publishConfig.access === 'public'" (§3.A6) | Extracted tarball's `package.json` via audit-tarball.mjs | **YES** — full JSON block pasted in §3.A4 |
| "Banner renders v1.0.0 at runtime" (§6.D5) | Live piped-stdin invocation output | **YES** — full ANSI-wrapped banner + tagline pasted |

**Verdict: PASS.** No narrative-only claims.

### Item 2 — File Existence

Three file paths referenced in this deliverable, `ls`'d:

```
$ ls -la /c/Users/Administrador/Documents/GitHub/Projeto-Zero/apps/cli/dist/index.js
-rw-r--r-- ... dist/index.js   (exists, size 650)

$ ls -la /c/Users/Administrador/Documents/GitHub/Projeto-Zero/.agents/handoffs/cross-platform-report.md
-rw-r--r-- 1 Administrador 197121 9785 Apr 14 10:14 .../cross-platform-report.md

$ ls -la /c/Users/Administrador/Documents/GitHub/Projeto-Zero/.agents/validations/milestone-b-validation.md
-rw-r--r-- 1 Administrador 197121 34621 Apr 14 17:27 .../milestone-b-validation.md
```

All three present and non-empty. **Verdict: PASS.**

### Item 3 — Anti-"technically compiles"

Three tests picked at random from `apps/cli/src/__tests__/`:

| Test file | Mocks fs/Conf? | Spawns real dist/? |
|-----------|----------------|--------------------|
| `error-paths.test.ts` | **No** — line 18: "No mocks of fs or Conf. We exercise the REAL built CLI under apps/cli/dist/index.js via child_process.spawn" | **Yes** — line 29 imports `spawn`, line 39 `CLI_ENTRY = path.resolve(here, "..", "..", "dist", "index.js")`, line 64 `spawn(process.execPath, [CLI_ENTRY, ...opts.args], ...)` |
| `generate-command.test.ts` | **No** — file comment line 4–5: "Tests the `generate` command via child_process.spawn against the real built CLI at dist/index.js. No mocks of fs, Conf, or child_process." | **Yes** — line 9 + line 36 |
| `reset-command.test.ts` | **No** — line 4–5: "Tests the `reset` command via child_process.spawn against the real built CLI at dist/index.js. No mocks." | **Yes** — line 15 + line 39 |

Repo-wide mock scan via `grep -rn "vi\.mock\|jest\.mock"`:
```
info-command.test.ts:19:  logSpy = vi.spyOn(console, "log").mockImplementation(...)
```

Only hit is a `console.log` spy in `info-command.test.ts` — legitimate output capture, not a production-logic mock.

**Verdict: PASS.** Tests hit the real runtime path; no "technically compiles" pattern.

### Item 4 — Per-Platform Output

`.agents/handoffs/cross-platform-report.md` checked per-platform (see §5.C4 table). All three declared platforms (Windows PowerShell, Windows cmd.exe, Linux Docker node:20) have full literal 7-step output + "paths with spaces" output. Linux section additionally shows distinct `root@<hostname>` prompts per step, proving separate `docker run --rm` containers (the Session 11 failure pattern — "declared cross-platform success with actual Windows-only execution" — cannot apply here).

**Verdict: PASS.** Caveat from §5.C4 (report is for v0.1.0, not v1.0.0) is a follow-up, not a literality failure.

### Item 5 — Spec-by-Spec Diff

See §5.C2 table. Every numbered requirement in `.agents/project-specs.md` is mapped to a code path (file + approximate line range) and a test path (test file name with test-count). No unmapped rows.

**Verdict: PASS.**

---

## 8. Gate transcript (R15)

Full literal output of `node scripts/session-gate.mjs`:

```
session-gate: session = 17
PASS preflight — all checks green
PASS handoff-exists — C:\Users\Administrador\Documents\GitHub\Projeto-Zero\.agents\handoffs\session-17-blockers.md
FAIL self-grading-table — missing ## Self-Grading Table
FAIL gate-transcript — missing ## Gate Transcript
PASS grading-vs-verdict — ok
FAIL git-clean — 1 unexpected dirty file(s)
   M package-lock.json

session-gate: FAIL
exit=1
```

**Interpretation (transparent per R9):**

- **`PASS preflight`** — all 7 preflight checks green (from §4.B2).
- **`PASS handoff-exists`** — the gate detected the only `session-17-*.md` handoff candidate: `.agents/handoffs/session-17-blockers.md`. That file is a **halt-record blocker file** from a prior dispatch (see §1.8), not a completed-session handoff. The two `FAIL` lines below this are a direct consequence of that mismatch, not real failures of an audit artifact.
- **`FAIL self-grading-table`** — gate expects a `## Self-Grading Table` section in the discovered handoff file; `session-17-blockers.md` doesn't have one because it's a blockers file. **Not a real audit failure** — the gate is pattern-matched against completed-session handoffs, and Session 17 has not yet run. This deliverable is an audit report (governed by the audit-prompt's §5 structure), not a session handoff.
- **`FAIL gate-transcript`** — same root cause as above.
- **`PASS grading-vs-verdict`** — ok.
- **`FAIL git-clean`** — `M package-lock.json` is **audit-induced**: B1's mandated `rm -rf node_modules && npm install` normalized the lockfile (−21/+1 lines, no dependency-version changes). Revert with `git checkout -- package-lock.json` if desired. The audit prompt explicitly instructed the clean install; the gate caught the side effect.

**Net:** 0 of the 3 `FAIL` lines reflects a real problem with the package being audited. They reflect either (a) the gate being designed for session-handoff patterns and the deliverable being a different artifact type, or (b) the audit's own required steps mutating tracked artifacts. Both are audit-scaffolding concerns, not publishability concerns.

---

## 9. Verdict

Full literal output of `node scripts/verdict.mjs` (trailing line is the mechanical verdict string; R14 forbids hand-typing it):

```
=== preflight: build ===
@projeto-zero/cli:build: cache hit, replaying logs 82a7d5dbf9af420c
@projeto-zero/cli:build: > @projeto-zero/cli@1.0.0 build
@projeto-zero/cli:build: > tsc && node scripts/copy-seed.mjs
@projeto-zero/cli:build: [copy-seed] C:\...\default-wizard-config.json -> C:\...\apps\cli\dist\default-wizard-config.json
 Tasks:    1 successful, 1 total
Cached:    1 cached, 1 total
  Time:    36ms >>> FULL TURBO

=== preflight: lint ===
@projeto-zero/cli:lint: cache hit
 Tasks:    1 successful, 1 total
Cached:    1 cached, 1 total
  Time:    27ms >>> FULL TURBO

=== preflight: test ===
@projeto-zero/cli:test: cache hit
 Test Files  8 passed (8)
      Tests  48 passed (48)
 Tasks:    1 successful, 1 total
Cached:    1 cached, 1 total
  Time:    27ms >>> FULL TURBO

=== preflight: files-exist ===
PASS files-exist: all 2 entries in apps/cli/package.json files[] exist.

=== preflight: pack-sanity ===
PASS pack-sanity: 48 files, 18900 bytes, all declared files[] present, no forbidden patterns.

=== preflight: repo-metadata ===
PASS repo-metadata: apps/cli/package.json metadata is complete and valid.

=== preflight: placeholder-scan ===
PASS placeholder-scan: no forbidden strings found.

=== preflight summary ===
check                status   ms
----------------------------------------
build                PASS     1011
lint                 PASS     971
test                 PASS     1014
files-exist          PASS     154
pack-sanity          PASS     1214
repo-metadata        PASS     158
placeholder-scan     PASS     164

preflight: ALL PASS

PRODUCTION-READY
```

`verdict.mjs` exited 0 and printed `PRODUCTION-READY` as its terminal line. Per R14, that string is the mechanical verdict. It is neither `GO` nor `NO-GO`; the audit prompt defines the composite `GO / NO-GO` pairing over the verdict + gate + acceptance-matrix + adversarial-checklist tuple (prompt §7), which is a decision for the human reviewer to make based on this deliverable, not a string I am permitted to hand-type.

**Composite status summary for the human reviewer:**
- Acceptance matrix (24 rows): all DONE (2 flagged as partial / with-caveat, both documented)
- Adversarial Checklist (5 items): all PASS
- `node scripts/verdict.mjs`: `PRODUCTION-READY`
- `node scripts/session-gate.mjs`: `FAIL` (3 lines, all interpreted in §8 as audit-scaffolding noise, not real package problems)

---

## 10. Open questions / follow-ups

**None of these block publish.** Flagged for the publishing agent (Session 17) or for Milestone C.

1. **Cross-platform report is for v0.1.0 / 43 files, not v1.0.0 / 48 files.** Delta is `LICENSE` (new) + `dist/lib/version.*` (SSOT refactor). Banner output in the report reads `v0.1.0`. Runtime behavior on all three platforms should be identical to v1.0.0 because the refactor is SSOT-additive and LICENSE is inert at runtime — but the three-platform matrix was not *literally re-run* on v1.0.0. Present audit independently verified Windows-side equivalence (§4.B7). **Action (optional):** Milestone C may wish to re-run the three-platform E2E against the published v1.0.0 tarball; cheap-to-redo in CI.
2. **README example trace says "Created 2 artifacts" but real scaffolder emits ≥5 artifacts** (3 base files + N prompt files; with MCP + 2 agents = 5). User-visible inaccuracy. **Action:** patch README line ~112 from `◇  Created 2 artifacts in ./src` to `◇  Created 5 artifacts in ./src` and update the outro to match. Low priority; safe to do post-publish as a docs-only 1.0.1.
3. **`apps/cli/projeto-zero-cli-0.1.0.tgz`** is a stray workspace artifact from an earlier `npm pack`. Untracked (doesn't ship), but litters the workspace. **Action:** `rm apps/cli/projeto-zero-cli-0.1.0.tgz` and/or add `*.tgz` to `apps/cli/.gitignore` if not already. Not a blocker.
4. **A7 repository URL reachability** not probed (operator declined the network call). URL is syntactically valid and npm doesn't validate it. **Action (optional):** run `curl -I https://github.com/devkauania/projeto-zero` and paste in Milestone C.
5. **`session-17-blockers.md` is stale** — all three blockers it documents (R17 skip, missing milestone-b-validation.md, Opus-tier mismatch) are either resolved (first two) or a forward concern rather than a current violation (the third). **Action:** when Session 17 runs and produces its real handoff, that file can be archived or annotated `[RESOLVED 2026-04-14]` for historical clarity.
6. **R15 gate mismatches this audit artifact shape.** The gate expects `## Self-Grading Table` and `## Gate Transcript` sections in a session handoff file; this is an audit deliverable per a separate prompt and uses the prompt's §5 structure instead. **Action (optional):** if pre-publish audits become recurring, extend `session-gate.mjs` to recognize audit deliverables at `.agents/validations/pre-publish-*.md` as a separate artifact class, or add the two section headers cosmetically to future audit deliverables.
7. **`package-lock.json` is dirty after B1.** Audit-induced, non-substantive. **Action (optional):** `git checkout -- package-lock.json` before committing the deliverable; the deliverable itself is a separate clean add.

---

*End of audit.*
