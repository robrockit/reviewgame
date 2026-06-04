/**
 * Simple in-memory sliding-window rate limiter.
 *
 * Suitable for per-serverless-instance protection (e.g. Vercel functions).
 * State resets on cold starts, which is acceptable for classroom-scale traffic.
 * For distributed rate limiting across instances, use Redis or a managed service.
 */
export class RateLimiter {
  private readonly records = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly windowMs: number,
    private readonly maxRequests: number,
  ) {}

  /** Returns true if the given key has exceeded the limit, false otherwise. */
  isRateLimited(key: string): boolean {
    const now = Date.now();
    const record = this.records.get(key);

    if (!record || now > record.resetAt) {
      this.records.set(key, { count: 1, resetAt: now + this.windowMs });
      return false;
    }

    record.count++;
    return record.count > this.maxRequests;
  }

  /** Prune expired entries to prevent unbounded map growth. Call periodically. */
  cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.records.entries()) {
      if (now > record.resetAt) this.records.delete(key);
    }
  }
}
