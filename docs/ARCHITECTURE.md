# Architecture Walkthrough

A guided tour of the engineering decisions behind `@projeto-zero/cli`. Written for a code reviewer who wants to see *why* the code is shaped the way it is, not just *what* it does.

The most interesting piece is the **swarm** — a command that spawns multiple Claude Code agents in parallel, each in its own isolated git worktree, inside a safety envelope that refuses to escalate privileges unless the operator explicitly opts in. Getting this right means threat-modelling every input surface: argv, env, filesystem paths, prompt files, child processes.

## Table of contents

1. [Argv-array spawn: no shell, no injection](#1-argv-array-spawn-no-shell-no-injection)
2. [Child-process env allowlist: credentials stay on the parent](#2-child-process-env-allowlist-credentials-stay-on-the-parent)
3. [The `--i-understand` gate: destructive defaults require explicit opt-in](#3-the---i-understand-gate-destructive-defaults-require-explicit-opt-in)
4. [Worktree name validation: defense in depth against path traversal](#4-worktree-name-validation-defense-in-depth-against-path-traversal)
5. [Config dir hardening: symlink rejection + scope confinement](#5-config-dir-hardening-symlink-rejection--scope-confinement)
6. [Mechanical gates: PRODUCTION-READY as a pure function](#6-mechanical-gates-production-ready-as-a-pure-function)
7. [Anti-gaming session tripwire](#7-anti-gaming-session-tripwire)
8. [Repo map for the curious](#8-repo-map-for-the-curious)

---

## 1. Argv-array spawn: no shell, no injection

**Problem.** A swarm launcher that takes user-supplied prompts and spawns child processes has a classic command-injection surface. If any part of the argv is concatenated into a shell string, a prompt like `"; rm -rf $HOME; echo "` gets executed by the shell.

**Decision.** Every child-process spawn in the codebase takes an **argv array** and is called with `shell: false`. Prompt bodies never touch argv — they are streamed to the child's stdin. A regex test in the test suite greps the spawner source for any future `argv.join(` or `shell: true` and fails the build if one slips in.

From [`apps/cli/src/lib/swarm/agent-spawner.ts`](../apps/cli/src/lib/swarm/agent-spawner.ts):

```ts
const proc = spawn(bin, argv, {
  cwd,
  env: childEnv,
  shell: false, // CRITICAL: never invoke a shell. argv is taken literally.
  stdio: ["pipe", "pipe", "pipe"],
  windowsHide: true,
});

// Stream the prompt body into stdin and close.
try {
  const body = readFileSync(promptFile, "utf8");
  if (proc.stdin) {
    proc.stdin.write(body);
    proc.stdin.end();
  }
```

**Why this shape.** Node's `child_process.spawn` has two modes. With `shell: true` (or `child_process.exec`), argv is concatenated and handed to `/bin/sh -c`. With `shell: false` + an argv array, the kernel's `execve` receives the arguments as a C-string array — the shell never runs, so there is nothing to inject *into*. The prompt body going via stdin means even if an attacker controlled a prompt's entire contents, they couldn't shape argv.

The adversarial test in [`apps/cli/src/__tests__/swarm-spawner.test.ts`](../apps/cli/src/__tests__/swarm-spawner.test.ts):

```ts
it("source file does not invoke spawn with shell:true", () => {
  const src = fs.readFileSync(SPAWNER_SRC, "utf8");
  expect(src).not.toMatch(/shell\s*:\s*true/);
  expect(src).toMatch(/shell\s*:\s*false/);
});

it("source file does not concatenate argv into a shell string", () => {
  const src = fs.readFileSync(SPAWNER_SRC, "utf8");
  expect(src).not.toMatch(/\bargv\.join\b/);
  expect(src).not.toMatch(/\bexec\s*\(/);
  expect(src).not.toMatch(/execSync\s*\(/);
});
```

This is "last-line" defense — the *primary* control is the API shape (the function signature doesn't expose a way to pass a shell string), and the grep is a tripwire for regression.

## 2. Child-process env allowlist: credentials stay on the parent

**Problem.** `child_process.spawn` defaults to inheriting the full parent environment. On a developer machine that's `NPM_TOKEN`, `ANTHROPIC_API_KEY`, `GITHUB_TOKEN`, `AWS_SECRET_ACCESS_KEY`, etc. If the child Claude Code process is compromised or leaks its env, every credential leaks with it.

**Decision.** The child env is built from an explicit **allowlist** of 11 variable names — everything else is stripped. The allowlist change is gated behind a unit test that asserts the length, so growing the list requires a conscious review.

From [`apps/cli/src/lib/swarm/agent-spawner.ts`](../apps/cli/src/lib/swarm/agent-spawner.ts):

```ts
export const CHILD_ENV_ALLOWLIST: readonly string[] = Object.freeze([
  "PATH",
  "HOME",
  "USERPROFILE",
  "TMPDIR",
  "TMP",
  "TEMP",
  "LANG",
  "LC_ALL",
  "TERM",
  "CLAUDE_CODE_OAUTH_TOKEN",
  "CLAUDE_CONFIG_DIR",
]);

export function filterChildEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {};
  for (const key of CHILD_ENV_ALLOWLIST) {
    const v = env[key];
    if (typeof v === "string") out[key] = v;
  }
  return out;
}
```

**Why an allowlist instead of a denylist.** Denylists age badly — the moment a new credential env var enters the ecosystem (`CLAUDE_OPUS_TOKEN`, say), the denylist is silently wrong and the secret leaks. Allowlists fail closed: new variables simply don't forward until someone reviews them.

The length-lock test in [`apps/cli/src/__tests__/swarm-spawner.test.ts`](../apps/cli/src/__tests__/swarm-spawner.test.ts):

```ts
it("allowlist is deliberately short (tokens stay on the parent)", () => {
  // Updating this count requires a conscious review of what the child gets.
  expect(CHILD_ENV_ALLOWLIST.length).toBe(11);
});
```

The test fails if someone silently adds an entry, which forces a PR review on any change to what the child can see.

## 3. The `--i-understand` gate: destructive defaults require explicit opt-in

**Problem.** Claude Code exposes a `--permission-mode bypassPermissions` flag that disables the per-action confirmation UI. It's useful for hands-off automation but dangerous if invoked by accident — the agent can rewrite, delete, and `git push` without asking.

**Decision.** The safety envelope's argv builder **refuses** to emit `bypassPermissions` unless both the explicit flag and a secondary `--i-understand` flag are set. `verify` mode is additionally locked to `plan` (read-only) regardless of caller intent. This is a single-source-of-truth — every spawn path in the codebase funnels through this builder.

From [`apps/cli/src/lib/swarm/safety-envelope.ts`](../apps/cli/src/lib/swarm/safety-envelope.ts):

```ts
// Resolve permission mode. Verify mode is always `plan`. Work mode defaults
// to `acceptEdits` and only escalates to `bypassPermissions` if BOTH the
// explicit flag AND the iUnderstand gate are set.
let permissionMode: PermissionMode;
if (input.mode === "verify") {
  permissionMode = "plan";
} else if (
  input.permissionMode === "bypassPermissions" &&
  input.iUnderstand === true
) {
  permissionMode = "bypassPermissions";
} else if (input.permissionMode === "plan") {
  permissionMode = "plan";
} else {
  permissionMode = "acceptEdits";
}
```

**Why two flags instead of one.** A single `--bypass` flag is one typo away from firing. A two-flag gate means the operator had to type a second, longer, more deliberate phrase (`--i-understand`). This is the same pattern as `rm --no-preserve-root` or `kubectl --disable-admission-plugin=…` — the second flag exists purely as a speed bump for muscle-memory.

The verify-mode lock is a second layer: even if someone *does* pass `--permission-mode bypassPermissions --i-understand`, a `--mode verify` run overrides to `plan`. That prevents the "I just wanted a quick read-only review" use case from silently getting write access if someone copies an old invocation.

Downstream, the spawner calls `auditArgv` on the built envelope as a last-chance sanity check before handing it to `spawn()`:

```ts
const issue = auditArgv(argv);
if (issue && !issue.startsWith("permissionMode=bypassPermissions")) {
  throw new Error(`agent-spawner: refusing to spawn — ${issue}`);
}
```

## 4. Worktree name validation: defense in depth against path traversal

**Problem.** Swarm agents each run in their own git worktree at `.claude/worktrees/<swarm-id>/agent-<n>`. The `swarm-id` is user-supplied via `--session-prefix`. A naive implementation lets `--session-prefix ../../../etc` drop worktrees outside the repo.

**Decision.** Worktree names are validated against a tight regex (`/^[a-zA-Z0-9_-]{1,32}$/`), and the resolved absolute path is checked against the repo root using `path.relative`. Anything that resolves outside the repo is refused.

From [`apps/cli/src/lib/swarm/worktree-manager.ts`](../apps/cli/src/lib/swarm/worktree-manager.ts):

```ts
const NAME_RE = /^[a-zA-Z0-9_-]{1,32}$/;

function assertName(kind: string, value: string): void {
  if (!NAME_RE.test(value)) {
    throw new Error(
      `worktree-manager: invalid ${kind} "${value}" — must match ${NAME_RE}`
    );
  }
}
```

And the post-resolve check in `createWorktree`:

```ts
const wtPath = path.join(repoRoot, ".claude", "worktrees", swarmId, `agent-${agentIndex}`);

// Safety: the resolved path must still live inside the repo.
const rel = path.relative(repoRoot, wtPath);
if (rel.startsWith("..") || path.isAbsolute(rel)) {
  throw new Error(
    `worktree-manager: refusing to create worktree outside repo root: ${wtPath}`
  );
}
```

**Why two layers.** The regex alone is enough to block `..` and `/`, but regexes are brittle — someone could "fix" it later to allow a wider character set and not realize they just re-opened the traversal. The resolved-path check is a semantic guarantee: regardless of what chars the regex allows, the final absolute path must live under `repoRoot`. If either one alone failed, the other would catch it.

## 5. Config dir hardening: symlink rejection + scope confinement

**Problem.** The CLI persists wizard state via the `conf` package. The data dir is overridable with `ANTIGRAVITY_CONFIG_DIR` (useful for CI and sandboxes). A malicious or mis-configured env var could point the store at `~/.ssh/` or a world-writable path like `/tmp/public`, widening the blast radius if the Conf file ever leaked sensitive data.

**Decision.** Two checks before `conf` sees the override:

1. `lstat` the path — if it's a symlink, refuse. (Blocks the classic "point env var at a symlink to `~/.ssh`" attack.)
2. Compute `path.relative` from `os.homedir()` and `os.tmpdir()` — at least one must be an ancestor. Anything outside both is refused.

From [`apps/cli/src/lib/config.ts`](../apps/cli/src/lib/config.ts):

```ts
function validateConfigDir(override: string): string {
  if (!override || override.length < 2) {
    throw new Error(
      `ANTIGRAVITY_CONFIG_DIR: refusing empty or too-short override "${override}"`
    );
  }
  const resolved = path.resolve(override);

  // Reject symlinks at the path itself.
  try {
    const st = lstatSync(resolved);
    if (st.isSymbolicLink()) {
      throw new Error(`ANTIGRAVITY_CONFIG_DIR: refusing symlink at "${resolved}"`);
    }
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code !== "ENOENT") throw err;
  }

  // Confine to home or tmp.
  const prefixes = safePrefixes();
  const ok = prefixes.some((p) => {
    const rel = path.relative(p, resolved);
    return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
  });
  if (!ok) {
    throw new Error(
      `ANTIGRAVITY_CONFIG_DIR: "${resolved}" is outside the allowed scope ` +
      `(home or tmp). Refusing to write the Conf store there.`
    );
  }
  return resolved;
}
```

On POSIX, the stored file is also chmod'd to `0600` so only the owning user can read it:

```ts
function hardenConfFile(store: Conf<StoreSchema>): void {
  if (process.platform === "win32") return;
  try {
    chmodSync(store.path, 0o600);
  } catch { /* best-effort */ }
}
```

**Why not just trust `conf`.** The `conf` package is excellent but its threat model assumes a cooperative environment. When exposing an env-var override to users, the CLI must validate its own inputs — "defense at the boundary, not the dependency."

## 6. Mechanical gates: PRODUCTION-READY as a pure function

**Problem.** "Looks good to me" doesn't scale and doesn't survive agentic workflows. If the release bar is a human judgement call, an LLM helper will happily find a "good" reason to ship anything.

**Decision.** `PRODUCTION-READY` is a pure function of a set of scriptable gates. The release script runs the gates, and returns the verdict mechanically. No natural-language reasoning is involved in the decision.

Current gate set (from [`scripts/preflight.mjs`](../scripts/preflight.mjs)):

- **build** — `turbo build` across all workspaces
- **lint** — `turbo lint`
- **test** — `turbo test` (the Vitest suite; several suites spawn the built CLI)
- **files-exist** — every path listed in `apps/cli/package.json#files` resolves on disk
- **pack-sanity** — `npm pack --dry-run` has the expected file count, size, and no forbidden patterns
- **repo-metadata** — package.json has valid `name`, `version`, `description`, `repository`, `license`, etc.
- **unreplaced-token scan** — no `{{…}}`, `TODO`, or `FIXME` strings in shipping surface
- **check-no-self-dep** — package.json does not depend on itself (CI guard after a real v1.0.0 bug)
- **check-non-tty-connectors** — static tripwire on the non-TTY default for MCP connectors (CI guard after a real v1.0.0 bug)
- **single-family LLM lock** — live product surface references only Claude, not other LLM vendors (enforces the project's single-family policy)
- **check-workflows** — every GitHub Action is pinned to a full commit SHA, every workflow declares top-level `permissions:` (never `write-all`), no `pull_request_target`, `id-token: write` only in `release.yml`, and the release gates (production `npm audit`, `--ignore-scripts` publish, minimum Node/npm versions) are still present

The release workflow in [`.github/workflows/release.yml`](../.github/workflows/release.yml) runs `preflight` before it ever reaches `npm publish`:

```yaml
- name: Preflight (must pass before publish)
  run: node scripts/preflight.mjs

- name: Verify package version matches tag
  shell: bash
  run: |
    TAG="${GITHUB_REF_NAME#v}"
    PKG=$(node -p "require('./apps/cli/package.json').version")
    if [ "$TAG" != "$PKG" ]; then
      echo "::error::tag v$TAG does not match apps/cli/package.json version $PKG"
      exit 1
    fi

- name: Publish with provenance
  working-directory: apps/cli
  run: npm publish --provenance --access public --ignore-scripts
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Why this matters for an agent-first codebase.** If you let an LLM grade its own homework, it will pass. Gates are the grading rubric that doesn't know how to be charming.

## 7. Anti-gaming session tripwire

**Problem.** When a work session has verification checkboxes ("[ ] all tests pass → [x] all tests pass"), an LLM can flip them without actually doing the work — the checkbox edit is indistinguishable from a real verification in a diff.

**Decision.** The `session-gate` script greps every verification-checkbox flip from `[ ]` to `[x]` in `.agents/handoffs/` and `.agents/validations/`, then uses `git blame` + commit metadata to check **who authored the flip**. A checkbox authored by a commit with `Co-Authored-By: Claude` is considered unverified. A human-authored commit is the required signal.

The script lives at [`scripts/session-gate.mjs`](../scripts/session-gate.mjs); the CI integration is the `session-gate` hook referenced in [`apps/cli/VERIFICATION.md`](../apps/cli/VERIFICATION.md).

**Why `git blame` instead of "just asking Claude to not cheat".** An agent that can edit files can also edit its own instructions. `git blame` is out-of-band — it reads the commit author metadata set by `git commit`, which the agent can't retroactively forge for prior commits (without breaking signature chains or getting caught by the "Co-Authored-By" detection). It is a mechanical, external source of truth.

## 8. Repo map for the curious

```
apps/cli/src/
├── commands/
│   ├── init.ts           # interactive wizard (TTY + non-TTY paths)
│   ├── generate.ts       # scaffolder (materialises config → workspace scaffold)
│   ├── info.ts           # show persisted config
│   ├── reset.ts          # clear persisted config
│   └── swarm.ts          # parallel Claude agent launcher (plan + live modes)
├── lib/
│   ├── config.ts         # ANTIGRAVITY_CONFIG_DIR validation, chmod 0600, Conf wrapper
│   ├── scaffolder.ts     # template emitter (.agents/, skills/, .mcp/ — see root README)
│   ├── theme.ts          # picocolors-based semantic theme
│   └── swarm/
│       ├── safety-envelope.ts    # argv builder + --i-understand gate
│       ├── agent-spawner.ts      # the only place spawn() is called
│       ├── worktree-manager.ts   # NAME_RE + path-relative containment
│       ├── agent-outcome.ts      # success = exit 0 + valid stream-json + successful result event
│       └── prompt-browser.ts     # .agents/prompts/*.md discovery
└── __tests__/            # Vitest suites (some spawn the built CLI)

scripts/
├── preflight.mjs         # orchestrates every gate below
├── verdict.mjs           # PRODUCTION-READY as a pure function of preflight
├── session-gate.mjs      # git blame anti-gaming tripwire
├── placeholder-scan.mjs  # unreplaced-token scan across shipping surface
├── pack-sanity.mjs       # npm pack dry-run inspection
├── repo-metadata-check.mjs
├── files-exist.mjs
├── check-no-self-dep.mjs
├── check-non-tty-connectors.mjs
├── check-no-multi-llm.mjs
├── check-workflows.mjs   # GitHub Actions hardening guard
├── record-demo.mjs       # records a real CLI run for the README demo
└── render-terminal-svg.mjs

audit/
├── phase1-recon-v1.1.0.md
├── phase2-e2e-v1.1.0.md
├── vulnerability-ledger.md         # one row per CVE-class finding
└── patches/                        # one handoff doc per closed row
    ├── 01-...md
    ├── 06-config-dir-error-ux.md
    └── 07-swarm-enoent-handler.md
```

## Where to go next

- [`apps/cli/README.md`](../apps/cli/README.md) — user-facing CLI docs
- [`docs/SWARM.md`](SWARM.md) — swarm command quickstart and safety defaults
- [`docs/MIGRATION_1.0_to_1.1.md`](MIGRATION_1.0_to_1.1.md) — breaking changes between versions
- [`audit/vulnerability-ledger.md`](../audit/vulnerability-ledger.md) — security findings + closure evidence
- [`CHANGELOG.md`](../CHANGELOG.md) — release history
