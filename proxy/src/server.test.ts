import { request } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProxyConfig } from "./config.js";
import { createProxyServer } from "./server.js";

const config: ProxyConfig = {
  clientId: "test-client-id",
  clientSecret: "test-client-secret",
  redirectUri: "http://localhost:51703/callback",
  port: 0,
  rateLimitPerMinute: 2,
};

async function withServer(
  fetchImpl: typeof fetch,
  fn: (port: number) => Promise<void>,
  now: () => number = Date.now,
): Promise<void> {
  const server = createProxyServer(config, fetchImpl, now);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as AddressInfo).port;
  try {
    await fn(port);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

function postJson(port: number, path: string, body: unknown): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = request(
      { host: "127.0.0.1", port, path, method: "POST", headers: { "Content-Type": "application/json" } },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          resolve({ status: res.statusCode ?? 0, body: raw.length ? JSON.parse(raw) : undefined });
        });
      },
    );
    req.on("error", reject);
    req.end(payload);
  });
}

describe("POST /token/exchange", () => {
  afterEach(() => vi.restoreAllMocks());

  it("forwards an authorization_code grant with the server-side secret and returns tokens", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: "at", refresh_token: "rt", expires_in: 3600, scope: "read:jira-work" }),
    });

    await withServer(fetchSpy as unknown as typeof fetch, async (port) => {
      const { status, body } = await postJson(port, "/token/exchange", { code: "auth-code" });
      expect(status).toBe(200);
      expect(body).toEqual({ access_token: "at", refresh_token: "rt", expires_in: 3600, scope: "read:jira-work" });

      const [tokenUrl, init] = fetchSpy.mock.calls[0];
      expect(tokenUrl).toBe("https://auth.atlassian.com/oauth/token");
      const sent = JSON.parse(init.body);
      expect(sent).toEqual({
        grant_type: "authorization_code",
        client_id: "test-client-id",
        client_secret: "test-client-secret",
        code: "auth-code",
        redirect_uri: "http://localhost:51703/callback",
      });
    });
  });

  it("rejects a request missing the code field without calling upstream", async () => {
    const fetchSpy = vi.fn();
    await withServer(fetchSpy as unknown as typeof fetch, async (port) => {
      const { status, body } = await postJson(port, "/token/exchange", {});
      expect(status).toBe(400);
      expect(body.error).toMatch(/code/);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  it("passes through upstream failures with their status", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: false, status: 400, text: () => Promise.resolve("invalid_grant") });
    await withServer(fetchSpy as unknown as typeof fetch, async (port) => {
      const { status, body } = await postJson(port, "/token/exchange", { code: "bad-code" });
      expect(status).toBe(400);
      expect(body.error).toBe("upstream_error");
      expect(body.detail).toBe("invalid_grant");
    });
  });
});

describe("POST /token/refresh", () => {
  it("forwards a refresh_token grant", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: "at2", refresh_token: "rt2", expires_in: 3600, scope: "read:jira-work" }),
    });

    await withServer(fetchSpy as unknown as typeof fetch, async (port) => {
      const { status, body } = await postJson(port, "/token/refresh", { refresh_token: "old-refresh" });
      expect(status).toBe(200);
      expect(body.access_token).toBe("at2");

      const sent = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(sent.grant_type).toBe("refresh_token");
      expect(sent.refresh_token).toBe("old-refresh");
      expect(sent.client_secret).toBe("test-client-secret");
    });
  });
});

describe("rate limiting", () => {
  it("returns 429 once the per-key limit within the window is exceeded", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: "at", refresh_token: "rt", expires_in: 3600, scope: "s" }),
    });
    let time = 0;
    await withServer(
      fetchSpy as unknown as typeof fetch,
      async (port) => {
        const first = await postJson(port, "/token/refresh", { refresh_token: "a" });
        const second = await postJson(port, "/token/refresh", { refresh_token: "b" });
        const third = await postJson(port, "/token/refresh", { refresh_token: "c" });
        expect(first.status).toBe(200);
        expect(second.status).toBe(200);
        expect(third.status).toBe(429);
      },
      () => time++,
    );
  });
});

describe("GET /healthz", () => {
  it("returns ok without hitting the rate limiter or upstream", async () => {
    const fetchSpy = vi.fn();
    await withServer(fetchSpy as unknown as typeof fetch, async (port) => {
      const res = await new Promise<{ status: number }>((resolve, reject) => {
        const req = request({ host: "127.0.0.1", port, path: "/healthz", method: "GET" }, (r) => {
          r.resume();
          r.on("end", () => resolve({ status: r.statusCode ?? 0 }));
        });
        req.on("error", reject);
        req.end();
      });
      expect(res.status).toBe(200);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
});
