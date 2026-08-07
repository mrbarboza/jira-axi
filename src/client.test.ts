import { afterEach, describe, expect, it, vi } from "vitest";
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
});
