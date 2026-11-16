import { expect, it, vi } from "vitest";
import { createRateLimitFallbackFetch } from "../src/integrations/ai/rate-limit-fallback";
const config = { apiKey: "fallback-test-key", model: "openrouter/free", cooldownMs: 60000 };
const input = () => new Request("https://primary.example/v1/chat/completions", { method: "POST", headers: { Authorization: "Bearer primary-test-key", "content-type": "application/json" }, body: JSON.stringify({ model: "gemini", messages: [{ role: "user", content: "Trip context" }], stream: true, tools: [{ type: "function" }] }) });
it("fails over on 429, preserves context and tools, and returns to primary after cooldown", async () => {
  let time = 0;
  const calls: Request[] = [];
  const transport = vi.fn<typeof fetch>(async (url, options) => {
    const req = new Request(url, options); calls.push(req);
    return calls.length === 1 ? new Response("limit", { status: 429, headers: { "retry-after": "120" } }) : Response.json({ ok: true });
  });
  const routed = createRateLimitFallbackFetch(config, transport, () => time);
  expect((await routed(input())).status).toBe(200);
  expect(calls[1]!.url).toBe("https://openrouter.ai/api/v1/chat/completions");
  expect(calls[1]!.headers.get("authorization")).toBe("Bearer fallback-test-key");
  expect(await calls[1]!.json()).toMatchObject({ model: "openrouter/free", messages: [{ content: "Trip context" }], stream: true, tools: [{ type: "function" }] });
  time = 60001; await routed(input()); expect(calls[2]!.url).toContain("openrouter.ai");
  time = 120001; await routed(input()); expect(calls[3]!.url).toContain("primary.example");
  await routed(input()); expect(calls[4]!.url).toContain("primary.example");
});
it.each([400, 401, 403, 500])("does not hide non-rate-limit errors (%s)", async status => {
  const transport = vi.fn<typeof fetch>(async () => new Response("error", { status }));
  expect((await createRateLimitFallbackFetch(config, transport)(input())).status).toBe(status);
  expect(transport).toHaveBeenCalledTimes(1);
});
it("propagates fallback limits without a retry loop", async () => {
  const transport = vi.fn<typeof fetch>(async () => new Response("limit", { status: 429 }));
  expect((await createRateLimitFallbackFetch(config, transport)(input())).status).toBe(429);
  expect(transport).toHaveBeenCalledTimes(2);
});
it("does not replay an already-started stream", async () => {
  const transport = vi.fn<typeof fetch>(async () => new Response('data: {"error":"quota"}\n\n', { headers: { "content-type": "text/event-stream" } }));
  const response = await createRateLimitFallbackFetch(config, transport)(input());
  expect(await response.text()).toContain("quota"); expect(transport).toHaveBeenCalledTimes(1);
});
it("preserves cancellation without calling providers", async () => {
  const controller = new AbortController(); controller.abort();
  const transport = vi.fn<typeof fetch>();
  await expect(createRateLimitFallbackFetch(config, transport)(input(), { signal: controller.signal })).rejects.toBeDefined();
  expect(transport).not.toHaveBeenCalled();
});
it("allows only one primary probe while other requests use fallback", async () => {
  let time = 0; let release!: (response: Response) => void; let primaryCalls = 0;
  const transport = vi.fn<typeof fetch>(async (url, options) => {
    const req = new Request(url, options);
    if (req.url.includes("openrouter.ai")) return Response.json({ ok: true });
    primaryCalls++;
    if (primaryCalls === 1) return new Response("limit", { status: 429 });
    return new Promise<Response>(resolve => { release = resolve; });
  });
  const routed = createRateLimitFallbackFetch(config, transport, () => time);
  await routed(input()); time = 60001;
  const probe = routed(input());
  await routed(input()); expect(primaryCalls).toBe(2);
  release(Response.json({ ok: true })); await probe;
});
