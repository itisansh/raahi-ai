import { VoiceError, type VoiceTokenLimiter } from "../../services/voice/voice-token-service";
import type { AuthRateLimitStorage } from "../auth/auth-rate-limit";

/** Reuses the atomic Durable Object limiter on Workers; Node has one container. */
export function createVoiceTokenLimiter(
  shared?: AuthRateLimitStorage,
  now: () => number = Date.now,
  namespace = "voice-token",
): VoiceTokenLimiter {
  const buckets = new Map<string, { count: number; expiresAt: number }>();
  return {
    async consume(userId) {
      if (shared) {
        try {
          const decision = await shared.consume(`${namespace}:${userId}`, { window: 60, max: 5 });
          return decision.allowed;
        } catch {
          throw new VoiceError("voice_unavailable");
        }
      }
      const time = now();
      for (const [key, bucket] of buckets) {
        if (bucket.expiresAt <= time) buckets.delete(key);
      }
      let bucket = buckets.get(userId);
      if (!bucket) {
        if (buckets.size >= 10_000) throw new VoiceError("voice_unavailable");
        bucket = { count: 0, expiresAt: time + 60_000 };
        buckets.set(userId, bucket);
      }
      if (bucket.count >= 5) return false;
      bucket.count += 1;
      return true;
    },
  };
}
