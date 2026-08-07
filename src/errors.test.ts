import { describe, expect, it } from "vitest";
import {
  authRejectedError,
  cloudIdResolutionError,
  missingSiteError,
  noOAuthSessionError,
  oauthCallbackTimeoutError,
  oauthDeniedError,
  oauthStateMismatchError,
  refreshFailedError,
  unknownSiteError,
} from "./errors.js";

describe("noOAuthSessionError", () => {
  it("names the host and points at setup auth", () => {
    const error = noOAuthSessionError("acme.atlassian.net");
    expect(error.code).toBe("AUTH_MISSING");
    expect(error.message).toContain("acme.atlassian.net");
    expect(error.suggestions.join(" ")).toContain("jira-axi setup auth --site acme.atlassian.net");
  });
});

describe("authRejectedError", () => {
  it("mentions the 401 and re-authentication, not the retired Basic-Auth wording", () => {
    const error = authRejectedError("acme.atlassian.net");
    expect(error.code).toBe("AUTH_REJECTED");
    expect(error.message).toMatch(/401/);
    expect(error.message).not.toMatch(/API token/i);
    expect(error.suggestions.join(" ")).toContain("re-authenticate");
  });
});

describe("oauthDeniedError", () => {
  it("reports denial and suggests retrying setup auth", () => {
    const error = oauthDeniedError("acme.atlassian.net");
    expect(error.code).toBe("AUTH_DENIED");
    expect(error.message).toMatch(/denied/i);
  });
});

describe("oauthCallbackTimeoutError", () => {
  it("reports a timeout", () => {
    const error = oauthCallbackTimeoutError("acme.atlassian.net");
    expect(error.code).toBe("AUTH_TIMEOUT");
    expect(error.message).toMatch(/timed out/i);
  });
});

describe("oauthStateMismatchError", () => {
  it("flags a possible forged callback with no host in the message", () => {
    const error = oauthStateMismatchError();
    expect(error.code).toBe("AUTH_STATE_MISMATCH");
    expect(error.message).toMatch(/state/i);
  });
});

describe("refreshFailedError", () => {
  it("mentions the 90-day inactivity window", () => {
    const error = refreshFailedError("acme.atlassian.net");
    expect(error.code).toBe("AUTH_REFRESH_FAILED");
    expect(error.message).toMatch(/90 days/);
  });
});

describe("cloudIdResolutionError", () => {
  it("lists the accessible hosts to help the user notice a wrong-site consent approval", () => {
    const error = cloudIdResolutionError("acme.atlassian.net", ["other.atlassian.net", "third.atlassian.net"]);
    expect(error.code).toBe("CLOUD_ID_NOT_FOUND");
    expect(error.message).toContain("acme.atlassian.net");
    expect(error.message).toContain("other.atlassian.net");
    expect(error.message).toContain("third.atlassian.net");
  });

  it("reports (none) when no sites were granted", () => {
    const error = cloudIdResolutionError("acme.atlassian.net", []);
    expect(error.message).toContain("(none)");
  });
});

describe("unaffected error factories still work", () => {
  it("missingSiteError and unknownSiteError are untouched by the OAuth migration", () => {
    expect(missingSiteError().code).toBe("SITE_NOT_RESOLVED");
    expect(unknownSiteError("nope").code).toBe("SITE_NOT_FOUND");
  });
});
