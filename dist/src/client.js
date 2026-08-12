import { getSession, saveSession } from "./oauth-store.js";
import { refreshAccessToken } from "./oauth.js";
import { authRejectedError, forbiddenError, httpError, issueNotFoundError, jqlError, noOAuthSessionError, refreshFailedError, } from "./errors.js";
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 2;
const REFRESH_SKEW_MS = 60_000;
export class JiraClient {
    host;
    timeoutMs;
    retries;
    cloudId;
    constructor(options) {
        this.host = options.site.host;
        this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        this.retries = options.retries ?? DEFAULT_RETRIES;
    }
    /** GET a REST v3 path (e.g. "/rest/api/3/myself"), decoded JSON on success. */
    async get(path, query) {
        const cloudId = await this.ensureCloudId();
        // path always starts with "/" (e.g. "/rest/api/3/myself"); a leading "/"
        // in URL's second-arg resolution would reset to the origin root and
        // drop the /ex/jira/{cloudId} base path, so build the absolute URL directly.
        const url = new URL(`https://api.atlassian.com/ex/jira/${cloudId}${path}`);
        for (const [key, value] of Object.entries(query ?? {})) {
            if (value !== undefined)
                url.searchParams.set(key, String(value));
        }
        return this.request(url);
    }
    async ensureCloudId() {
        if (this.cloudId)
            return this.cloudId;
        const session = getSession(this.host);
        if (!session)
            throw noOAuthSessionError(this.host);
        this.cloudId = session.cloudId;
        return this.cloudId;
    }
    async getValidAccessToken() {
        const session = getSession(this.host);
        if (!session)
            throw noOAuthSessionError(this.host);
        if (Date.now() < session.accessTokenExpiresAt - REFRESH_SKEW_MS) {
            return session.accessToken;
        }
        return this.refreshAndPersist(session);
    }
    async refreshAndPersist(session) {
        let refreshed;
        try {
            refreshed = await refreshAccessToken(session.refreshToken);
        }
        catch {
            throw refreshFailedError(this.host);
        }
        const next = {
            ...session,
            accessToken: refreshed.accessToken,
            refreshToken: refreshed.refreshToken,
            accessTokenExpiresAt: Date.now() + refreshed.expiresIn * 1000,
        };
        saveSession(this.host, next);
        return next.accessToken;
    }
    async request(url, attempt = 0, hasRetriedAuth = false) {
        const accessToken = await this.getValidAccessToken();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
            const response = await fetch(url, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: "application/json",
                },
                signal: controller.signal,
            });
            if (response.status === 401 && !hasRetriedAuth) {
                const session = getSession(this.host);
                if (session) {
                    await this.refreshAndPersist(session);
                    return this.request(url, attempt, true);
                }
            }
            return await this.handleResponse(response, url);
        }
        catch (error) {
            if (attempt < this.retries && isRetryable(error)) {
                return this.request(url, attempt + 1, hasRetriedAuth);
            }
            throw error;
        }
        finally {
            clearTimeout(timer);
        }
    }
    async handleResponse(response, url) {
        if (response.ok) {
            return response.json();
        }
        const body = await response.text();
        switch (response.status) {
            case 401:
                throw authRejectedError(this.host);
            case 403:
                throw forbiddenError(this.host);
            case 404: {
                const key = url.searchParams.get("key") ?? url.pathname.split("/").pop() ?? url.pathname;
                throw issueNotFoundError(key);
            }
            case 400:
                throw jqlError(url.searchParams.get("jql") ?? "", body);
            default:
                throw httpError(response.status, this.host, body);
        }
    }
}
function isRetryable(error) {
    return error instanceof Error && (error.name === "AbortError" || error.name === "TypeError");
}
//# sourceMappingURL=client.js.map