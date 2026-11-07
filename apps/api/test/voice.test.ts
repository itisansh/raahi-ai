import { describe, expect, it, vi } from "vitest";
import { VoiceTokenService } from "../src/services/voice/voice-token-service";
import { ElevenLabsTokenProvider } from "../src/integrations/voice/elevenlabs-token-provider";
import { createVoiceTokenLimiter } from "../src/integrations/voice/voice-token-limiter";
import type { Container } from "../src/config/container";
import type { AuthRateLimitStorage } from "../src/integrations/auth/auth-rate-limit";
import { createApp } from "./http-app";

function fixture(authenticated = true, configured = true) {
  const createToken = vi.fn(async () => ({ token: "single-use-test-token" }));
  const service = new VoiceTokenService(configured ? { createToken } : null, createVoiceTokenLimiter());
  const app = createApp({
    config: { trustedOrigins: ["https://web.example.test"], betterAuthUrl: "https://api.example.test" },
    auth: { api: { getSession: vi.fn(async () => authenticated ? { user: { id: "user-1" }, session: { id: "session-1" } } : null) } },
    voiceTokenService: service,
    agentService: null,
  } as unknown as Container);
  const request = (origin: string | null = "https://web.example.test") => app.request("https://api.example.test/api/voice/token", {
    method: "POST", headers: origin ? { Origin: origin } : {},
  });
  return { request, createToken };
}

describe("voice token HTTP boundary", () => {
  it("requires authentication before issuing any token", async () => {
    const { request, createToken } = fixture(false);
    expect((await request()).status).toBe(401);
    expect(createToken).not.toHaveBeenCalled();
  });
  it.each([null, "https://attacker.example.test", "null"])("rejects untrusted origin %s", async (origin) => {
    const { request, createToken } = fixture();
    expect((await request(origin)).status).toBe(403);
    expect(createToken).not.toHaveBeenCalled();
  });
  it("returns only an uncached short-lived token", async () => {
    const response = await fixture().request();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ data: { token: "single-use-test-token" } });
  });
  it("returns a typed unavailable response with no configured key", async () => {
    const response = await fixture(true, false).request();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: "voice_unavailable" } });
  });
  it("limits issuance to five attempts per minute per user", async () => {
    const { request, createToken } = fixture();
    for (let i = 0; i < 5; i++) expect((await request()).status).toBe(200);
    const response = await request();
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(createToken).toHaveBeenCalledTimes(5);
  });
});

describe("ElevenLabs token adapter", () => {
  it("uses the fixed scoped endpoint and drops unexpected response fields", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ token: "short-lived", privateField: "ignored" })));
    const provider = new ElevenLabsTokenProvider("private-test-key", fetcher);
    expect(await provider.createToken()).toEqual({ token: "short-lived" });
    expect(fetcher).toHaveBeenCalledWith("https://api.elevenlabs.io/v1/single-use-token/realtime_scribe", {
      method: "POST", headers: { "xi-api-key": "private-test-key" }, signal: expect.any(AbortSignal), redirect: "error",
    });
  });
  it.each([new Response("private upstream details", { status: 429 }), new Response('{"token":""}'), new Response("not json")])("sanitizes failed or malformed provider responses", async (response) => {
    const provider = new ElevenLabsTokenProvider("private-test-key", async () => response);
    await expect(provider.createToken()).rejects.toMatchObject({ code: "voice_unavailable" });
  });
  it("sanitizes network/timeout failures", async () => {
    const provider = new ElevenLabsTokenProvider("private-test-key", async () => { throw new Error("private upstream details"); });
    await expect(provider.createToken()).rejects.toThrow("Voice input is unavailable");
  });
});

describe("voice issuance limiter", () => {
  it("keeps user buckets separate and expires the window", async () => {
    let now = 0;
    const limiter = createVoiceTokenLimiter(undefined, () => now);
    for (let i = 0; i < 5; i++) expect(await limiter.consume("a")).toBe(true);
    expect(await limiter.consume("a")).toBe(false);
    expect(await limiter.consume("b")).toBe(true);
    now = 60_000;
    expect(await limiter.consume("a")).toBe(true);
  });
  it("uses atomic shared storage and fails closed when it is unavailable", async () => {
    const consume = vi.fn(async () => ({ allowed: false, retryAfter: 60 }));
    const limiter = createVoiceTokenLimiter({ consume } as unknown as AuthRateLimitStorage);
    expect(await limiter.consume("a")).toBe(false);
    expect(consume).toHaveBeenCalledWith("voice-token:a", { window: 60, max: 5 });
    consume.mockRejectedValueOnce(new Error("storage unavailable"));
    await expect(limiter.consume("a")).rejects.toMatchObject({ code: "voice_unavailable" });
  });
});
