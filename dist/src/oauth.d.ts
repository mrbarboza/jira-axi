export declare function randomState(): string;
export declare function buildAuthorizeUrl(state: string): URL;
export interface TokenExchangeResult {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    scope: string;
}
/**
 * Exchanges an authorization code for tokens via the ADR-0003 proxy, which
 * holds the real `client_secret` server-side. The CLI itself never sees it.
 */
export declare function exchangeCodeForToken(code: string): Promise<TokenExchangeResult>;
export declare function refreshAccessToken(refreshToken: string): Promise<TokenExchangeResult>;
export interface AccessibleResource {
    id: string;
    name: string;
    url: string;
    scopes: string[];
}
export declare function fetchAccessibleResources(accessToken: string): Promise<AccessibleResource[]>;
export interface CallbackResult {
    code: string;
}
/**
 * Listens on 127.0.0.1 only (never 0.0.0.0) for the OAuth redirect, resolving
 * once a request with a matching `state` arrives. Closes the server on every
 * exit path so an interrupted `setup auth` never leaks a listening socket.
 */
export declare function listenForCallback(expectedState: string, host: string, port?: number, timeoutMs?: number): Promise<CallbackResult>;
