import { afterEach, describe, expect, it, vi } from "vitest";
import { AiSdkPlanningModel } from "../src/integrations/ai/planning-model.ai-sdk";
import type { AiConfig } from "../src/config/env";

const config: AiConfig = {
  provider: "openai", model: "fixture-model", baseUrl: "https://model.example.test/v1",
  apiKey: "private-test-key", proactiveThreshold: 0.7, maxToolSteps: 16, telemetryRecordContent: false,
};
const intent = {
  origin: "Lucknow", partySize: 5, dayCount: 6, budgetRupees: "7000", budgetBasis: "per_person",
  currency: "INR", destinationHints: ["North India"], startDate: null, language: "en",
};
function completion(content: string) {
  return new Response(JSON.stringify({
    id: "test", object: "chat.completion", created: 1, model: "fixture-model",
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  }), { headers: { "Content-Type": "application/json" } });
}
afterEach(() => vi.unstubAllGlobals());

describe("planning AI SDK adapter with mocked HTTP", () => {
  it("validates a compatible structured response without exposing write tools", async () => {
    const fetcher = vi.fn(async () => completion(JSON.stringify(intent)));
    vi.stubGlobal("fetch", fetcher);
    expect(await new AiSdkPlanningModel(config).extract("Five friends from Lucknow", null)).toEqual(intent);
    const call = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[0]).toBe("https://model.example.test/v1/chat/completions");
    const body = JSON.parse(call[1].body as string);
    expect(body.tools).toBeUndefined();
    expect(body.messages[0].content).toContain("live weather");
    expect(body.messages[0].content).toContain("Never invent missing answers");
    expect(body.response_format.type).toBe("json_object");
  });
  it.each(["not JSON", JSON.stringify({ ...intent, partySize: -1 })])("rejects malformed or schema-invalid output", async (content) => {
    vi.stubGlobal("fetch", vi.fn(async () => completion(content)));
    await expect(new AiSdkPlanningModel(config).extract("Trip request", null)).rejects.toMatchObject({ code: "planning_invalid_output" });
  });
  it("sends the actual JSON schema to Google's compatible endpoint", async () => {
    const fetcher = vi.fn(async () => completion(JSON.stringify(intent)));
    vi.stubGlobal("fetch", fetcher);
    await new AiSdkPlanningModel({ ...config, baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/" }).extract("Five friends from Lucknow", null);
    const call = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(call[1].body as string);
    expect(body.response_format.type).toBe("json_schema");
    expect(body.response_format.json_schema.schema.required).toContain("budgetBasis");
    expect(body.response_format.json_schema.schema.properties.partySize).toBeDefined();
    expect(body.tools).toBeUndefined();
  });
  it("sanitizes provider outages and does not retry repeatedly", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ error: { message: "private provider details", type: "unavailable" } }), {
      status: 503, headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetcher);
    await expect(new AiSdkPlanningModel(config).extract("Trip request", null)).rejects.toMatchObject({ code: "planning_unavailable", message: "planning_unavailable" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

it("streams the model guidance before its complete structured proposal", async () => {
  const plan = {
    title: "Jaipur", guidance: { response: "Explore Jaipur slowly.", timing: "Start early.", questions: [] },
    days: [{ day: 1, city: "Jaipur", stops: [{ name: "Amber Fort", startMinute: 540, durationMinutes: 90 }] }],
    costs: { transport: null, accommodation: null, food: null, activities: null, buffer: null },
  };
  const json = JSON.stringify(plan);
  const chunks = [json.slice(0, 65), json.slice(65, 90), json.slice(90)];
  const events = chunks.map(content => `data: ${JSON.stringify({ id: "stream-test", object: "chat.completion.chunk", created: 1, model: "fixture-model", choices: [{ index: 0, delta: { content }, finish_reason: null }] })}\n\n`).join("") + 'data: [DONE]\n\n';
  const fetcher = vi.fn(async () => new Response(events, { headers: { "Content-Type": "text/event-stream" } }));
  vi.stubGlobal("fetch", fetcher);
  const onReply = vi.fn();
  const result = await new AiSdkPlanningModel(config).propose({ ...intent, budgetBasis: "per_person", currency: "INR", language: "en" }, null, { onReply, signal: new AbortController().signal });
  expect(result).toEqual(plan);
  expect(onReply).toHaveBeenCalledWith(plan.guidance.response);
  const call = fetcher.mock.calls[0] as unknown as [string, RequestInit];
  expect(JSON.parse(call[1].body as string).stream).toBe(true);
});

it("extracts validated intent through OpenRouter after a primary 429", async () => {
  const requests: Request[] = [];
  vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (input, init) => {
    requests.push(new Request(input, init));
    return requests.length === 1 ? Response.json({ error: { message: "Quota exceeded" } }, { status: 429 }) : completion(JSON.stringify(intent));
  }));
  const model = new AiSdkPlanningModel({ ...config, baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/", fallback: { apiKey: "fallback-test-key", model: "openrouter/free", cooldownMs: 60000 } });
  expect(await model.extract("Use my saved itinerary", { tripId: "trip", revision: 3, title: "My saved trip", intake: { partySize: 5 }, days: [] })).toEqual(intent);
  expect(requests[1]!.url).toBe("https://openrouter.ai/api/v1/chat/completions");
  const body = await requests[1]!.json() as { model: string; messages: unknown; response_format: { type: string } };
  expect(body.model).toBe("openrouter/free");
  expect(JSON.stringify(body.messages)).toContain("My saved trip");
  expect(body.response_format.type).toBe("json_schema");
});

it("keeps heavy proposals on Gemini even while extraction fallback is cooling down", async () => {
  const requests: Request[] = [];
  vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (input, init) => {
    const request = new Request(input, init); requests.push(request);
    return request.url.includes("openrouter.ai") ? completion(JSON.stringify(intent)) : Response.json({ error: { message: "Quota exceeded" } }, { status: 429 });
  }));
  const model = new AiSdkPlanningModel({ ...config, baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/", fallback: { apiKey: "fallback-test-key", model: "openrouter/free", cooldownMs: 60000 } });
  await model.extract("Five friends", null);
  await expect(model.propose({ ...intent, budgetBasis: "per_person", currency: "INR", language: "en" }, null)).rejects.toMatchObject({ code: "planning_primary_rate_limited" });
  expect(requests.map(r => new URL(r.url).hostname)).toEqual(["generativelanguage.googleapis.com", "openrouter.ai", "generativelanguage.googleapis.com"]);
});

it("emits partial guidance while the provider is still generating the itinerary", async () => {
  let source!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({ start(controller) { source = controller; } });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(stream, { headers: { "Content-Type": "text/event-stream" } })));
  const emit = (content: string) => source.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ id: "streaming", object: "chat.completion.chunk", created: 1, model: "fixture", choices: [{ index: 0, delta: { content }, finish_reason: null }] })}\n\n`));
  const reply = vi.fn();
  const plan = { guidance: { response: "Start at Haridwar, then explore the riverfront.", timing: "Check opening times.", questions: [] }, title: "Haridwar", days: [{ day: 1, city: "Haridwar", stops: [{ name: "Har Ki Pauri", startMinute: 600, durationMinutes: 60 }] }], costs: { transport: null, accommodation: null, food: null, activities: null, buffer: null } };
  const json = JSON.stringify(plan);
  const boundary = json.indexOf(", then");
  const pending = new AiSdkPlanningModel(config).propose({ ...intent, budgetBasis: "per_person", currency: "INR", language: "en" }, null, { onReply: reply, signal: new AbortController().signal });
  emit(json.slice(0, boundary));
  await vi.waitFor(() => expect(reply).toHaveBeenCalledWith("Start at Haridwar"));
  emit(json.slice(boundary));
  source.enqueue(new TextEncoder().encode("data: [DONE]\n\n")); source.close();
  await expect(pending).resolves.toEqual(plan);
  expect(reply).toHaveBeenLastCalledWith(plan.guidance.response);
});

it("does not switch a rate-limited streaming final reply to OpenRouter", async () => {
  const fetcher = vi.fn(async () => Response.json({ error: { message: "Quota exceeded" } }, { status: 429 }));
  vi.stubGlobal("fetch", fetcher);
  const model = new AiSdkPlanningModel({ ...config, baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/", fallback: { apiKey: "fallback-test-key", model: "openrouter/free", cooldownMs: 60000 } });
  await expect(model.propose({ ...intent, budgetBasis: "per_person", currency: "INR", language: "en" }, null, { onReply: vi.fn(), signal: new AbortController().signal })).rejects.toMatchObject({ code: "planning_primary_rate_limited" });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
