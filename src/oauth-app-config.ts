/**
 * Identity of jira-axi's single shared Atlassian OAuth 2.0 (3LO) app
 * (ADR-0002). `client_id` is not a secret (RFC 6749) and is fine to commit.
 *
 * `client_secret` is deliberately NOT here. Per ADR-0003, it lives only as a
 * runtime environment variable on the token-exchange proxy in `proxy/`
 * (never committed, never shipped in this CLI's published artifact); the CLI
 * sends the authorization code and refresh token to that proxy instead of
 * calling Atlassian's token endpoint directly. See `src/oauth.ts`.
 */
export const CLIENT_ID = "REPLACE_WITH_REGISTERED_CLIENT_ID";

/** Must exactly match the redirect URI registered at developer.atlassian.com. */
export const CALLBACK_PORT = 51703;
export const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}/callback`;

/** Read-only Jira Cloud scopes, matching ADR-0001's read-only v1 scope. */
export const SCOPES = "read:jira-work read:jira-user offline_access";

/**
 * Base URL of the deployed token-exchange proxy (ADR-0003). Overridable via
 * `JIRA_AXI_OAUTH_PROXY_URL` for local development against `proxy/` or a
 * self-hosted instance.
 */
export const OAUTH_PROXY_URL =
  process.env.JIRA_AXI_OAUTH_PROXY_URL ?? "https://REPLACE_WITH_DEPLOYED_PROXY_HOST";
