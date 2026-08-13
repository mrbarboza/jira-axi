import { AxiError } from "axi-sdk-js";

export function missingSiteError(): AxiError {
  return new AxiError(
    "no Jira site resolved: pass --site, set JIRA_AXI_SITE, or add a default site",
    "SITE_NOT_RESOLVED",
    [
      "Run `nu-jira-axi site add <alias> <host>` to register a site",
      "Run `nu-jira-axi site use <alias>` to set it as default",
    ],
  );
}

export function unknownSiteError(aliasOrHost: string): AxiError {
  return new AxiError(`no site registered for "${aliasOrHost}"`, "SITE_NOT_FOUND", [
    "Run `nu-jira-axi site list` to see registered sites",
    `Run \`nu-jira-axi site add ${aliasOrHost} <host>\` to register it`,
  ]);
}

export function noOAuthSessionError(host: string): AxiError {
  return new AxiError(`no OAuth session for ${host}`, "AUTH_MISSING", [
    `Run \`nu-jira-axi setup auth --site ${host}\` to authenticate`,
  ]);
}

export function authRejectedError(host: string): AxiError {
  return new AxiError(`Jira rejected the access token for ${host} (401)`, "AUTH_REJECTED", [
    `Run \`nu-jira-axi setup auth --site ${host}\` to re-authenticate`,
  ]);
}

export function oauthDeniedError(host: string): AxiError {
  return new AxiError(`Jira Cloud authorization for ${host} was denied`, "AUTH_DENIED", [
    `Run \`nu-jira-axi setup auth --site ${host}\` again and click "Allow" to authenticate`,
  ]);
}

export function oauthCallbackTimeoutError(host: string): AxiError {
  return new AxiError(`timed out waiting for the OAuth redirect for ${host}`, "AUTH_TIMEOUT", [
    `Run \`nu-jira-axi setup auth --site ${host}\` again and complete the browser prompt promptly`,
  ]);
}

export function oauthStateMismatchError(): AxiError {
  return new AxiError("OAuth callback state did not match: possible stray or forged request", "AUTH_STATE_MISMATCH");
}

export function refreshFailedError(host: string): AxiError {
  return new AxiError(
    `Jira rejected the refresh token for ${host}: the session may have expired after 90 days of inactivity or been revoked`,
    "AUTH_REFRESH_FAILED",
    [`Run \`nu-jira-axi setup auth --site ${host}\` to authenticate again`],
  );
}

export function sessionPersistFailedError(host: string): AxiError {
  return new AxiError(
    `refreshed the access token for ${host} with Jira but failed to save it locally, so this run couldn't use it`,
    "AUTH_SESSION_PERSIST_FAILED",
    ["Run the command again"],
  );
}

export function refreshLockTimeoutError(host: string): AxiError {
  return new AxiError(
    `timed out waiting for another nu-jira-axi process to finish refreshing the session for ${host}`,
    "AUTH_REFRESH_LOCK_TIMEOUT",
    ["Run the command again"],
  );
}

export function cloudIdResolutionError(host: string, availableHosts: string[]): AxiError {
  const available = availableHosts.length > 0 ? availableHosts.join(", ") : "(none)";
  return new AxiError(
    `authorized account has no access to ${host} (accessible sites: ${available})`,
    "CLOUD_ID_NOT_FOUND",
    ["Confirm you approved access to the right site on the consent screen"],
  );
}

export function forbiddenError(host: string): AxiError {
  return new AxiError(
    `Jira denied this request on ${host} (403): the token's account lacks permission`,
    "AUTH_FORBIDDEN",
  );
}

export function jqlError(jql: string, detail: string): AxiError {
  return new AxiError(`Jira rejected the JQL (400): ${detail}`, "JQL_INVALID", [
    `The resolved JQL was: ${jql}`,
  ]);
}

export function issueNotFoundError(key: string): AxiError {
  return new AxiError(`no issue ${key}`, "ISSUE_NOT_FOUND", [
    `Run \`nu-jira-axi search "${key}"\` if you're not sure of the exact key`,
  ]);
}

export function httpError(status: number, host: string, body: string): AxiError {
  return new AxiError(`Jira returned ${status} from ${host}: ${body.slice(0, 200)}`, "JIRA_HTTP_ERROR");
}

export function writeNotSupportedError(method: string): AxiError {
  // VALIDATION_ERROR is the one AxiError code the SDK maps to exit 2 (see
  // exitCodeForError in axi-sdk-js); everything else exits 1.
  return new AxiError(
    `nu-jira-axi is read-only in v1: ${method} is not supported`,
    "VALIDATION_ERROR",
  );
}
