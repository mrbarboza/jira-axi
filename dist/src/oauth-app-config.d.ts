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
export declare const CLIENT_ID = "fI4zUGgi4jZTfXgNp1UobLrfCa1M065L";
/** Must exactly match the redirect URI registered at developer.atlassian.com. */
export declare const CALLBACK_PORT = 51703;
export declare const REDIRECT_URI = "http://localhost:51703/callback";
/** Read-only Jira Cloud scopes, matching ADR-0001's read-only v1 scope. */
export declare const SCOPES = "read:jira-work read:jira-user offline_access";
/**
 * Base URL of the deployed token-exchange proxy (ADR-0003). Overridable via
 * `JIRA_AXI_OAUTH_PROXY_URL` for local development against `proxy/` or a
 * self-hosted instance.
 */
export declare const OAUTH_PROXY_URL: string;
