# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.
- Distribution is GitHub-direct install (`npm install -g github:mrbarboza/jira-axi`), not the npm registry. `dist/` IS committed (see `.gitignore`) and there is no `prepare`/`build`-at-install-time step - do not reintroduce one. Do not reintroduce npm-registry publishing (release-please, `publishConfig`, scoped package name) without an explicit decision to switch back.
- Do not name any root `package.json` script `build`. In the npm version this project has been tested against, `npm install -g github:...` auto-detects a script literally named `build` and tries to run an implicit build for git installs, independent of any `prepare` script; that implicit-build path is broken and leaves `node_modules/jira-axi` a dangling symlink into an already-deleted git-clone tmp dir, so the installed bin is missing. The compile script is named `compile` (`npm run compile` runs `tsc`) specifically to avoid this. Re-verify with a real `npm install -g --prefix <tmp> github:mrbarboza/jira-axi#<branch>` (not just `npm run compile`) before changing script names or the build/install setup.
- `axi-sdk-js`'s `runAxiCli` (see `resolveContext` in `src/cli.ts`) does NOT wrap its call to the `resolveContext` hook in a try/catch, unlike command handlers. Any error thrown from `resolveContext` (e.g. `resolveSiteOrUndefined`) crashes the process uncaught instead of rendering like a normal `AxiError`. `main()` in `src/cli.ts` works around this by validating `--site` up front and rendering `AxiError` itself before calling `runAxiCli`. Keep that pre-check in sync with whatever `resolveContext` actually validates.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
