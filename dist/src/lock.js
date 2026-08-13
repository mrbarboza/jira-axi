import { closeSync, mkdirSync, openSync, statSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const LOCK_DIR = join(tmpdir(), "jira-axi-locks");
const STALE_LOCK_MS = 30_000;
const POLL_INTERVAL_MS = 50;
export class LockTimeoutError extends Error {
    constructor(key) {
        super(`timed out waiting for the lock on "${key}"`);
        this.name = "LockTimeoutError";
    }
}
function lockPath(key) {
    return join(LOCK_DIR, `${key.replace(/[^a-zA-Z0-9._-]/g, "_")}.lock`);
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/** Removes a lock file left behind by a process that crashed while holding it. */
function clearIfStale(path) {
    try {
        if (Date.now() - statSync(path).mtimeMs > STALE_LOCK_MS) {
            unlinkSync(path);
        }
    }
    catch {
        // Lock was released or removed by another process between the stat and
        // the unlink; either way there's nothing left for us to clear.
    }
}
function tryAcquire(path) {
    try {
        closeSync(openSync(path, "wx"));
        return true;
    }
    catch (error) {
        if (error.code !== "EEXIST")
            throw error;
        clearIfStale(path);
        return false;
    }
}
/**
 * Serializes `fn` across concurrent jira-axi processes sharing the same
 * `key` (a Jira host), using an exclusive-create lock file in the OS temp
 * dir as a cross-process mutex. `open(..., "wx")` is atomic at the
 * filesystem level, unlike the Keychain's `security add-generic-password
 * -U`, which two concurrent processes can both observe as "no item yet" and
 * then race to create/update, so this lock exists specifically to keep two
 * jira-axi invocations from ever reaching that Keychain write at the same
 * time during a token refresh.
 */
export async function withLock(key, fn, timeoutMs = 10_000) {
    mkdirSync(LOCK_DIR, { recursive: true });
    const path = lockPath(key);
    const deadline = Date.now() + timeoutMs;
    while (!tryAcquire(path)) {
        if (Date.now() > deadline)
            throw new LockTimeoutError(key);
        await sleep(POLL_INTERVAL_MS);
    }
    try {
        return await fn();
    }
    finally {
        try {
            unlinkSync(path);
        }
        catch {
            // Already removed (e.g. by another process's stale-lock cleanup);
            // the lock is gone either way.
        }
    }
}
//# sourceMappingURL=lock.js.map