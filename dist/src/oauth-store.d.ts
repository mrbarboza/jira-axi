export interface OAuthSession {
    version: 1;
    accessToken: string;
    refreshToken: string;
    /** Epoch ms. */
    accessTokenExpiresAt: number;
    cloudId: string;
    scope: string;
}
/**
 * Reads the OAuth session for a host, or undefined if none is set or the
 * stored value can't be parsed (e.g. a pre-OAuth plaintext Basic-Auth token
 * left over from before this migration) — either way, the caller should
 * treat it as "not authenticated" rather than crash.
 */
export declare function getSession(host: string): OAuthSession | undefined;
/** Persists (or replaces) the OAuth session for a host as a single JSON blob. */
export declare function saveSession(host: string, session: OAuthSession): void;
export declare function hasSession(host: string): boolean;
