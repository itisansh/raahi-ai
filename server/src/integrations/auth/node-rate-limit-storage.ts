import type { AuthRateLimitStorage } from "./auth-rate-limit";

/** Atomic within one Node event loop. Deploy only one API process. */
export function createNodeRateLimitStorage(now = Date.now, capacity = 10_000): AuthRateLimitStorage {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return {
    async get() { throw new Error("Auth rate limiting requires atomic consume"); },
    async set() { throw new Error("Auth rate limiting requires atomic consume"); },
    async consume(key, rule) {
      if (!Number.isSafeInteger(rule.max) || rule.max < 1 || !Number.isSafeInteger(rule.window) || rule.window < 1 || rule.window > 86_400) throw new Error("Invalid rate limit rule");
      const time = now();
      for (const [id, bucket] of buckets) if (bucket.resetAt <= time) buckets.delete(id);
      let bucket = buckets.get(key);
      if (!bucket) {
        // Refuse new keys at capacity rather than evicting active limits.
        if (buckets.size >= capacity) return { allowed: false, retryAfter: 1 };
        bucket = { count: 0, resetAt: time + rule.window * 1000 };
        buckets.set(key, bucket);
      }
      if (bucket.count >= rule.max) return { allowed: false, retryAfter: Math.max(1, Math.ceil((bucket.resetAt - time) / 1000)) };
      bucket.count += 1;
      return { allowed: true, retryAfter: null };
    },
  };
}
