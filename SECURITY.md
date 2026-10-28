# Security policy

## Supported versions

Only the latest release of `@projeto-zero/cli` on npm gets security fixes.
Fixes land on `main` first and ship in the next release; the
[CHANGELOG](CHANGELOG.md) `Unreleased` section lists what is already fixed
on `main` but not yet published.

| Version | Supported |
|---|---|
| latest 1.1.x | yes |
| < 1.1 | no |

## Reporting a vulnerability

Please **do not open a public issue** for a security problem.

Report it privately, in one of two ways:

1. **GitHub private vulnerability reporting.** If the repository's
   [Security tab](https://github.com/devkauania/projeto-zero/security) shows a
   **Report a vulnerability** button, use it. Only the maintainer can see the
   report.
2. **Private contact request.** If that button is not shown, open a
   [Private contact request](https://github.com/devkauania/projeto-zero/issues/new?template=private_contact.yml)
   issue. Its form has no field for details: it only says that you have
   something to report. The maintainer then opens a draft security advisory
   and invites you to it. A draft advisory is visible only to the
   maintainer and the people invited, so you send the details there.

A useful report says:

- the version (`npx @projeto-zero/cli --version`) and your OS / Node.js version,
- the command you ran and what happened,
- what you expected instead, or why the behaviour is a security problem,
- a minimal reproduction if you have one.

This is a single-maintainer project, so there is no guaranteed response
time. You will get an answer in the advisory thread; once a fix is ready
the advisory is published and you are credited unless you ask not to be.

## Scope

In scope: the published CLI (`apps/cli/`) and the release pipeline
(`.github/workflows/`, `scripts/`). Examples of what counts:

- `swarm` passing data from a prompt file or the environment to a child
  process in a way the [safety envelope](docs/SWARM.md) says it should not
  (argv, shell, environment allowlist, `bypassPermissions` gate);
- `generate` writing outside the target directory;
- the config store (`ANTIGRAVITY_CONFIG_DIR`) being readable by other users
  or redirectable through a symlink;
- a way to publish to npm without going through the release workflow.

Out of scope: what a Claude Code agent does once it is running with the
permissions you gave it. The swarm tool allow/deny rules are a speed bump,
not a sandbox; this is documented in
[`docs/SWARM.md`](docs/SWARM.md#tool-rules-are-not-a-sandbox).

## How security work is tracked

Every finding, open or closed, is a row in
[`audit/vulnerability-ledger.md`](audit/vulnerability-ledger.md), and each
closed row has a patch write-up in [`audit/patches/`](audit/patches/).
