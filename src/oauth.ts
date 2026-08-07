import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { CALLBACK_PORT, CLIENT_ID, CLIENT_SECRET, REDIRECT_URI, SCOPES } from "./oauth-app-config.js";
import { oauthCallbackTimeoutError, oauthDeniedError, oauthStateMismatchError } from "./errors.js";

const AUTHORIZE_URL = "https://auth.atlassian.com/authorize";
const TOKEN_URL = "https://auth.atlassian.com/oauth/token";
const ACCESSIBLE_RESOURCES_URL = "https://api.atlassian.com/oauth/token/accessible-resources";

export function randomState(): string {
  return randomBytes(16).toString("hex");
}

export function buildAuthorizeUrl(state: string): URL {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("audience", "api.atlassian.com");
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("prompt", "consent");
  return url;
}

export interface TokenExchangeResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string;
}

export async function exchangeCodeForToken(code: string): Promise<TokenExchangeResult> {
  return postTokenEndpoint({
    grant_type: "authorization_code",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code,
    redirect_uri: REDIRECT_URI,
  });
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenExchangeResult> {
  return postTokenEndpoint({
    grant_type: "refresh_token",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: refreshToken,
  });
}

async function postTokenEndpoint(body: Record<string, string>): Promise<TokenExchangeResult> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Atlassian token endpoint returned ${response.status}: ${detail.slice(0, 200)}`);
  }
  const json = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string;
  };
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresIn: json.expires_in,
    scope: json.scope,
  };
}

export interface AccessibleResource {
  id: string;
  name: string;
  url: string;
  scopes: string[];
}

export async function fetchAccessibleResources(accessToken: string): Promise<AccessibleResource[]> {
  const response = await fetch(ACCESSIBLE_RESOURCES_URL, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`accessible-resources returned ${response.status}: ${detail.slice(0, 200)}`);
  }
  return (await response.json()) as AccessibleResource[];
}

export interface CallbackResult {
  code: string;
}

const CALLBACK_TIMEOUT_MS = 120_000;
const CALLBACK_RESPONSE_HTML = "<html><body>Authorized. You can close this tab.</body></html>";
const CALLBACK_ERROR_HTML = "<html><body>Authorization failed. You can close this tab.</body></html>";

/**
 * Listens on 127.0.0.1 only (never 0.0.0.0) for the OAuth redirect, resolving
 * once a request with a matching `state` arrives. Closes the server on every
 * exit path so an interrupted `setup auth` never leaks a listening socket.
 */
export function listenForCallback(
  expectedState: string,
  host: string,
  port: number = CALLBACK_PORT,
  timeoutMs: number = CALLBACK_TIMEOUT_MS,
): Promise<CallbackResult> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://localhost:${port}`);
      if (url.pathname !== "/callback") {
        res.writeHead(404, { Connection: "close" }).end();
        return;
      }

      const error = url.searchParams.get("error");
      const state = url.searchParams.get("state");
      const code = url.searchParams.get("code");

      if (error) {
        res.writeHead(200, { "Content-Type": "text/html", Connection: "close" }).end(CALLBACK_ERROR_HTML);
        finish(() => reject(oauthDeniedError(host)));
        return;
      }
      if (state !== expectedState) {
        res.writeHead(200, { "Content-Type": "text/html", Connection: "close" }).end(CALLBACK_ERROR_HTML);
        finish(() => reject(oauthStateMismatchError()));
        return;
      }
      if (!code) {
        res.writeHead(200, { "Content-Type": "text/html", Connection: "close" }).end(CALLBACK_ERROR_HTML);
        finish(() => reject(oauthStateMismatchError()));
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html", Connection: "close" }).end(CALLBACK_RESPONSE_HTML);
      finish(() => resolve({ code }));
    });

    const timer = setTimeout(() => {
      finish(() => reject(oauthCallbackTimeoutError(host)));
    }, timeoutMs);

    let settled = false;
    function finish(action: () => void): void {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      server.close(() => action());
    }

    server.listen(port, "127.0.0.1");
  });
}
