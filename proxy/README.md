# jira-axi OAuth proxy

Backend token-exchange proxy for jira-axi's shared Atlassian OAuth 2.0 (3LO) app, per [ADR-0003](../docs/adr/adr-0003-backend-token-exchange-proxy-for-oauth-client-secret.md).

## What this is

This is the only place `CLIENT_SECRET` exists at runtime.
The jira-axi CLI still runs the full authorization-code flow itself: it opens the browser, listens on `http://localhost:{port}/callback`, and receives the authorization code.
It just no longer calls Atlassian's token endpoint directly with an embedded secret.

Instead, the CLI sends the authorization code (or a refresh token) to this proxy over HTTPS, and the proxy performs the actual `code`-for-token or refresh-token exchange with Atlassian, using the secret it holds as a server-side environment variable.
The response (access token, refresh token, expiry, scope) is passed back to the CLI unchanged, which persists it to the OS keychain exactly as before.

This service is stateless.
It holds no database and no session state; every request is independent.

## Endpoints

- `POST /token/exchange` — body `{ "code": "<authorization code>" }`. Performs an `authorization_code` grant.
- `POST /token/refresh` — body `{ "refresh_token": "<refresh token>" }`. Performs a `refresh_token` grant.
- `GET /healthz` — liveness check, returns `{ "status": "ok" }`.

Both `/token/*` endpoints return the upstream Atlassian response body on success (`access_token`, `refresh_token`, `expires_in`, `scope`), and return `400` for a malformed request or the upstream's status with `{ "error": "upstream_error", "detail": "..." }` when Atlassian rejects the grant.
A per-source-IP fixed-window rate limit (`RATE_LIMIT_PER_MINUTE`, default 30) returns `429` once exceeded.

## Why a plain Node/TypeScript HTTP server

The service is two stateless JSON endpoints with no database, so the choice was between a minimal Node HTTP server and a Cloudflare Worker.
Node was picked because it matches the stack already used everywhere else in this repository (the CLI itself is Node/TypeScript, and its local OAuth callback listener in `src/oauth.ts` already uses the same `node:http` primitives this proxy uses), it needs no separate account or platform (Cloudflare) for a solo maintainer to operate, and it can be deployed to any plain Node host without picking up a runtime-specific API surface. A Worker would have worked too, but it would add a second toolchain and a second deployment target for no capability this proxy actually needs (no edge KV, no cron, no Workers-specific API).

## Running locally

```
cd proxy
npm install
cp .env.example .env   # fill in the real ATLASSIAN_CLIENT_ID / ATLASSIAN_CLIENT_SECRET
npm run dev
```

The server listens on `PORT` (default `8787`).
To exercise it against a real Atlassian app, point the CLI's proxy base URL (see the root README / `src/oauth-app-config.ts`) at `http://localhost:8787` and run `jira-axi setup auth`.

## Testing

```
npm test
```

Tests inject a fake `fetch` and a fake clock, so they never make a real network call to Atlassian and never depend on wall-clock time.

## Building

```
npm run build   # emits dist/
npm start        # runs dist/index.js
```

## Deploying

This is a single stateless process reading five environment variables (see `.env.example`), so it fits any platform that can run a long-lived Node process and inject environment variables as secrets: Fly.io, Render, Railway, a systemd unit on a small VM, or a container on any orchestrator.
There is no database to provision and no persistent volume to attach.

Whichever platform is used:

- Set `ATLASSIAN_CLIENT_ID`, `ATLASSIAN_CLIENT_SECRET`, and `ATLASSIAN_REDIRECT_URI` as platform secrets, never committed to source.
- `ATLASSIAN_REDIRECT_URI` must exactly match the redirect URI registered for the app at developer.atlassian.com and the `REDIRECT_URI` the CLI uses (`src/oauth-app-config.ts`).
- Terminate TLS at the platform edge (all of the platforms above do this by default for a custom or provided domain); this proxy itself speaks plain HTTP and assumes TLS is handled in front of it.
- Point the CLI's proxy base URL at the deployed HTTPS origin.

Redeploys are safe at any time: the service holds no state between requests, so restarting it only resets the in-memory rate-limit windows.
