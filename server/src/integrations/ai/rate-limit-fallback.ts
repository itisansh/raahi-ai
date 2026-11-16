/** Compatible-provider failover occurs before a response stream starts, so partial
 * replies and already emitted tool calls are never replayed on another model. */
export interface FreeFallbackConfig { apiKey: string; model: string; cooldownMs: number; }
export function createRateLimitFallbackFetch(config: FreeFallbackConfig, request: typeof fetch = fetch, now = Date.now): typeof fetch {
  let retryPrimaryAt = 0;
  let probing = false;
  const fallback = async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const original = new Request(input, init);
    const body = JSON.parse(await original.text()) as Record<string, unknown>;
    const headers = new Headers({ "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` });
    return request("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST", headers, body: JSON.stringify({ ...body, model: config.model }), signal: original.signal,
    });
  };
  return async (input, init) => {
    if (init?.signal?.aborted) throw init.signal.reason;
    if (now() < retryPrimaryAt || probing) return fallback(input, init);
    const isProbe = retryPrimaryAt > 0;
    if (isProbe) probing = true;
    // Clone once: both requests need their own unconsumed body and cancellation.
    const original = new Request(input, init);
    try {
      const response = await request(original.clone());
      if (response.status !== 429) {
        if (response.ok) retryPrimaryAt = 0;
        return response;
      }
      const retryAfter = response.headers.get("retry-after");
      const seconds = retryAfter == null ? NaN : Number(retryAfter);
      const headerDelay = Number.isFinite(seconds) ? seconds * 1000 : retryAfter ? Date.parse(retryAfter) - now() : 0;
      retryPrimaryAt = now() + Math.max(config.cooldownMs, Number.isFinite(headerDelay) ? headerDelay : 0);
      await response.body?.cancel();
      return fallback(original);
    } finally { if (isProbe) probing = false; }
  };
}
