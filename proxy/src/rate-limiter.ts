/**
 * Fixed-window per-key limiter. In-memory only: fine for a single stateless
 * instance, and the service has no other state to justify a shared store.
 * Restarting the process (a redeploy) simply resets everyone's window.
 */
export class RateLimiter {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number = 60_000,
  ) {}

  /** Returns true if the request under `key` is allowed, recording it either way. */
  allow(key: string, now: number): boolean {
    const window = this.windows.get(key);
    if (!window || now >= window.resetAt) {
      this.windows.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    if (window.count >= this.limit) {
      return false;
    }
    window.count += 1;
    return true;
  }
}
