import { AxiError } from "axi-sdk-js";

export function missingSiteError(): AxiError {
  return new AxiError(
    "no Jira site resolved: pass --site, set JIRA_AXI_SITE, or add a default site",
    "SITE_NOT_RESOLVED",
    [
      "Run `jira-axi site add <alias> <host>` to register a site",
      "Run `jira-axi site use <alias>` to set it as default",
    ],
  );
}

export function unknownSiteError(aliasOrHost: string): AxiError {
  return new AxiError(`no site registered for "${aliasOrHost}"`, "SITE_NOT_FOUND", [
    "Run `jira-axi site list` to see registered sites",
    `Run \`jira-axi site add ${aliasOrHost} <host>\` to register it`,
  ]);
}

export function missingEmailError(host: string): AxiError {
  return new AxiError(`no account email stored for ${host}`, "AUTH_MISSING", [
    `Run \`jira-axi setup auth --site ${host} --email <you@example.com>\` to store one`,
  ]);
}

export function missingTokenError(host: string): AxiError {
  return new AxiError(`no API token stored for ${host}`, "AUTH_MISSING", [
    `Run \`jira-axi setup auth --site ${host}\` to store one`,
  ]);
}

export function authRejectedError(host: string): AxiError {
  return new AxiError(`Jira rejected the API token for ${host} (401)`, "AUTH_REJECTED", [
    `Run \`jira-axi setup auth --site ${host}\` to store a fresh token`,
  ]);
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
    `Run \`jira-axi search "${key}"\` if you're not sure of the exact key`,
  ]);
}

export function httpError(status: number, host: string, body: string): AxiError {
  return new AxiError(`Jira returned ${status} from ${host}: ${body.slice(0, 200)}`, "JIRA_HTTP_ERROR");
}

export function writeNotSupportedError(method: string): AxiError {
  // VALIDATION_ERROR is the one AxiError code the SDK maps to exit 2 (see
  // exitCodeForError in axi-sdk-js); everything else exits 1.
  return new AxiError(
    `jira-axi is read-only in v1: ${method} is not supported`,
    "VALIDATION_ERROR",
  );
}
