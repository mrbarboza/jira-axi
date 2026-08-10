# ADR-0002: Migrate Jira Cloud Auth to OAuth 2.0 (3LO) via One Shared App

**Date:** 2026-08-07
**Status:** Accepted
**Deciders:** Miguel Barboza

---

## Context

ADR-0001 shipped v1 authenticated with an Atlassian API token, one per site, stored in the macOS keychain and sent as Basic Auth alongside the operator's email.
That ADR already flagged the likely follow-up: "Swapping to OAuth 3LO later touches one module."
The token model has held up, but manual creation and rotation of a personal API token is friction for some users, and that friction is the reason to revisit it now rather than the token being technically broken.

`src/client.ts` builds every request as `Authorization: Basic ${base64(email:token)}` against `https://${this.host}` directly, and its constructor throws `missingEmailError` if `options.site.email` is absent.
`src/context.ts` documents `SiteContext.email` as "required for Basic Auth against Jira Cloud."
Both of those become stale the moment auth stops being Basic.

Before picking a replacement, the current Atlassian developer docs for OAuth 2.0 (3LO) were read directly rather than assumed, since the obvious CLI-friendly options turned out not to apply.
There is no PKCE or public-client support: the token exchange always requires `client_id` and `client_secret`, unlike the flows GitHub or Google offer their CLIs.
There is also no OAuth Device Authorization Grant (RFC 8628), the flow `gh auth login` and `aws sso login` use to avoid a local redirect listener entirely; it is confirmed absent from Atlassian's current documentation.
That leaves the authorization-code 3LO flow with a local `http://localhost:{port}/callback` redirect as the only viable shape for a CLI, which carries its own plumbing regardless of who owns the app: a local HTTP listener during `setup`, REST calls routed through the `api.atlassian.com/ex/jira/{cloudId}/...` gateway instead of the site host directly (`cloudId` resolved once via `/oauth/token/accessible-resources` and cached per site), and rotating refresh tokens that must be persisted to the keychain on every request, since each refresh invalidates the one before it and inactivity for 90 days ends the session.

Because the redirect always lands back on the same machine that started the flow, the client secret does not gate anything for a locally-run, open-source CLI.
Anyone who already has the source has everything needed to run their own login; the secret only asserts which app family is talking to Atlassian, and it never has to leave the machine that already completed the exchange.
That ruled out secret custody as the deciding factor between the two ways to shape this: one OAuth app shared across every jira-axi user, or one OAuth app per user, self-registered the way a personal API token is created today.

Atlassian's own docs settle that choice directly.
They state that apps which "collect API tokens or instruct customers to create individual 3LO apps" do not comply with Atlassian's security requirements and acceptable use policy, and they recommend a single, distributable 3LO app per integration instead.
The per-user-app shape is exactly the discouraged pattern, despite being the operationally simpler one for a maintainer with no infrastructure today.

This decision was made interactively, reviewing options A (status quo), B (one shared app), and C (per-user app) side by side in an annotated comparison artifact, not against a working code diff.
No implementation has started: `src/client.ts` still authenticates with Basic Auth as of this ADR.

## Decision

We will migrate jira-axi's Jira Cloud authentication from Basic Auth with a manually-created API token to OAuth 2.0 (3LO), using a single OAuth app registered and owned by the jira-axi maintainer rather than one app per user.
The maintainer registers the app at developer.atlassian.com, enables sharing so any user can authorize it, and pursues Atlassian's review process so users are not shown an "unreviewed app" warning on the consent screen.
`setup` gains a local redirect listener that drives the authorization-code exchange, `SiteContext.email` is dropped in favor of a per-site `cloudId`, and `client.ts` moves from `Authorization: Basic` against `https://${this.host}` to `Authorization: Bearer ${accessToken}` against `https://api.atlassian.com/ex/jira/${cloudId}/`, with the keychain now holding a rotating refresh token instead of a static one.

## Consequences

### Positive

- A user runs `setup`, clicks "Allow" once in the browser, and never manually creates, copies, or rotates a credential again; the CLI refreshes silently in the background.
- The chosen shape is the one Atlassian's own acceptable-use policy names as compliant, so jira-axi is not built on guidance Atlassian has told integrators not to follow.
- One app is easier to reason about and to eventually submit for Atlassian's Marketplace-adjacent review than coaching every user through their own app registration.

### Negative / Trade-offs

- The maintainer now permanently owns and operates one Atlassian developer app; if that app registration or the maintainer's Atlassian account is disabled or suspended, every jira-axi user's authentication breaks at the same time, a single point of failure the token model and the per-user-app alternative both avoided.
- Until the app clears Atlassian's review, every user sees an "unreviewed app" warning on the consent screen the first time they authorize.
- `client.ts` and `context.ts` both change on the request-path hot code: the email-based constructor check, the Basic Auth header, and the direct-to-host URL all go away, replaced by cloudId resolution, a gateway base URL, and Bearer tokens; `setup` gains a local HTTP listener it did not need before.
- Refresh tokens rotate on every use and expire after 90 days of inactivity, so the keychain write path must persist the new refresh token on every single request that uses one, not just at login, or a stale token silently breaks the next refresh.

### Neutral

- Server/Data Center Jira (which uses Basic Auth, cookie sessions, OAuth 1.0a, or Bearer PATs depending on version) is out of scope; jira-axi targets Jira Cloud only, and `SiteContext.host` is documented as a Cloud host.
- This ADR does not change v1's read-only scope from ADR-0001; it only changes how a request authenticates, not what it is allowed to do.

### Superseded in part by ADR-0003

This ADR originally called for committing `client_id` and `client_secret` together in `src/oauth-app-config.ts`.
ADR-0003 revisits that: `client_secret` now lives only as a runtime environment variable on a backend token-exchange proxy (`proxy/`), never in this repository's source or history.
`client_id` is unaffected and stays committed here, since it is not a secret.
Everything else this ADR decided — the shared app, the local redirect listener, `cloudId` resolution, Bearer-token requests, rotating refresh tokens in the keychain — is unchanged.

## Alternatives Considered

| Option | Reason rejected |
|--------|-----------------|
| A — Keep Basic Auth with a manual API token (status quo) | Not technically broken, but the manual creation and periodic re-paste on rotation is exactly the friction this ADR exists to remove. |
| C — OAuth 2.0 (3LO), one self-registered app per user | Operationally simpler for the maintainer (no shared app to own, no review dependency, and any one user's failure stays isolated to that user), but it is the precise pattern Atlassian's developer docs name as non-compliant with their security requirements and acceptable use policy: "apps that collect API tokens or instruct customers to create individual 3LO apps." Rejected on policy grounds, not on engineering merit. |
| Public client / PKCE without a client secret | Not offered by Atlassian's 3LO implementation at all; the token exchange unconditionally requires a `client_id` and `client_secret`. |
| OAuth Device Authorization Grant (RFC 8628), as used by `gh auth login` / `aws sso login` | Confirmed absent from Atlassian's current OAuth documentation; no device-code endpoint exists to poll. |
| Server/Data Center-style PAT (Bearer token) auth | Belongs to Jira Server/Data Center's auth model, not Jira Cloud, which is what jira-axi targets; surfaced early in the exploration and set aside as out of scope. |

## References

- ADR-0001: Build jira-axi as an AXI-Style CLI Instead of the Atlassian MCP — `docs/adr/adr-0001-build-jira-axi-as-an-axi-style-cli.md`
- ADR-0003: Move the OAuth Client Secret Out of Public Source via a Backend Token-Exchange Proxy — `docs/adr/adr-0003-backend-token-exchange-proxy-for-oauth-client-secret.md`
- Atlassian OAuth 2.0 (3LO) apps: https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/
- Decision review artifact (Lavish comparison, options A/B/C): `.lavish/jira-auth-oauth-tradeoffs.html`
- Current implementation being replaced: `src/client.ts`, `src/context.ts`, `src/keychain.ts`
