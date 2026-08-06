import { getToken } from "./keychain.js";
import {
  authRejectedError,
  forbiddenError,
  httpError,
  issueNotFoundError,
  jqlError,
  missingEmailError,
} from "./errors.js";
import type { SiteContext } from "./context.js";

export interface JiraClientOptions {
  site: SiteContext;
  timeoutMs?: number;
  retries?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 2;

export class JiraClient {
  private readonly host: string;
  private readonly email: string;
  private readonly timeoutMs: number;
  private readonly retries: number;

  constructor(options: JiraClientOptions) {
    this.host = options.site.host;
    if (!options.site.email) throw missingEmailError(this.host);
    this.email = options.site.email;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.retries = options.retries ?? DEFAULT_RETRIES;
  }

  /** GET a REST v3 path (e.g. "/rest/api/3/myself"), decoded JSON on success. */
  async get(path: string, query?: Record<string, string | number | undefined>): Promise<unknown> {
    const url = new URL(path, `https://${this.host}`);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    return this.request(url);
  }

  private async request(url: URL, attempt = 0): Promise<unknown> {
    const token = getToken(this.host);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.email}:${token}`).toString("base64")}`,
          Accept: "application/json",
        },
        signal: controller.signal,
      });
      return await this.handleResponse(response, url);
    } catch (error) {
      if (attempt < this.retries && isRetryable(error)) {
        return this.request(url, attempt + 1);
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
