import { get as httpGet } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  fetchAccessibleResources,
  listenForCallback,
  refreshAccessToken,
} from "./oauth.js";
import { CLIENT_ID, REDIRECT_URI } from "./oauth-app-config.js";

describe("buildAuthorizeUrl", () => {
  it("includes client_id, redirect_uri, scope, and state, with no PKCE params", () => {
    const url = buildAuthorizeUrl("state-123");
    expect(url.origin + url.pathname).toBe("https://auth.atlassian.com/authorize");
    expect(url.searchParams.get("client_id")).toBe(CLIENT_ID);
    expect(url.searchParams.get("redirect_uri")).toBe(REDIRECT_URI);
    expect(url.searchParams.get("state")).toBe("state-123");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.has("code_challenge")).toBe(false);
  });
});

describe("token endpoint calls", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("exchangeCodeForToken posts an authorization_code grant", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ access_token: "at", refresh_token: "rt", expires_in: 3600, scope: "read:jira-work" }),
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const result = await exchangeCodeForToken("auth-code");

    expect(result).toEqual({ accessToken: "at", refreshToken: "rt", expiresIn: 3600, scope: "read:jira-work" });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://auth.atlassian.com/oauth/token");
    const body = JSON.parse(init.body);
    expect(body.grant_type).toBe("authorization_code");
    expect(body.code).toBe("auth-code");
    expect(body.client_id).toBe(CLIENT_ID);
  });

  it("refreshAccessToken posts a refresh_token grant", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ access_token: "at2", refresh_token: "rt2", expires_in: 3600, scope: "read:jira-work" }),
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const result = await refreshAccessToken("old-refresh");

    expect(result.accessToken).toBe("at2");
    expect(result.refreshToken).toBe("rt2");
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.grant_type).toBe("refresh_token");
    expect(body.refresh_token).toBe("old-refresh");
  });

  it("throws when the token endpoint responds with a non-2xx status", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 400, text: () => Promise.resolve("invalid_grant") }) as unknown as typeof fetch;
    await expect(refreshAccessToken("bad-refresh")).rejects.toThrow(/400/);
  });

  it("fetchAccessibleResources sends the bearer token and returns the resource list", async () => {
    const resources = [{ id: "cloud-1", name: "Acme", url: "https://acme.atlassian.net", scopes: ["read:jira-work"] }];
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(resources) });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const result = await fetchAccessibleResources("access-token");

    expect(result).toEqual(resources);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://api.atlassian.com/oauth/token/accessible-resources");
    expect(init.headers.Authorization).toBe("Bearer access-token");
  });
});

describe("listenForCallback", () => {
  const PORT = 51799;

  it("resolves with the code when state matches", async () => {
    const promise = listenForCallback("expected-state", "acme.atlassian.net", PORT, 5000);
    await hitCallback(PORT, "code=abc123&state=expected-state");
    await expect(promise).resolves.toEqual({ code: "abc123" });
  });

  it("rejects on state mismatch", async () => {
    const promise = listenForCallback("expected-state", "acme.atlassian.net", PORT, 5000);
    const assertion = expect(promise).rejects.toThrow(/state/i);
    await hitCallback(PORT, "code=abc123&state=wrong-state");
    await assertion;
  });

  it("rejects when Atlassian reports the user denied consent", async () => {
    const promise = listenForCallback("expected-state", "acme.atlassian.net", PORT, 5000);
    const assertion = expect(promise).rejects.toThrow(/denied/i);
    await hitCallback(PORT, "error=access_denied&state=expected-state");
    await assertion;
  });

  it("rejects on timeout", async () => {
    vi.useFakeTimers();
    try {
      const promise = listenForCallback("expected-state", "acme.atlassian.net", PORT, 10);
      const assertion = expect(promise).rejects.toThrow(/timed out/i);
      await vi.advanceTimersByTimeAsync(20);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});

function hitCallback(port: number, query: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = httpGet(`http://127.0.0.1:${port}/callback?${query}`, (res) => {
      res.resume();
      res.on("end", resolve);
    });
    req.on("error", reject);
  });
}
