import { afterEach, expect, it, vi } from "vitest";
import { apiFetch } from "./client";
vi.mock("@/shared/config", () => ({ config: { baseUrl: "" } }));
afterEach(() => vi.unstubAllGlobals());
it("delivers partial replies before the result, including split UTF-8 frames", async () => {
  let source!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({ start(controller) { source = controller; } });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(stream, { headers: { "Content-Type": "application/x-ndjson" } })));
  const reply = vi.fn();
  const result = apiFetch("/api/planning/preview", {}, reply);
  const bytes = new TextEncoder().encode(JSON.stringify({ type: "reply", text: "जयपुर" }) + "\n");
  source.enqueue(bytes.slice(0, 27)); source.enqueue(bytes.slice(27));
  await vi.waitFor(() => expect(reply).toHaveBeenCalledWith("जयपुर"));
  source.enqueue(new TextEncoder().encode(JSON.stringify({ type: "result", data: { proposalId: "ready" } }) + "\n"));
  source.close();
  await expect(result).resolves.toEqual({ proposalId: "ready" });
});
it.each([
  ['{"type":"error","code":"planning_invalid_output"}\n', "planning_invalid_output"],
  ['{"type":"reply","text":"unfinished"}\n', "incomplete_stream"],
])("does not accept failed or truncated streams", async (body, code) => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { headers: { "Content-Type": "application/x-ndjson" } })));
  await expect(apiFetch("/api/planning/preview", {}, vi.fn())).rejects.toMatchObject({ code });
});
