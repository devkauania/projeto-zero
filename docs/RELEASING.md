# Releasing `@projeto-zero/cli`

Releases are published by `.github/workflows/release.yml` when a `v*.*.*`
tag is pushed. This page says what the workflow does today and what is
still waiting on the owner.

## What the workflow does

1. Checks out the tag (`persist-credentials: false`). Every action is pinned
   to a full commit SHA; `scripts/check-workflows.mjs` (part of preflight)
   fails if a workflow uses a tag or branch reference instead.
2. Sets up Node 24 and installs npm 11.12.1 (npm Trusted Publishing needs
   npm >= 11.5.1 and Node >= 22.14.0).
3. `npm ci`, then `npm audit --omit=dev --audit-level=high`: a high or
   critical advisory in the shipped dependency tree blocks the release.
   Dev-only advisories do not.
4. Preflight, then checks that the tag matches `apps/cli/package.json`.
5. Builds and tests the package in a step that holds no publish credential.
6. `npm publish --provenance --access public --ignore-scripts`, so no
   dev-dependency code (tsc, vitest, lifecycle scripts) runs in the step
   that can publish.

Permissions: the workflow default is `{}`; the publish job gets only
`contents: read` and `id-token: write` (the OIDC token used for the
provenance attestation and, once configured, for Trusted Publishing).

## How npm authenticates today

npm >= 11.5.1 tries OIDC Trusted Publishing first and falls back to a
traditional token
(<https://docs.npmjs.com/trusted-publishers>). **The trusted publisher is
not configured on npmjs.com yet**, so today the publish is authenticated by
the `NPM_TOKEN` repository secret, passed as `NODE_AUTH_TOKEN`. That token
is a long-lived credential; it stays in the workflow only as a fallback
until the owner finishes the steps below. The OIDC path has not been
exercised by a real release yet.

## Pending owner actions

These need the npm account owner (2FA) and cannot be done from the repo:

1. On npmjs.com, open `@projeto-zero/cli` -> Settings -> Trusted publishing
   and add a GitHub Actions publisher: repository `devkauania/projeto-zero`,
   workflow file `release.yml` (no environment).
2. Cut the next release. Confirm in the job log and with
   `npm view @projeto-zero/cli dist.attestations` that it published and has
   provenance.
3. After one successful OIDC release:
   - delete the `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` env from the
     publish step,
   - delete the `NPM_TOKEN` repository secret and revoke that token on npm,
   - in the package's Publishing access settings, choose "Require two-factor
     authentication and disallow tokens".
4. Separately, confirm the two npm tokens recorded as leaked in
   `audit/STAGE_0_SIGNOFF.md` (T1/T2) are revoked (`npm token list`), and
   tick them with evidence.
5. Optional: add a tag ruleset so only the owner can push `v*` tags. A
   protected `release` environment with required reviewers adds little on a
   single-maintainer repo.
