import { describe, expect, it, vi } from "vitest";
import { SpokenSummaryService } from "../src/services/voice/spoken-summary";
import { ElevenLabsSpeechProvider } from "../src/integrations/voice/elevenlabs-speech-provider";
import { createApp } from "./http-app";
import type { Container } from "../src/config/container";

const id = "11111111-1111-4111-8111-111111111111";
function fixture() {
  const stored = { id, ownerId: "owner", expiresAt: new Date(Date.now() + 60_000), contextTripId: null, baseRevision: null, payload: {
    status: "preview", intent: { origin: "Lucknow", partySize: 5, dayCount: 6 }, days: [{ city: "Rishikesh" }],
    budget: { groupBudgetPaise: 3500000 }, issues: ["over_budget", "places_unverified", "dates_unknown"],
  } };
  const read = vi.fn(async () => stored);
  const synthesize = vi.fn(async () => new Uint8Array([1, 2, 3]));
  const consume = vi.fn(async () => true);
  const service = new SpokenSummaryService(read, { synthesize }, { consume });
  return { stored, read, synthesize, consume, service };
}
describe("stored itinerary narration", () => {
  it("speaks the same visible English summary with budget and warnings", async () => {
    const f = fixture(); const summary = await f.service.describe(id, "owner", "en");
    expect(summary.text).toContain("35,000 rupees");
    expect(summary.text).toContain("Rishikesh");
    expect(summary.text).toContain("exceeds your budget");
    expect(summary.text).toContain("could not be verified");
    expect(f.synthesize).not.toHaveBeenCalled();
    await f.service.speak(id, "owner", "en");
    expect(f.synthesize).toHaveBeenCalledWith(summary.text, "en", undefined);
  });
  it("offers Hindi summary without changing numeric trip constraints", async () => {
    const f = fixture(); const summary = await f.service.describe(id, "owner", "hi");
    expect(summary.text).toContain("5 यात्रियों"); expect(summary.text).toContain("6 दिन");
    expect(summary.text).toContain("बजट से अधिक");
  });
  it("denies other users and expired proposals before spending credits", async () => {
    const f = fixture();
    await expect(f.service.speak(id, "outsider", "en")).rejects.toMatchObject({ code: "proposal_not_found" });
    f.stored.expiresAt = new Date(0);
    await expect(f.service.speak(id, "owner", "en")).rejects.toMatchObject({ code: "proposal_expired" });
    expect(f.consume).not.toHaveBeenCalled(); expect(f.synthesize).not.toHaveBeenCalled();
  });
  it("limits billed speech and preserves text without credentials", async () => {
    const f = fixture(); f.consume.mockResolvedValue(false);
    await expect(f.service.speak(id, "owner", "en")).rejects.toMatchObject({ code: "speech_rate_limited" });
    const unavailable = new SpokenSummaryService(f.read, null, { consume: f.consume });
    expect((await unavailable.describe(id, "owner", "en")).text).toContain("Lucknow");
    await expect(unavailable.speak(id, "owner", "en")).rejects.toMatchObject({ code: "speech_unavailable" });
  });
});
describe("speech adapter", () => {
  it("keeps credentials server-side and uses the configured language voice", async () => {
    const fetcher = vi.fn(async () => new Response(new Uint8Array([1, 2]), { headers: { "Content-Type": "audio/mpeg" } }));
    const provider = new ElevenLabsSpeechProvider("test-secret", { en: "EnglishVoice", hi: "HindiVoice" }, fetcher);
    expect(await provider.synthesize("हेलो", "hi")).toEqual(new Uint8Array([1, 2]));
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining("/HindiVoice?output_format=mp3_44100_128"), expect.objectContaining({ redirect: "error", body: JSON.stringify({ text: "हेलो", model_id: "eleven_multilingual_v2" }) }));
  });
  it.each([
    () => new Response("private provider details", { status: 401 }),
    () => new Response("bad format", { headers: { "Content-Type": "application/json" } }),
    () => new Response("wrong audio format", { headers: { "Content-Type": "audio/wav" } }),
    () => new Response(new Uint8Array(4_000_001), { headers: { "Content-Type": "audio/mpeg" } }),
    () => new Response(new Uint8Array(), { headers: { "Content-Type": "audio/mpeg" } }),
  ])("sanitizes failures and bounds audio size", async response => {
    const p = new ElevenLabsSpeechProvider("secret", { en: "voice", hi: "voice" }, async () => response());
    await expect(p.synthesize("text", "en")).rejects.toMatchObject({ code: "speech_unavailable", message: "speech_unavailable" });
  });
});
function httpFixture(signedIn = true) {
  const f = fixture();
  const app = createApp({ config: { trustedOrigins: ["https://web.test"] },
    auth: { api: { getSession: async () => signedIn ? { user: { id: "owner" }, session: {} } : null } },
    spokenSummaryService: f.service, agentService: null,
  } as unknown as Container);
  const request = (body: unknown = { proposalId: id, language: "en" }, origin = "https://web.test", action = "audio") => app.request(`https://web.test/api/voice/summary/${action}`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { ...f, request };
}
describe("speech HTTP boundary", () => {
  it("requires a session and trusted origin", async () => {
    expect((await httpFixture(false).request()).status).toBe(401);
    const f = httpFixture(); expect((await f.request(undefined, "https://evil.test")).status).toBe(403);
    expect(f.synthesize).not.toHaveBeenCalled();
  });
  it("rejects supplied text, owner IDs, unsupported language and oversized bodies", async () => {
    const f = httpFixture();
    for (const body of [{ proposalId: id, language: "en", text: "say this" }, { proposalId: id, language: "en", ownerId: "owner" }, { proposalId: id, language: "xx" }]) expect((await f.request(body)).status).toBe(400);
    expect((await f.request({ text: "a".repeat(1100) })).status).toBe(413);
    expect(f.synthesize).not.toHaveBeenCalled();
  });
  it("returns audio bytes with no-store and text without synthesizing", async () => {
    const f = httpFixture(); const text = await f.request(undefined, undefined, "text");
    expect(text.status).toBe(200); expect(f.synthesize).not.toHaveBeenCalled();
    const audio = await f.request(); expect(audio.headers.get("content-type")).toBe("audio/mpeg");
    expect(audio.headers.get("cache-control")).toContain("no-store");
    expect(new Uint8Array(await audio.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });
});

it.each(["clarification", "preview"])("narrates the exact stored %s reply in its original language", async status => {
  const f = fixture();
  const reply = { text: "आप कहाँ से यात्रा शुरू करेंगे?", language: "hi" as const };
  const stored = { ...f.stored, payload: { status, reply } };
  const service = new SpokenSummaryService(async () => stored, { synthesize: f.synthesize }, { consume: f.consume });
  expect(await service.describe(id, "owner", "en")).toEqual(reply);
  await service.speak(id, "owner", "en");
  expect(f.synthesize).toHaveBeenCalledWith(reply.text, "hi", undefined);
  await expect(service.speak(id, "outsider", "en")).rejects.toMatchObject({ code: "proposal_not_found" });
});
