# ADR-0003: Move the OAuth Client Secret Out of Public Source via a Backend Token-Exchange Proxy

**Date:** 2026-08-10
**Status:** Accepted
**Deciders:** Miguel Barboza

---

## Context

ADR-0002 decided to commit jira-axi's shared Atlassian OAuth 2.0 (3LO) app's `client_id` and `client_secret` directly in `src/oauth-app-config.ts`, in the public `mrbarboza/jira-axi` repository.
The stated rationale, repeated in that file's header comment, is that the redirect always lands back on the machine that started the flow, so the secret does not gate anything for this threat model: anyone who already has the source can run their own login, and the secret never has to leave the machine that completed the exchange.
Open PR #1 ("Wire real OAuth app credentials into oauth-app-config.ts") is waiting to commit the real registered secret value on this reasoning.

This task re-verified that reasoning against OAuth theory and against Atlassian's own published policy, rather than assuming ADR-0002's conclusion still holds.

On the theory side, ADR-0002's redirect-locality argument holds up and is not new: RFC 6749 already defines the client identifier as non-secret and defines "public clients" as those incapable of maintaining confidentiality of credentials, such as an app executing on the resource owner's own device.
RFC 8252 (OAuth 2.0 for Native Apps) formalizes this for installed/CLI apps specifically and prescribes PKCE as the substitute integrity mechanism precisely because such apps cannot keep a secret confidential.
ADR-0002 already confirmed Atlassian's 3LO flow offers neither PKCE nor a public-client mode, so jira-axi has no way to get the RFC 8252-recommended mechanism even if it wanted to.
Nothing in the general OAuth literature contradicts ADR-0002 on this point.

The new finding is a separate, Atlassian-specific constraint that ADR-0002 did not surface.
Atlassian's Marketplace Security Enforcement Policy (`developer.atlassian.com/platform/marketplace/marketplace-security-enforcement-policy/`) states plainly: do not hardcode `client_secret` values in source code, configuration files, or any client-side artifact that can be inspected by an end user, and store OAuth client secrets in an encrypted secret store or managed key management system instead.
Atlassian's companion "Security guidelines for Marketplace apps" page is more specific still: client secrets "should not be stored in public code repositories."
Both pages describe Atlassian as actively enforcing this, including "automated security scanning of app artifacts" and rotation-on-suspected-exposure requirements.

The question is whether that policy's scope actually reaches jira-axi, since jira-axi is not pursuing a public Atlassian Marketplace listing.
It does reach jira-axi.
ADR-0002's own Consequences section commits to having the maintainer "pursue Atlassian's review process so users are not shown an 'unreviewed app' warning on the consent screen."
Atlassian's developer documentation confirms that clearing the unreviewed-app warning requires submitting the app through the same Marketplace review/approval pipeline used for listed apps — an informational-only listing is enough, a public storefront entry is not required, but it is the identical review process the security enforcement policy governs.
So the plan ADR-0002 already commits to walks jira-axi's OAuth app directly into the scope of a policy that forbids the exact thing `src/oauth-app-config.ts` currently does and PR #1 is about to complete.

This is a compliance and availability risk, not a change to the exploitability argument ADR-0002 made.
Nobody gains the ability to complete a remote authorization they couldn't already complete by reading the public source; the redirect-locality argument is unaffected.
What changes is that Atlassian itself, independent of any attacker, can flag the exposed secret via its own scanning or during manual review, and revoke or refuse to approve the app's credentials on policy grounds.
ADR-0002 already names "the maintainer permanently owns and operates one Atlassian developer app; if that app registration ... is disabled or suspended, every jira-axi user's authentication breaks at the same time" as a known single point of failure.
A publicly committed secret is a second, self-inflicted way to trigger that exact failure mode, on top of the one ADR-0002 already accepted.

## Decision

Propose introducing a small backend token-exchange proxy that the maintainer hosts and that alone holds the real `client_secret`, as a server-side environment secret, never committed to the jira-axi repository.
The CLI keeps everything else ADR-0002 already decided: the local `http://localhost:{port}/callback` redirect listener during `setup`, the authorization-code 3LO flow shape, `cloudId` resolution via `/oauth/token/accessible-resources`, and Bearer-token requests against the `api.atlassian.com/ex/jira/{cloudId}/...` gateway.
Only the token-exchange step changes: instead of the CLI calling Atlassian's token endpoint directly with an embedded `client_id`/`client_secret`, the CLI's local listener forwards the received authorization code to the proxy over HTTPS; the proxy performs the code-for-token exchange with Atlassian using the secret it holds server-side, and returns the resulting access token, refresh token, and expiry to the CLI, which persists them to the keychain exactly as ADR-0002 already specifies.
Refresh-token rotation is routed through the same proxy endpoint rather than directly to Atlassian, since a rotated refresh token also requires `client_id`/`client_secret` to redeem.
`client_id` remains fine to keep in source, consistent with RFC 6749 treating it as non-secret; only `client_secret` moves server-side.

## Consequences

### Positive

- Removes the one concrete, currently-live risk this research surfaced: the secret is never present in the public git history or any published package artifact, so it cannot be caught by Atlassian's own automated scanning or manual review and used as grounds to reject or suspend the app.
- Keeps ADR-0002's core engineering shape intact: no PKCE, no device-code grant, no per-user app, one shared OAuth app; this ADR only relocates custody of one value.
- Unblocks pursuing Atlassian's app review (already planned in ADR-0002) without a known, avoidable non-compliance sitting in front of it.

### Negative / Trade-offs

- Adds a hosted service the maintainer must run, secure, and keep available; every `setup` login and every refresh-token rotation now depends on that service's uptime, which is a new single point of failure layered on top of the one ADR-0002 already accepted for the shared Atlassian app itself.
- The proxy becomes an additional secret-bearing system to operate correctly: TLS, secret-at-rest storage, and abuse/rate-limit protection all become the maintainer's problem in a place they were not before.
- This is real, ongoing operational cost with no change to the redirect-locality threat model ADR-0002 analyzed; the benefit is specifically compliance with Atlassian's policy and resilience against Atlassian-side enforcement, not a reduction in what a local attacker with source access could already do.
- Blocks or requires revisiting PR #1, which would otherwise commit the live secret into `src/oauth-app-config.ts` on the reasoning this ADR revises.

### Neutral

- Does not change scopes, `REDIRECT_URI`, or `CALLBACK_PORT` from ADR-0002.
- Does not change v1's read-only scope from ADR-0001.
- `client_id` continues to be committed in source; only `client_secret` moves.

## Alternatives Considered

| Option | Reason rejected |
|--------|-----------------|
| Status quo: keep `client_secret` committed in `src/oauth-app-config.ts` (ADR-0002 as implemented by PR #1) | Technically sound against the redirect-locality threat model, but conflicts with Atlassian's Marketplace Security Enforcement Policy, which governs exactly the app-review process ADR-0002 already commits to pursuing; risks review rejection or after-the-fact suspension by Atlassian's own scanning. |
| Inject the secret at build/publish time via a CI secret store instead of committing it to git | Only moves where the exposure happens; the published, installable CLI artifact (npm package or binary) would still embed the plaintext secret for any installer to read, so Atlassian's policy language — "or any client-side artifact that can be inspected by an end user" — is still violated. Removes the secret from git history, which is a real improvement, but does not resolve the policy conflict, so it was set aside in favor of the proxy, which does. |
| Public client / PKCE without a client secret | Still unavailable; ADR-0002's research on this is unchanged and was not revisited here. |
| OAuth Device Authorization Grant (RFC 8628) | Still absent from Atlassian's OAuth documentation; unchanged from ADR-0002. |

## Implementation

The proxy lives at `proxy/`, a self-contained Node/TypeScript HTTP service with two endpoints (`/token/exchange`, `/token/refresh`) plus a `/healthz` check; see `proxy/README.md` for how it runs, tests, and deploys, and why a plain Node server was picked over a Cloudflare Worker.
`src/oauth-app-config.ts` no longer declares `CLIENT_SECRET`; it declares `OAUTH_PROXY_URL` instead, overridable via `JIRA_AXI_OAUTH_PROXY_URL`.
`src/oauth.ts`'s `exchangeCodeForToken` and `refreshAccessToken` now call the proxy's two endpoints instead of `https://auth.atlassian.com/oauth/token` directly; the proxy attaches `client_id`/`client_secret` server-side before forwarding to Atlassian.
This supersedes PR #1, which would have committed the real secret into `src/oauth-app-config.ts` on the reasoning this ADR revises; PR #1 should be closed without merging.

## References

- ADR-0002: Migrate Jira Cloud Auth to OAuth 2.0 (3LO) via One Shared App — `docs/adr/adr-0002-oauth-2-3lo-shared-app-for-jira-cloud-auth.md`
- Proxy implementation: `proxy/` (`proxy/README.md`, `proxy/src/server.ts`)
- CLI call sites: `src/oauth-app-config.ts`, `src/oauth.ts`
- Open PR superseded by this ADR's implementation: #1, "Wire real OAuth app credentials into oauth-app-config.ts"
- Atlassian Marketplace Security Enforcement Policy: https://developer.atlassian.com/platform/marketplace/marketplace-security-enforcement-policy/
- Atlassian Security guidelines for Marketplace apps: https://developer.atlassian.com/platform/marketplace/app-security-guidelines/
- Atlassian: Managing your OAuth 2.0 (3LO) apps (distribution, sharing, and the review process that clears the "unreviewed app" warning): https://developer.atlassian.com/cloud/oauth/getting-started/managing-oauth-apps/
- RFC 6749, The OAuth 2.0 Authorization Framework (client types, client identifier is not a secret): https://www.rfc-editor.org/info/rfc6749/
- RFC 8252, OAuth 2.0 for Native Apps: https://datatracker.ietf.org/doc/rfc8252/
