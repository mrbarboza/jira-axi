/**
 * Identity of nu-jira-axi's single shared Atlassian OAuth 2.0 (3LO) app
 * (ADR-0002). `client_id` is not a secret (RFC 6749) and is fine to commit.
 *
 * `client_secret` is deliberately NOT here. Per ADR-0003, it lives only as a
 * runtime environment variable on the token-exchange proxy in `proxy/`
 * (never committed, never shipped in this CLI's published artifact); the CLI
 * sends the authorization code and refresh token to that proxy instead of
 * calling Atlassian's token endpoint directly. See `src/oauth.ts`.
 */
export const CLIENT_ID = "fI4zUGgi4jZTfXgNp1UobLrfCa1M065L";
/** Must exactly match the redirect URI registered at developer.atlassian.com. */
export const CALLBACK_PORT = 51703;
export const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}/callback`;
/**
 * Read-only Jira Cloud scopes, matching ADR-0001's read-only v1 scope.
 *
 * The granular `*:jira-software` scopes (`read:board-scope:jira-software`,
 * `read:sprint:jira-software`) were tried for the Agile REST API
 * (`/rest/agile/1.0/...`, used by `sprint`/`board`) but are unreliable there:
 * `GET /rest/agile/1.0/sprint/{id}/issue` 401s with
 * `{"code":401,"message":"Unauthorized; scope does not match"}` even when
 * `read:sprint:jira-software` is granted - Atlassian's own docs list the
 * *write* scope `write:sprint:jira-software` as required for that GET
 * endpoint, and community reports describe granular `*:jira-software` scopes
 * as broadly unreliable against `/rest/agile/1.0/*`. Requesting a write scope
 * for a read-only GET call would also conflict with this CLI's read-only v1
 * posture (ADR-0001), so that path was rejected.
 *
 * Per Atlassian's own recommendation, Agile REST calls instead rely on the
 * classic `read:jira-work` scope, same as the platform REST API
 * (`/rest/api/3/...`). `read:board-scope:jira-software` and
 * `read:sprint:jira-software` were dropped entirely.
 *
 * This changes the requested scope set, so existing users must re-run
 * `setup auth` to re-consent; a previously issued token keeps its original
 * scope until re-authorized.
 */
export const SCOPES = "read:jira-work read:jira-user read:project:jira offline_access";
/**
 * Base URL of the deployed token-exchange proxy (ADR-0003). Overridable via
 * `JIRA_AXI_OAUTH_PROXY_URL` for local development against `proxy/` or a
 * self-hosted instance.
 */
export const OAUTH_PROXY_URL = process.env.JIRA_AXI_OAUTH_PROXY_URL ?? "https://jira-axi.onrender.com";
//# sourceMappingURL=oauth-app-config.js.map