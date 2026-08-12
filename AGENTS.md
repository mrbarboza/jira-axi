# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.
- Distribution is GitHub-direct install (`npm install -g github:mrbarboza/jira-axi`), not the npm registry. `dist/` is not committed; `package.json`'s `prepare` script runs `build` so a git-based install still compiles. Do not reintroduce npm-registry publishing (release-please, `publishConfig`, scoped package name) without an explicit decision to switch back.
- `axi-sdk-js`'s `runAxiCli` (see `resolveContext` in `src/cli.ts`) does NOT wrap its call to the `resolveContext` hook in a try/catch, unlike command handlers. Any error thrown from `resolveContext` (e.g. `resolveSiteOrUndefined`) crashes the process uncaught instead of rendering like a normal `AxiError`. `main()` in `src/cli.ts` works around this by validating `--site` up front and rendering `AxiError` itself before calling `runAxiCli`. Keep that pre-check in sync with whatever `resolveContext` actually validates.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
