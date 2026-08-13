export declare class LockTimeoutError extends Error {
    constructor(key: string);
}
/**
 * Serializes `fn` across concurrent nu-jira-axi processes sharing the same
 * `key` (a Jira host), using an exclusive-create lock file in the OS temp
 * dir as a cross-process mutex. `open(..., "wx")` is atomic at the
 * filesystem level, unlike the Keychain's `security add-generic-password
 * -U`, which two concurrent processes can both observe as "no item yet" and
 * then race to create/update, so this lock exists specifically to keep two
 * nu-jira-axi invocations from ever reaching that Keychain write at the same
 * time during a token refresh.
 */
export declare function withLock<T>(key: string, fn: () => Promise<T>, timeoutMs?: number): Promise<T>;
