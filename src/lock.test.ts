import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { LockTimeoutError, withLock } from "./lock.js";

function uniqueKey(): string {
  return `test-${randomBytes(8).toString("hex")}`;
}

describe("withLock", () => {
  it("runs fn and returns its result", async () => {
    const result = await withLock(uniqueKey(), async () => 42);
    expect(result).toBe(42);
  });

  it("releases the lock after fn resolves, so a later call for the same key doesn't wait", async () => {
    const key = uniqueKey();
    await withLock(key, async () => "first");
    await expect(withLock(key, async () => "second", 200)).resolves.toBe("second");
  });

  it("releases the lock after fn throws", async () => {
    const key = uniqueKey();
    await expect(
      withLock(key, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    await expect(withLock(key, async () => "after-throw", 200)).resolves.toBe("after-throw");
  });

  it("serializes two concurrent callers for the same key: the second never runs while the first still holds the lock", async () => {
    const key = uniqueKey();
    let holders = 0;
    let maxConcurrentHolders = 0;

    async function criticalSection() {
      holders += 1;
      maxConcurrentHolders = Math.max(maxConcurrentHolders, holders);
      await new Promise((resolve) => setTimeout(resolve, 30));
      holders -= 1;
    }

    await Promise.all([withLock(key, criticalSection), withLock(key, criticalSection)]);

    expect(maxConcurrentHolders).toBe(1);
  });

  it("lets concurrent callers for different keys run without waiting on each other", async () => {
    let holders = 0;
    let maxConcurrentHolders = 0;

    async function criticalSection() {
      holders += 1;
      maxConcurrentHolders = Math.max(maxConcurrentHolders, holders);
      await new Promise((resolve) => setTimeout(resolve, 30));
      holders -= 1;
    }

    await Promise.all([withLock(uniqueKey(), criticalSection), withLock(uniqueKey(), criticalSection)]);

    expect(maxConcurrentHolders).toBe(2);
  });

  it("throws LockTimeoutError when the lock isn't released before the timeout", async () => {
    const key = uniqueKey();
    const holdForever = withLock(key, () => new Promise(() => {}));
    await expect(withLock(key, async () => "never", 100)).rejects.toThrow(LockTimeoutError);
    void holdForever;
  });
});
