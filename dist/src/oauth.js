import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { CALLBACK_PORT, CLIENT_ID, OAUTH_PROXY_URL, REDIRECT_URI, SCOPES } from "./oauth-app-config.js";
import { oauthCallbackTimeoutError, oauthDeniedError, oauthStateMismatchError } from "./errors.js";
const AUTHORIZE_URL = "https://auth.atlassian.com/authorize";
const ACCESSIBLE_RESOURCES_URL = "https://api.atlassian.com/oauth/token/accessible-resources";
export function randomState() {
    return randomBytes(16).toString("hex");
}
export function buildAuthorizeUrl(state) {
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
/**
 * Exchanges an authorization code for tokens via the ADR-0003 proxy, which
 * holds the real `client_secret` server-side. The CLI itself never sees it.
 */
export async function exchangeCodeForToken(code) {
    return postProxyEndpoint("/token/exchange", { code });
}
export async function refreshAccessToken(refreshToken) {
    return postProxyEndpoint("/token/refresh", { refresh_token: refreshToken });
}
async function postProxyEndpoint(path, body) {
    const response = await fetch(`${OAUTH_PROXY_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`oauth proxy ${path} returned ${response.status}: ${detail.slice(0, 200)}`);
    }
    const json = (await response.json());
    return {
        accessToken: json.access_token,
        refreshToken: json.refresh_token,
        expiresIn: json.expires_in,
        scope: json.scope,
    };
}
export async function fetchAccessibleResources(accessToken) {
    const response = await fetch(ACCESSIBLE_RESOURCES_URL, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });
    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`accessible-resources returned ${response.status}: ${detail.slice(0, 200)}`);
    }
    return (await response.json());
}
const CALLBACK_TIMEOUT_MS = Number(process.env.JIRA_AXI_OAUTH_CALLBACK_TIMEOUT_MS) || 120_000;
const CALLBACK_RESPONSE_HTML = "<html><body>Authorized. You can close this tab.</body></html>";
const CALLBACK_ERROR_HTML = "<html><body>Authorization failed. You can close this tab.</body></html>";
/**
 * Listens on 127.0.0.1 only (never 0.0.0.0) for the OAuth redirect, resolving
 * once a request with a matching `state` arrives. Closes the server on every
 * exit path so an interrupted `setup auth` never leaks a listening socket.
 */
export function listenForCallback(expectedState, host, port = CALLBACK_PORT, timeoutMs = CALLBACK_TIMEOUT_MS) {
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
        function finish(action) {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            server.close(() => action());
        }
        server.listen(port, "127.0.0.1");
    });
}
//# sourceMappingURL=oauth.js.map