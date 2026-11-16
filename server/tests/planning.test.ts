import { describe, expect, it, vi } from "vitest";
import { PlanningService } from "../src/services/planning/planning-service";
import { PlanningError, rupeesToPaise, tripIntentSchema, type Candidate, type TripIntent } from "../src/services/planning/contracts";
import { ForbiddenError } from "../src/services/use-cases";
import type { Container } from "../src/config/container";
import { createApp } from "./http-app";

const intent: TripIntent = {
  origin: "Lucknow", partySize: 5, dayCount: 6, budgetRupees: "7000",
  budgetBasis: "per_person", currency: "INR", destinationHints: ["North India"],
  startDate: null, language: "hinglish",
};
function candidate(): Candidate {
  return {
    title: "Rishikesh",
    days: Array.from({ length: 6 }, (_, i) => ({
      day: i + 1, city: "Rishikesh", stops: [{ name: "Triveni Ghat", startMinute: 900, durationMinutes: 60 }],
    })),
    costs: {
      transport: { minRupees: "1000", maxRupees: "1500" },
      accommodation: { minRupees: "1500", maxRupees: "2000" },
      food: { minRupees: "1200", maxRupees: "1500" },
      activities: { minRupees: "0", maxRupees: "500" },
      buffer: { minRupees: "500", maxRupees: "500" },
    },
  };
}
const prompt = "We are five friends from Lucknow, six days, ₹7,000 per person. Suggest North India.";
function fixture(extracted: unknown = intent, plan: unknown = candidate()) {
  const model = { extract: vi.fn(async () => extracted), propose: vi.fn(async () => plan) };
  const geo = {
    placeSearch: vi.fn(async ({ query }: { query: string }) => [{
      id: query.startsWith("Lucknow") ? "origin" : "ghat", name: query.startsWith("Lucknow") ? "Lucknow" : "Triveni Ghat",
      label: query, lat: 30, lng: 78, categories: [], address: { countryCode: "in" },
    }]),
    routeCompute: vi.fn(async () => ({ distanceMeters: 100_000, durationSeconds: 3600, legs: [], mode: "driving" as const })),
  };
  const context = vi.fn(async () => ({ tripId: "trip", revision: 7, title: "Trip", intake: null, days: [] }));
  const limiter = { consume: vi.fn(async () => true) };
  return { model, geo, context, limiter, service: new PlanningService(model, geo, "osm", context, limiter) };
}

describe("planning constraints and arithmetic", () => {
  it.each([["7000", 700000], ["0.29", 29], ["7000.01", 700001]])("converts %s exactly to paise", (value, expected) => {
    expect(rupeesToPaise(value as string)).toBe(expected);
  });
  it.each(["NaN", "-1", "1.001", "1e3", "999999999999999999999", "7,000"]) ("rejects unnormalized money %s", (value) => {
    expect(() => rupeesToPaise(value)).toThrow();
  });
  it("preserves stated timing preferences and returns general model guidance separately from evidence", async () => {
    const guidance = { response: "A relaxed route fits your request.", timing: "Dates are undecided; current access is unverified.", questions: ["Which month can you travel?"] };
    const f = fixture({ ...intent, travelPreferences: "Strict cap, relaxed mornings, dates undecided" }, { ...candidate(), guidance });
    const result = await f.service.preview("user", { prompt });
    expect(f.model.propose).toHaveBeenCalledWith(expect.objectContaining({ travelPreferences: "Strict cap, relaxed mornings, dates undecided" }), null);
    expect(result).toMatchObject({ status: "preview", guidance, saved: false });
  });
  it("builds a six-day preview with deterministic group costs and source coordinates", async () => {
    const f = fixture();
    const result = await f.service.preview("user", { prompt });
    expect(result.status).toBe("preview");
    if (result.status !== "preview") throw new Error("Expected preview");
    expect(result.saved).toBe(false);
    expect(result.intent).toMatchObject({ partySize: 5, dayCount: 6, startDate: null });
    expect(result.budget).toMatchObject({ groupBudgetPaise: 3500000, knownMaxPerPersonPaise: 600000, knownMaxGroupPaise: 3000000 });
    expect(result.days).toHaveLength(6);
    expect(result.days[0]!.stops[0]!.evidence).toMatchObject({ status: "matched", source: "osm", place: { lat: 30, lng: 78 } });
    expect(result.issues).toEqual(["dates_unknown"]);
    expect(f.geo.placeSearch).toHaveBeenCalledTimes(2);
    expect(f.context).not.toHaveBeenCalled();
  });
  it("does not multiply a group budget again", async () => {
    const result = await fixture({ ...intent, budgetBasis: "group" }).service.preview("u", { prompt });
    if (result.status !== "preview") throw new Error("Expected preview");
    expect(result.budget.groupBudgetPaise).toBe(700000);
    expect(result.issues).toContain("over_budget");
  });
  it("asks for missing information before planning or place lookup", async () => {
    const f = fixture({ ...intent, origin: null, budgetBasis: null });
    expect(await f.service.preview("u", { prompt })).toMatchObject({ status: "clarification", missing: ["origin", "budgetBasis"] });
    expect(f.model.propose).not.toHaveBeenCalled();
    expect(f.geo.placeSearch).not.toHaveBeenCalled();
  });
  it("rejects nonexistent dates and malformed constraints", async () => {
    expect(tripIntentSchema.safeParse({ ...intent, startDate: "2027-02-30" }).success).toBe(false);
    await expect(fixture({ ...intent, partySize: 5.5 }).service.preview("u", { prompt })).rejects.toMatchObject({ code: "planning_invalid_output" });
  });
  it("rejects bad model JSON, missing days, fabricated coordinates and reversed ranges", async () => {
    const reversed = candidate(); reversed.costs.food = { minRupees: "20", maxRupees: "10" };
    const extra = candidate(); Object.assign(extra.days[0]!.stops[0]!, { lat: 28, lng: 77 });
    for (const plan of ["not json", { ...candidate(), days: [] }, reversed, extra]) {
      await expect(fixture(intent, plan).service.preview("u", { prompt })).rejects.toMatchObject({ code: "planning_invalid_output" });
    }
  });
  it("marks unknown estimates incomplete instead of treating them as free", async () => {
    const plan = candidate(); plan.costs.transport = null;
    const result = await fixture(intent, plan).service.preview("u", { prompt });
    if (result.status !== "preview") throw new Error("Expected preview");
    expect(result.budget.status).toBe("incomplete");
    expect(result.budget.estimates[0]!.minPaise).toBeNull();
  });
});

describe("planning evidence and permissions", () => {
  it("preserves a preview with explicit unavailable evidence on provider outage", async () => {
    const f = fixture(); f.geo.placeSearch.mockRejectedValue(new Error("provider down"));
    const result = await f.service.preview("u", { prompt });
    if (result.status !== "preview") throw new Error("Expected preview");
    expect(result.days[0]!.stops[0]!.evidence.place).toBeNull();
    expect(result.issues).toEqual(expect.arrayContaining(["places_unverified", "routes_unverified", "return_travel_unverified"]));
    expect(f.geo.routeCompute).not.toHaveBeenCalled();
  });
  it("does not accept an unrelated or ambiguous first search result", async () => {
    const f = fixture();
    f.geo.placeSearch.mockResolvedValue([{ id: "wrong", name: "Other place", label: "Rishikesh", lat: 28, lng: 77, categories: [], address: { countryCode: "in" } }]);
    const result = await f.service.preview("u", { prompt });
    if (result.status !== "preview") throw new Error("Expected preview");
    expect(result.days[0]!.stops[0]!.evidence).toMatchObject({ status: "ambiguous", place: null });
  });
  it("flags impossible outbound and return connections", async () => {
    const f = fixture();
    f.geo.routeCompute.mockResolvedValue({ distanceMeters: 1000000, durationSeconds: 24 * 3600, legs: [], mode: "driving" });
    const result = await f.service.preview("u", { prompt });
    if (result.status !== "preview") throw new Error("Expected preview");
    expect(result.issues).toContain("schedule_infeasible");
  });
  it("checks trip access before spending provider quota", async () => {
    const f = fixture(); f.context.mockRejectedValue(new ForbiddenError("trip_forbidden", "Trip access denied"));
    await expect(f.service.preview("outsider", { prompt, tripId: "private-trip" })).rejects.toBeInstanceOf(ForbiddenError);
    expect(f.model.extract).not.toHaveBeenCalled();
  });
  it("loads scoped persisted context with its revision", async () => {
    const f = fixture(); const result = await f.service.preview("member", { prompt, tripId: "trip" });
    expect(f.context).toHaveBeenCalledWith("trip", "member");
    expect(f.model.extract).toHaveBeenCalledWith(prompt, expect.objectContaining({ revision: 7 }));
    expect(result).toMatchObject({ status: "preview", contextRevision: 7 });
  });
  it("fails closed on rate limit or missing provider", async () => {
    const f = fixture(); f.limiter.consume.mockResolvedValue(false);
    await expect(f.service.preview("u", { prompt })).rejects.toMatchObject({ code: "planning_rate_limited" });
    expect(f.model.extract).not.toHaveBeenCalled();
    const service = new PlanningService(null, f.geo, "osm", f.context, f.limiter);
    await expect(service.preview("u", { prompt })).rejects.toMatchObject({ code: "planning_unavailable" });
  });
});

function httpFixture(authenticated = true) {
  const preview = vi.fn(async () => ({ status: "clarification", missing: ["origin"] }));
  const app = createApp({
    config: { trustedOrigins: ["https://web.example.test"], betterAuthUrl: "https://web.example.test" },
    auth: { api: { getSession: vi.fn(async () => authenticated ? { user: { id: "u" }, session: { id: "s" } } : null) } },
    planningService: { preview }, agentService: null,
  } as unknown as Container);
  const request = (body: unknown = { prompt }, origin = "https://web.example.test") => app.request("https://web.example.test/api/planning/preview", {
    method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  return { request, preview, app };
}
describe("planning HTTP boundary", () => {
  it("requires authentication and trusted Origin", async () => {
    expect((await httpFixture(false).request()).status).toBe(401);
    const f = httpFixture(); expect((await f.request({ prompt }, "https://attacker.test")).status).toBe(403);
    expect(f.preview).not.toHaveBeenCalled();
  });
  it("rejects oversized and malformed input before model execution", async () => {
    const f = httpFixture();
    expect((await f.request({ prompt: "x".repeat(21000) })).status).toBe(413);
    expect((await f.request({ prompt: "   " })).status).toBe(400);
    expect(f.preview).not.toHaveBeenCalled();
  });
  it("returns uncached results and sanitized rate/provider errors", async () => {
    const f = httpFixture();
    expect((await f.request()).headers.get("cache-control")).toBe("private, no-store");
    f.preview.mockRejectedValue(new PlanningError("planning_rate_limited"));
    const limited = await f.request(); expect(limited.status).toBe(429); expect(limited.headers.get("retry-after")).toBe("60");
    f.preview.mockRejectedValue(new PlanningError("planning_unavailable"));
    expect((await f.request()).status).toBe(503);
  });
});

it("stores a short conversational clarification for owner-scoped speech without creating a trip", async () => {
  const f = fixture({ ...intent, origin: null, budgetBasis: null });
  const save = vi.fn(async () => {});
  const approve = vi.fn();
  const service = new PlanningService(f.model, f.geo, "osm", f.context, f.limiter, { save, approve });
  const result = await service.preview("owner", { prompt: "Goa" });
  expect(result.status).toBe("clarification");
  expect(result.reply.language).toBe("hi");
  expect(result.reply.text).toContain("कहाँ");
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ ownerId: "owner", id: result.proposalId, payload: result }));
  expect(approve).not.toHaveBeenCalled(); expect(f.model.propose).not.toHaveBeenCalled();
});

it("checks additions against retained times and permits unchanged days", async () => {
  const plan = candidate();
  plan.days.slice(1).forEach(day => { day.stops = []; });
  const f = fixture(intent, plan);
  const store = { supportsExisting: true, save: vi.fn(async () => {}), approve: vi.fn() };
  const existingPlan = {
    currency: "INR", startDate: "", days: plan.days.map(day => ({ number: day.day, date: "", dateLabel: "", city: day.city, color: "" })),
    stops: [{ id: "retained", day: 1, name: "Existing museum", time: "10:00", duration: "1 hour", lat: 30, lng: 78 }],
  };
  const context = { tripId: "existing", revision: 4, title: "Existing trip", intake: null, days: existingPlan.days, canEdit: true, existingPlan };
  const service = new PlanningService(f.model, f.geo, "osm", async () => context as never, f.limiter, store);
  const preview = await service.preview("owner", { prompt, tripId: "existing" });
  expect(preview).toMatchObject({ status: "preview", changeMode: "append_stops", costScope: "additions", approvable: true, retainedStops: [{ id: "retained" }] });
  existingPlan.stops[0]!.time = "14:30";
  const conflict = await service.preview("owner", { prompt, tripId: "existing" });
  expect(conflict).toMatchObject({ approvable: false, issues: expect.arrayContaining(["schedule_infeasible"]) });
  existingPlan.stops[0]!.duration = "later";
  expect(await service.preview("owner", { prompt, tripId: "existing" })).toMatchObject({ approvable: false, issues: expect.arrayContaining(["existing_schedule_unverified"]) });
});


it("streams draft reply events before the validated planning result", async () => {
  const f = httpFixture();
  let complete!: () => void;
  f.preview.mockImplementation((...args: unknown[]) => {
    const progress = args[2] as { onReply: (text: string) => void };
    progress.onReply("Draft from the model");
    return new Promise(resolve => { complete = () => resolve({ status: "clarification", missing: ["origin"] }); });
  });
  const response = await f.app.request("https://web.example.test/api/planning/preview", {
    method: "POST", headers: { Origin: "https://web.example.test", "Content-Type": "application/json", Accept: "application/x-ndjson" }, body: JSON.stringify({ prompt }),
  });
  expect(response.headers.get("content-type")).toContain("application/x-ndjson");
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let received = "";
  while (!received.includes('"type":"reply"')) received += decoder.decode((await reader.read()).value);
  expect(received).toContain("Draft from the model");
  expect(received).not.toContain('"type":"result"');
  complete();
  while (true) { const chunk = await reader.read(); if (chunk.done) break; received += decoder.decode(chunk.value); }
  expect(received).toContain('"type":"result"');
});


it("uses persisted trip answers before deciding to ask clarification questions", async () => {
  const f = fixture({ ...intent, partySize: null, budgetRupees: null, budgetBasis: null, dayCount: null });
  const context = { tripId: "existing", revision: 4, title: "Saved trip", intake: { partySize: 5, budgetPaise: 700000, budgetBasis: "per_person", dayCount: 6 }, days: [], existingPlan: { days: Array.from({ length: 6 }, (_, i) => ({ number: i + 1, date: "2027-04-12", dateLabel: "", city: "Haridwar", color: "blue" })), stops: [], startDate: "2027-04-12", currency: "INR" } };
  const service = new PlanningService(f.model, f.geo, "osm", async () => context, f.limiter);
  const result = await service.preview("owner", { prompt: "Suggest places in Haridwar", tripId: "existing" });
  expect(result.status).toBe("preview");
  expect(f.model.propose).toHaveBeenCalledWith(expect.objectContaining({ partySize: 5, dayCount: 6, budgetRupees: "7000.00", budgetBasis: "per_person" }), context);
  expect(result).toMatchObject({ approvable: false, issues: expect.arrayContaining(["costs_incomplete"]) });
});
