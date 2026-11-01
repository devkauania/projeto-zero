#!/usr/bin/env node
// pack-smoke.mjs — installs the tarball a release would publish and uses it.
// pack-sanity only reads the file list, so a package missing its shebang, a bin,
// a runtime dependency or the seed still passed it: inside this repo the
// hoisted node_modules and the walk up to .agents/ hide all of those. Here the
// install is in a temp prefix outside the repo, with a space and an accent in
// its path, and every command goes through the bin an installed user would run.
//
// Needs network access for the package's dependencies, and a current build.

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { builtinModules } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const CLI_DIR = join(REPO_ROOT, "apps", "cli");
const WIN = process.platform === "win32";

const problems = [];
const check = (ok, what) => {
  if (!ok) problems.push(what);
};

function quote(arg) {
  return /[\s"&()^%!]/.test(arg) ? `"${arg}"` : arg;
}

/** Run a program, going through cmd.exe only for the .cmd shims Windows needs. */
function run(bin, args, opts = {}) {
  const res = WIN
    ? spawnSync([quote(bin), ...args.map(quote)].join(" "), {
        ...opts,
        encoding: "utf8",
        shell: true,
      })
    : spawnSync(bin, args, { ...opts, encoding: "utf8" });
  return { code: res.status, out: `${res.stdout ?? ""}${res.stderr ?? ""}` };
}

function main() {
  const version = JSON.parse(readFileSync(join(CLI_DIR, "package.json"), "utf8")).version;
  const base = mkdtempSync(join(tmpdir(), "pz pack ação "));
  const prefix = join(base, "global prefix");
  mkdirSync(prefix);

  try {
    // Straight into the temp folder. Moving it there afterwards fails with EXDEV
    // when the repo and temp are on different drives, as on a Windows CI runner.
    const packed = run("npm", ["pack", "--silent", "--pack-destination", base], { cwd: CLI_DIR });
    const name = packed.out.trim().split(/\r?\n/).pop();
    if (packed.code !== 0 || !name?.endsWith(".tgz")) {
      problems.push(`npm pack failed: ${packed.out}`);
      return;
    }
    const tarball = join(base, name);

    const installed = run(
      "npm",
      ["install", "--global", "--prefix", prefix, "--no-audit", "--no-fund", tarball],
      { cwd: base }
    );
    if (installed.code !== 0) {
      problems.push(`npm install of the tarball failed: ${installed.out}`);
      return;
    }

    const binDir = WIN ? prefix : join(prefix, "bin");
    const shim = (b) => join(binDir, WIN ? `${b}.cmd` : b);
    const pkgRoot = join(
      prefix,
      ...(WIN ? [] : ["lib"]),
      "node_modules",
      "@projeto-zero",
      "cli"
    );

    const entry = join(pkgRoot, "dist", "index.js");
    check(
      existsSync(entry) && readFileSync(entry, "utf8").startsWith("#!/usr/bin/env node"),
      "dist/index.js does not start with the node shebang"
    );
    check(
      existsSync(join(pkgRoot, "dist", "default-wizard-config.json")),
      "the seed is not in the published package (dist/default-wizard-config.json)"
    );

    const manifest = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8"));
    check(
      typeof manifest.main === "string" && existsSync(join(pkgRoot, manifest.main)),
      `main points at ${manifest.main}, which is not in the package`
    );
    const declared = Object.keys(manifest.dependencies ?? {});
    for (const file of readdirSync(join(pkgRoot, "dist"), { recursive: true, encoding: "utf8" })) {
      if (!file.endsWith(".js")) continue;
      const code = readFileSync(join(pkgRoot, "dist", file), "utf8");
      for (const [, spec] of code.matchAll(/(?:from\s+|import\s*\(?\s*)["']([^"']+)["']/g)) {
        if (spec.startsWith(".") || spec.startsWith("node:") || builtinModules.includes(spec)) continue;
        const name = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];
        check(declared.includes(name), `dist/${file} imports ${name}, which is not in dependencies`);
      }
    }

    for (const bin of ["projeto-zero", "antigravity"]) {
      if (!existsSync(shim(bin))) {
        problems.push(`bin ${bin} was not installed`);
        continue;
      }
      const v = run(shim(bin), ["--version"], { cwd: base });
      check(
        v.code === 0 && v.out.trim() === version,
        `${bin} --version: expected ${version}, got code ${v.code}: ${v.out.trim()}`
      );
    }
    const cli = shim("projeto-zero");

    const help = run(cli, ["--help"], { cwd: base });
    for (const command of ["init", "generate", "info", "reset", "swarm"]) {
      check(help.out.includes(command), `--help does not list ${command}`);
    }

    const cfgDir = join(base, "cfg");
    const env = { ...process.env, ANTIGRAVITY_CONFIG_DIR: cfgDir };
    const init = run(cli, ["init"], {
      cwd: base,
      env,
      input: "smoke-app\ncoder mcp\ny\n",
    });
    check(init.code === 0, `init exited ${init.code}: ${init.out}`);
    const saved = existsSync(join(cfgDir, "config.json"))
      ? JSON.parse(readFileSync(join(cfgDir, "config.json"), "utf8")).wizard
      : null;
    check(saved?.projectName === "smoke-app", "init did not save the project name");
    check(
      saved?.defaults?.targetDir === ".",
      "init saved no seed defaults: the installed package cannot find its seed"
    );

    const target = join(base, "target dir");
    const gen = run(cli, ["generate", "-d", target], { cwd: base, env });
    check(gen.code === 0, `generate exited ${gen.code}: ${gen.out}`);
    for (const f of ["CLAUDE.md", ".agents/coder.md", ".agents/mcp.md", "skills/mcp/SKILL.md"]) {
      check(existsSync(join(target, f)), `generate did not write ${f}`);
    }

    writeFileSync(join(target, ".agents", "prompts", "task.md"), "# Task\n");
    const dry = run(cli, ["swarm", "--count", "1"], { cwd: target, env });
    check(dry.code === 0, `swarm dry-run exited ${dry.code}: ${dry.out}`);
    check(dry.out.includes("--permission-mode"), "swarm dry-run printed no argv");
  } finally {
    rmSync(base, { recursive: true, force: true, maxRetries: 3 });
  }
}

main();

if (problems.length === 0) {
  console.log("PASS pack-smoke: the installed package runs through both bins.");
  process.exit(0);
}
console.log(`FAIL pack-smoke: ${problems.length} issue(s):`);
for (const p of problems) console.log(`  ${p}`);
process.exit(1);
