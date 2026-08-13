# jira-axi

Agent-ergonomic CLI for Jira Cloud.
It emits [TOON](https://github.com/toon-format/toon) instead of JSON, declares its schema once per table instead of once per record, and pre-computes the aggregates an agent would otherwise derive across several calls (`sprint current`, `issue tree`, and more).
v1 is read-only.

Built to the [AXI](https://github.com/kunchenguid/axi) design principles: a plain CLI in place of an MCP server's standing tool-schema tax, with a small live-data hook at session start instead of a wall of tool descriptions.

See [ADR-0001](docs/adr/adr-0001-build-jira-axi-as-an-axi-style-cli.md) for why this exists instead of the Atlassian MCP, [ADR-0002](docs/adr/adr-0002-oauth-2-3lo-shared-app-for-jira-cloud-auth.md) for how authentication works, and [ADR-0003](docs/adr/adr-0003-backend-token-exchange-proxy-for-oauth-client-secret.md) for how the OAuth `client_secret` is kept out of this repository via the token-exchange proxy in [`proxy/`](proxy/README.md).

## Install

```sh
npm install -g github:mrbarboza/nu-jira-axi
```

Requires Node.js 20+.

## Quickstart

```sh
# Register a Jira Cloud site
jira-axi site add work acme.atlassian.net

# Authorize via OAuth 2.0 (3LO) — opens a browser, one click
jira-axi setup auth --site work

# Confirm who you're authenticated as
jira-axi user whoami

# Read
jira-axi issue list --mine
jira-axi sprint current --project PROJ
```

The target site resolves per invocation, in order: `--site`, `JIRA_AXI_SITE`, the nearest `./.jira-axi.json`, then `defaultSite` in `~/.jira-axi/config.json`.
Run `jira-axi --help` or `jira-axi <command> --help` for the full command list.

If you authorized before this CLI's OAuth scope set last changed, `sprint`/`board` commands will 401 until you re-run `jira-axi setup auth --site <site>` to pick up the current scopes. `sprint`/`board` call the Agile REST API (`/rest/agile/1.0/...`), which is covered by the classic `read:jira-work` scope - the granular `read:board-scope:jira-software`/`read:sprint:jira-software` scopes were tried and dropped (see `src/oauth-app-config.ts`) because `GET /rest/agile/1.0/sprint/{id}/issue` 401s ("scope does not match") even when granted.

## Commands

`site`, `setup`, `user`, `issue`, `sprint`, `board`, `project`, `filter`, `search`, `api`.

## Design docs

- [ADR-0001: Build jira-axi as an AXI-Style CLI Instead of the Atlassian MCP](docs/adr/adr-0001-build-jira-axi-as-an-axi-style-cli.md)
- [ADR-0002: Migrate Jira Cloud Auth to OAuth 2.0 (3LO) via One Shared App](docs/adr/adr-0002-oauth-2-3lo-shared-app-for-jira-cloud-auth.md)
- [ADR-0003: Move the OAuth Client Secret Out of Public Source via a Backend Token-Exchange Proxy](docs/adr/adr-0003-backend-token-exchange-proxy-for-oauth-client-secret.md)

## License

[MIT](LICENSE)
