import { readSecret, writeSecret } from "./keychain.js";

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
export function getSession(host: string): OAuthSession | undefined {
  let raw: string;
  try {
    raw = readSecret(host);
  } catch {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw) as OAuthSession;
    if (parsed.version !== 1) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

/** Persists (or replaces) the OAuth session for a host as a single JSON blob. */
export function saveSession(host: string, session: OAuthSession): void {
  writeSecret(host, JSON.stringify(session));
}

export function hasSession(host: string): boolean {
  return getSession(host) !== undefined;
}
