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
