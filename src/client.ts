import { getSession, saveSession, type OAuthSession } from "./oauth-store.js";
import { refreshAccessToken } from "./oauth.js";
import { LockTimeoutError, withLock } from "./lock.js";
import {
  authRejectedError,
  forbiddenError,
  httpError,
  issueNotFoundError,
  jqlError,
  noOAuthSessionError,
  refreshFailedError,
  refreshLockTimeoutError,
  sessionPersistFailedError,
} from "./errors.js";
import type { SiteContext } from "./context.js";

export interface JiraClientOptions {
  site: SiteContext;
  timeoutMs?: number;
  retries?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 2;
const REFRESH_SKEW_MS = 60_000;

export class JiraClient {
  private readonly host: string;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private cloudId: string | undefined;

  constructor(options: JiraClientOptions) {
    this.host = options.site.host;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.retries = options.retries ?? DEFAULT_RETRIES;
  }

  /** GET a REST v3 path (e.g. "/rest/api/3/myself"), decoded JSON on success. */
  async get(path: string, query?: Record<string, string | number | undefined>): Promise<unknown> {
    const cloudId = await this.ensureCloudId();
    // path always starts with "/" (e.g. "/rest/api/3/myself"); a leading "/"
    // in URL's second-arg resolution would reset to the origin root and
    // drop the /ex/jira/{cloudId} base path, so build the absolute URL directly.
    const url = new URL(`https://api.atlassian.com/ex/jira/${cloudId}${path}`);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    return this.request(url);
  }

  private async ensureCloudId(): Promise<string> {
    if (this.cloudId) return this.cloudId;
    const session = getSession(this.host);
    if (!session) throw noOAuthSessionError(this.host);
    this.cloudId = session.cloudId;
    return this.cloudId;
  }

  private async getValidAccessToken(): Promise<string> {
    const session = getSession(this.host);
    if (!session) throw noOAuthSessionError(this.host);
    if (Date.now() < session.accessTokenExpiresAt - REFRESH_SKEW_MS) {
      return session.accessToken;
    }
    return this.refreshAndPersist(session);
  }

  // Two jira-axi processes hitting an expired token at the same time would
  // otherwise both call refreshAndPersistLocked concurrently and race the
  // Keychain write that persists the rotated tokens; this lock serializes
  // them per host so only one process ever refreshes at a time.
  private async refreshAndPersist(session: OAuthSession): Promise<string> {
    try {
      return await withLock(this.host, () => this.refreshAndPersistLocked(session));
    } catch (error) {
      if (error instanceof LockTimeoutError) throw refreshLockTimeoutError(this.host);
      throw error;
    }
  }

  private async refreshAndPersistLocked(session: OAuthSession): Promise<string> {
    // Another process may have already refreshed and persisted the same
    // (still-current) session while we were waiting for the lock; reuse its
    // rotated token instead of refreshing again. Compared by token identity,
    // not expiry, so this doesn't short-circuit the 401-triggered reactive
    // refresh, whose caller already re-read the (not-yet-expired) session.
    const latest = getSession(this.host) ?? session;
    if (latest.accessToken !== session.accessToken) {
      return latest.accessToken;
    }
    let refreshed;
    try {
      refreshed = await refreshAccessToken(latest.refreshToken);
    } catch {
      throw refreshFailedError(this.host);
    }
    const next: OAuthSession = {
      ...latest,
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      accessTokenExpiresAt: Date.now() + refreshed.expiresIn * 1000,
    };
    try {
      saveSession(this.host, next);
    } catch {
      throw sessionPersistFailedError(this.host);
    }
    return next.accessToken;
  }

  private async request(url: URL, attempt = 0, hasRetriedAuth = false): Promise<unknown> {
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
    } catch (error) {
      if (attempt < this.retries && isRetryable(error)) {
        return this.request(url, attempt + 1, hasRetriedAuth);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  private async handleResponse(response: Response, url: URL): Promise<unknown> {
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

function isRetryable(error: unknown): boolean {
  return error instanceof Error && (error.name === "AbortError" || error.name === "TypeError");
}
