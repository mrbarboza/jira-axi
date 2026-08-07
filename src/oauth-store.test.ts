import { afterEach, describe, expect, it, vi } from "vitest";

const readSecretMock = vi.fn();
const writeSecretMock = vi.fn();
vi.mock("./keychain.js", () => ({
  readSecret: (host: string) => readSecretMock(host),
  writeSecret: (host: string, value: string) => writeSecretMock(host, value),
}));

const { getSession, saveSession, hasSession } = await import("./oauth-store.js");

const SESSION = {
  version: 1 as const,
  accessToken: "access-1",
  refreshToken: "refresh-1",
  accessTokenExpiresAt: 1_700_000_000_000,
  cloudId: "cloud-123",
  scope: "read:jira-work",
};

afterEach(() => {
  readSecretMock.mockReset();
  writeSecretMock.mockReset();
});

describe("getSession", () => {
  it("round-trips a valid session", () => {
    readSecretMock.mockReturnValue(JSON.stringify(SESSION));
    expect(getSession("acme.atlassian.net")).toEqual(SESSION);
  });

  it("returns undefined when the keychain has nothing stored", () => {
    readSecretMock.mockImplementation(() => {
      throw new Error("not found");
    });
    expect(getSession("acme.atlassian.net")).toBeUndefined();
  });

  it("returns undefined for unparsable JSON, e.g. a leftover plaintext Basic-Auth token", () => {
    readSecretMock.mockReturnValue("plain-api-token-not-json");
    expect(getSession("acme.atlassian.net")).toBeUndefined();
  });

  it("returns undefined for a recognized but unsupported version", () => {
    readSecretMock.mockReturnValue(JSON.stringify({ ...SESSION, version: 2 }));
    expect(getSession("acme.atlassian.net")).toBeUndefined();
  });
});

describe("saveSession", () => {
  it("writes the session as a single JSON blob", () => {
    saveSession("acme.atlassian.net", SESSION);
    expect(writeSecretMock).toHaveBeenCalledWith("acme.atlassian.net", JSON.stringify(SESSION));
  });
});

describe("hasSession", () => {
  it("returns true when a valid session is stored", () => {
    readSecretMock.mockReturnValue(JSON.stringify(SESSION));
    expect(hasSession("acme.atlassian.net")).toBe(true);
  });

  it("returns false when nothing is stored", () => {
    readSecretMock.mockImplementation(() => {
      throw new Error("not found");
    });
    expect(hasSession("acme.atlassian.net")).toBe(false);
  });
});
