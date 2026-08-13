import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { ProxyConfig } from "./config.js";
import { RateLimiter } from "./rate-limiter.js";

const TOKEN_URL = "https://auth.atlassian.com/oauth/token";
const MAX_BODY_BYTES = 16 * 1024;

const PRIVACY_POLICY = `Privacy Policy

nu-jira-axi (the command-line tool) stores no user data server-side.
OAuth tokens issued during login are stored only in the local OS keychain on your own machine and are never sent to or retained by any server operated by this project.

This proxy exists solely to relay the OAuth token exchange and refresh requests between the nu-jira-axi CLI and Atlassian.
It does not log, store, or otherwise persist any request or response data it handles; each request is forwarded to Atlassian and its response is returned directly to the CLI.
`;

const TERMS_OF_SERVICE = `Terms of Service

This tool is provided "as is", without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose, and noninfringement.
Use it at your own risk.
`;

export interface TokenResult {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
}

export type Fetch = typeof fetch;

/** Builds the request handler. Injected `fetchImpl` and `now` make this testable without real network or wall-clock calls. */
export function createHandler(
  config: ProxyConfig,
  fetchImpl: Fetch = fetch,
  now: () => number = Date.now,
): (req: IncomingMessage, res: ServerResponse) => void {
  const limiter = new RateLimiter(config.rateLimitPerMinute);

  return (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");

    if (req.method === "GET" && url.pathname === "/healthz") {
      respondJson(res, 200, { status: "ok" });
      return;
    }

    if (req.method === "GET" && url.pathname === "/privacy") {
      respondText(res, 200, PRIVACY_POLICY);
      return;
    }

    if (req.method === "GET" && url.pathname === "/terms") {
      respondText(res, 200, TERMS_OF_SERVICE);
      return;
    }

    if (req.method !== "POST" || (url.pathname !== "/token/exchange" && url.pathname !== "/token/refresh")) {
      respondJson(res, 404, { error: "not_found" });
      return;
    }

    const clientKey = clientIp(req);
    if (!limiter.allow(clientKey, now())) {
      respondJson(res, 429, { error: "rate_limited" });
      return;
    }

    readJsonBody(req, MAX_BODY_BYTES)
      .then((body) => handleTokenRequest(url.pathname, body, config, fetchImpl))
      .then((result) => respondJson(res, 200, result))
      .catch((err: unknown) => {
        if (err instanceof BadRequestError) {
          respondJson(res, 400, { error: err.message });
          return;
        }
        if (err instanceof UpstreamError) {
          respondJson(res, err.status, { error: "upstream_error", detail: err.detail });
          return;
        }
        respondJson(res, 500, { error: "internal_error" });
      });
  };
}

export function createProxyServer(config: ProxyConfig, fetchImpl: Fetch = fetch, now: () => number = Date.now): Server {
  return createServer(createHandler(config, fetchImpl, now));
}

class BadRequestError extends Error {}
class UpstreamError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: string,
  ) {
    super(`upstream token endpoint returned ${status}`);
  }
}

async function handleTokenRequest(
  pathname: string,
  body: unknown,
  config: ProxyConfig,
  fetchImpl: Fetch,
): Promise<TokenResult> {
  const grantBody =
    pathname === "/token/exchange" ? buildExchangeBody(body, config) : buildRefreshBody(body, config);

  const response = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(grantBody),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new UpstreamError(response.status, detail.slice(0, 200));
  }

  return (await response.json()) as TokenResult;
}

function buildExchangeBody(body: unknown, config: ProxyConfig): Record<string, string> {
  const code = stringField(body, "code");
  return {
    grant_type: "authorization_code",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.redirectUri,
  };
}

function buildRefreshBody(body: unknown, config: ProxyConfig): Record<string, string> {
  const refreshToken = stringField(body, "refresh_token");
  return {
    grant_type: "refresh_token",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
  };
}

function stringField(body: unknown, field: string): string {
  if (typeof body !== "object" || body === null) {
    throw new BadRequestError(`request body must be a JSON object with a "${field}" field`);
  }
  const value = (body as Record<string, unknown>)[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new BadRequestError(`missing or invalid "${field}"`);
  }
  return value;
}

function readJsonBody(req: IncomingMessage, maxBytes: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new BadRequestError("request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw.length === 0 ? {} : JSON.parse(raw));
      } catch {
        reject(new BadRequestError("request body must be valid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function clientIp(req: IncomingMessage): string {
  return req.socket.remoteAddress ?? "unknown";
}

function respondJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }).end(
    payload,
  );
}

function respondText(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, { "Content-Type": "text/plain", "Content-Length": Buffer.byteLength(body) }).end(body);
}
