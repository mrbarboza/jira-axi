import type { SiteContext } from "./context.js";
export interface JiraClientOptions {
    site: SiteContext;
    timeoutMs?: number;
    retries?: number;
}
export declare class JiraClient {
    private readonly host;
    private readonly timeoutMs;
    private readonly retries;
    private cloudId;
    constructor(options: JiraClientOptions);
    /** GET a REST v3 path (e.g. "/rest/api/3/myself"), decoded JSON on success. */
    get(path: string, query?: Record<string, string | number | undefined>): Promise<unknown>;
    private ensureCloudId;
    private getValidAccessToken;
    private refreshAndPersist;
    private refreshAndPersistLocked;
    private request;
    private handleResponse;
}
