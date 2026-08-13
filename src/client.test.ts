import { afterEach, describe, expect, it, vi } from "vitest";
import { AxiError } from "axi-sdk-js";
import type { SiteContext } from "./context.js";

const getSessionMock = vi.fn();
const saveSessionMock = vi.fn();
vi.mock("./oauth-store.js", () => ({
  getSession: (host: string) => getSessionMock(host),
  saveSession: (host: string, session: unknown) => saveSessionMock(host, session),
}));

const refreshAccessTokenMock = vi.fn();
vi.mock("./oauth.js", () => ({
  refreshAccessToken: (refreshToken: string) => refreshAccessTokenMock(refreshToken),
}));

const { JiraClient } = await import("./client.js");

const SITE: SiteContext = { host: "acme.atlassian.net", source: "flag" };

function session(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    version: 1,
    accessToken: "access-1",
    refreshToken: "refresh-1",
    accessTokenExpiresAt: Date.now() + 60 * 60 * 1000,
    cloudId: "cloud-123",
    scope: "read:jira-work",
    ...overrides,
  };
}

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  getSessionMock.mockReset();
  saveSessionMock.mockReset();
  refreshAccessTokenMock.mockReset();
});

describe("JiraClient", () => {
  it("builds the request against the gateway URL for the resolved cloudId, with a Bearer header", async () => {
    getSessionMock.mockReturnValue(session());
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ ok: true }) });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const client = new JiraClient({ site: SITE });
    await client.get("/rest/api/3/myself");

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url.toString()).toBe("https://api.atlassian.com/ex/jira/cloud-123/rest/api/3/myself");
    expect(init.headers.Authorization).toBe("Bearer access-1");
    expect(refreshAccessTokenMock).not.toHaveBeenCalled();
  });

  it("skips refresh when the access token is still valid", async () => {
    getSessionMock.mockReturnValue(session({ accessTokenExpiresAt: Date.now() + 60 * 60 * 1000 }));
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }) as unknown as typeof fetch;

    await new JiraClient({ site: SITE }).get("/rest/api/3/myself");

    expect(refreshAccessTokenMock).not.toHaveBeenCalled();
    expect(saveSessionMock).not.toHaveBeenCalled();
  });

  it("refreshes and persists the rotated session before an expiring-token request", async () => {
    getSessionMock.mockReturnValue(session({ accessTokenExpiresAt: Date.now() - 1000 }));
    refreshAccessTokenMock.mockResolvedValue({
      accessToken: "access-2",
      refreshToken: "refresh-2",
      expiresIn: 3600,
      scope: "read:jira-work",
    });
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    await new JiraClient({ site: SITE }).get("/rest/api/3/myself");

    expect(saveSessionMock).toHaveBeenCalledWith(
      "acme.atlassian.net",
      expect.objectContaining({ accessToken: "access-2", refreshToken: "refresh-2" }),
    );
    const [, init] = fetchSpy.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer access-2");
  });

  it("reactively refreshes once on a 401 and retries the request", async () => {
    getSessionMock.mockReturnValue(session());
    refreshAccessTokenMock.mockResolvedValue({
      accessToken: "access-2",
      refreshToken: "refresh-2",
      expiresIn: 3600,
      scope: "read:jira-work",
    });
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401, text: () => Promise.resolve("expired") })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ ok: true }) });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const result = await new JiraClient({ site: SITE }).get("/rest/api/3/myself");

    expect(result).toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(refreshAccessTokenMock).toHaveBeenCalledTimes(1);
    expect(saveSessionMock).toHaveBeenCalledTimes(1);
  });

  it("throws authRejectedError on a second consecutive 401 without looping", async () => {
    getSessionMock.mockReturnValue(session());
    refreshAccessTokenMock.mockResolvedValue({
      accessToken: "access-2",
      refreshToken: "refresh-2",
      expiresIn: 3600,
      scope: "read:jira-work",
    });
    const fetchSpy = vi.fn().mockResolvedValue({ ok: false, status: 401, text: () => Promise.resolve("expired") });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    await expect(new JiraClient({ site: SITE }).get("/rest/api/3/myself")).rejects.toThrow(/401/);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(refreshAccessTokenMock).toHaveBeenCalledTimes(1);
  });

  it("throws noOAuthSessionError when no session is stored", async () => {
    getSessionMock.mockReturnValue(undefined);
    await expect(new JiraClient({ site: SITE }).get("/rest/api/3/myself")).rejects.toThrow(/no OAuth session/);
  });

  it("surfaces a local session-persistence failure as a proper AxiError, not a raw error", async () => {
    getSessionMock.mockReturnValue(session({ accessTokenExpiresAt: Date.now() - 1000 }));
    refreshAccessTokenMock.mockResolvedValue({
      accessToken: "access-2",
      refreshToken: "refresh-2",
      expiresIn: 3600,
      scope: "read:jira-work",
    });
    // Mirrors the real failure: two jira-axi processes racing macOS's
    // `security add-generic-password -U` can make one of them throw this.
    saveSessionMock.mockImplementation(() => {
      throw new Error("SecKeychainItemModifyContent: The specified item already exists in the keychain.");
    });
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }) as unknown as typeof fetch;

    const error: unknown = await new JiraClient({ site: SITE }).get("/rest/api/3/myself").catch((caught) => caught);

    expect(error).toBeInstanceOf(AxiError);
    expect((error as AxiError).code).toBe("AUTH_SESSION_PERSIST_FAILED");
  });

  it("regression: two clients racing the same expired session only refresh once, serialized by the lock", async () => {
    // Reproduces the reported bug: without a cross-process/cross-call lock,
    // two near-simultaneous invocations both see the token as expired and
    // both call refreshAccessToken independently, wasting an Atlassian-side
    // token rotation and racing the Keychain write that persists the
    // result. With the lock, the second caller waits for the first and
    // reuses its rotated token instead of refreshing again.
    let store = session({ accessToken: "access-0", accessTokenExpiresAt: Date.now() - 1000 });
    getSessionMock.mockImplementation(() => store);
    saveSessionMock.mockImplementation((_host: string, next: unknown) => {
      store = next as typeof store;
    });
    let refreshCalls = 0;
    refreshAccessTokenMock.mockImplementation(async () => {
      refreshCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return {
        accessToken: `access-${refreshCalls}`,
        refreshToken: `refresh-${refreshCalls}`,
        expiresIn: 3600,
        scope: "read:jira-work",
      };
    });
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }) as unknown as typeof fetch;

    const clientA = new JiraClient({ site: SITE });
    const clientB = new JiraClient({ site: SITE });
    await Promise.all([clientA.get("/rest/api/3/myself"), clientB.get("/rest/api/3/myself")]);

    expect(refreshAccessTokenMock).toHaveBeenCalledTimes(1);
  });
});
