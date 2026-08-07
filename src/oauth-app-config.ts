/**
 * Identity of jira-axi's single shared Atlassian OAuth 2.0 (3LO) app
 * (ADR-0002). The client secret does not gate anything for a locally-run,
 * open-source CLI — the redirect always lands back on the machine that
 * started the flow, so anyone with the source can already run their own
 * login. It is committed here rather than injected at build time because
 * hiding it would add moving parts without any confidentiality benefit.
 */
export const CLIENT_ID = "REPLACE_WITH_REGISTERED_CLIENT_ID";
export const CLIENT_SECRET = "REPLACE_WITH_REGISTERED_CLIENT_SECRET";

/** Must exactly match the redirect URI registered at developer.atlassian.com. */
export const CALLBACK_PORT = 51703;
export const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}/callback`;

/** Read-only Jira Cloud scopes, matching ADR-0001's read-only v1 scope. */
export const SCOPES = "read:jira-work read:jira-user offline_access";
