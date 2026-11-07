import { describe, expect, it } from "vitest";
import { Socket } from "node:net";
import { createNodeRateLimitStorage } from "../src/integrations/auth/node-rate-limit-storage";
import { nodeRequestHeaders } from "../src/interfaces/http/express-app";
import { createVoiceTokenLimiter } from "../src/integrations/voice/voice-token-limiter";

describe("single-process Node rate limits", () => {
  it("admits exactly the allowed number of simultaneous calls and resets on expiry", async () => {
    let time = 0; const storage = createNodeRateLimitStorage(() => time);
    const rule = { max: 5, window: 60 };
    const results = await Promise.all(Array.from({ length: 20 }, () => storage.consume("user", rule)));
    expect(results.filter(r => r.allowed)).toHaveLength(5);
    time = 59_001;
    expect(await storage.consume("user", rule)).toEqual({ allowed: false, retryAfter: 1 });
    time = 60_000;
    expect((await storage.consume("user", rule)).allowed).toBe(true);
  });
  it("bounds memory without evicting active counters and isolates provider namespaces", async () => {
    let time = 0; const storage = createNodeRateLimitStorage(() => time, 2);
    const voice = createVoiceTokenLimiter(storage, () => time, "voice");
    const planning = createVoiceTokenLimiter(storage, () => time, "planning");
    for (let i = 0; i < 5; i++) expect(await voice.consume("user")).toBe(true);
    expect(await voice.consume("user")).toBe(false);
    expect(await planning.consume("user")).toBe(true);
    expect((await storage.consume("new", { max: 1, window: 1 })).allowed).toBe(false);
    time = 60_000;
    expect((await storage.consume("new", { max: 1, window: 1 })).allowed).toBe(true);
  });
  it("overwrites spoofed client addresses and removes them when the socket has none", () => {
    const socket = new Socket();
    const headers = { "x-raahi-client-ip": "spoof", "x-forwarded-for": "spoof" };
    expect(nodeRequestHeaders({ socket, headers }).has("x-raahi-client-ip")).toBe(false);
    Object.defineProperty(socket, "remoteAddress", { value: "127.0.0.1" });
    expect(nodeRequestHeaders({ socket, headers }).get("x-raahi-client-ip")).toBe("127.0.0.1");
    socket.destroy();
  });
});
