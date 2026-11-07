import type { GeoService } from "../geo/geo-service";
import type { GeoPlaceDto } from "../geo/geo-data";
import type { ProposalStore } from "./proposal-store";
import {
  candidateSchema, planningRequestSchema, PlanningError, requiredIntentFields,
  rupeesToPaise, tripIntentSchema, type PlanningContext, type PlanningModel,
} from "./contracts";

type PlaceEvidence = {
  status: "matched" | "unavailable" | "ambiguous";
  source: string;
  checkedAt: string;
  place: Pick<GeoPlaceDto, "id" | "name" | "label" | "lat" | "lng"> | null;
};
const normalize = (s: string) => s.normalize("NFKC").toLocaleLowerCase("en").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Read-only orchestration: this service has no trip write or booking port. */
export class PlanningService {
  constructor(
    private model: PlanningModel | null,
    private geo: Pick<GeoService, "placeSearch" | "routeCompute">,
    private source: string,
    private context: (tripId: string, userId: string) => Promise<PlanningContext>,
    private limiter: { consume(userId: string): Promise<boolean> },
    private proposals?: ProposalStore,
  ) {}

  async preview(userId: string, raw: unknown) {
    const request = planningRequestSchema.parse(raw);
    // Check membership before any model/provider request or private context use.
    const context = request.tripId ? await this.context(request.tripId, userId) : null;
    if (!this.model) throw new PlanningError("planning_unavailable");
    try {
      if (!await this.limiter.consume(userId)) throw new PlanningError("planning_rate_limited");
    } catch (error) {
      if (error instanceof PlanningError) throw error;
      throw new PlanningError("planning_unavailable");
    }
    const extracted = tripIntentSchema.safeParse(await this.model.extract(request.prompt, context));
    if (!extracted.success) throw new PlanningError("planning_invalid_output");
    const intent = extracted.data;
    const missing = requiredIntentFields.filter((key) => intent[key] == null || (key === "currency" && intent.currency !== "INR"));
    if (missing.length) return { status: "clarification" as const, intent, missing };
    const budget = rupeesToPaise(intent.budgetRupees!);
    if (budget === 0) return { status: "clarification" as const, intent, missing: ["budgetRupees" as const] };
    const parsed = candidateSchema.safeParse(await this.model.propose(intent, context));
    if (!parsed.success) throw new PlanningError("planning_invalid_output");
    const candidate = parsed.data;
    if (candidate.days.length !== intent.dayCount || candidate.days.some((day, i) => day.day !== i + 1)) {
      throw new PlanningError("planning_invalid_output");
    }
    const issues = new Set<string>();
    if (!intent.startDate) issues.add("dates_unknown");
    const estimates = Object.entries(candidate.costs).map(([category, range]) => {
      if (!range) { issues.add("costs_incomplete"); return { category, minPaise: null, maxPaise: null }; }
      const minPaise = rupeesToPaise(range.minRupees);
      const maxPaise = rupeesToPaise(range.maxRupees);
      if (maxPaise < minPaise) throw new PlanningError("planning_invalid_output");
      return { category, minPaise, maxPaise };
    });
    const knownMin = estimates.reduce((sum, row) => sum + (row.minPaise ?? 0), 0);
    const knownMax = estimates.reduce((sum, row) => sum + (row.maxPaise ?? 0), 0);
    const groupBudgetPaise = intent.budgetBasis === "group" ? budget : budget * intent.partySize!;
    const overBudget = knownMax * intent.partySize! > groupBudgetPaise;
    if (overBudget) issues.add("over_budget");
    const cache = new Map<string, PlaceEvidence>();
    const evidenceDeadline = Date.now() + 60_000;
    const resolve = async (name: string, city?: string): Promise<PlaceEvidence> => {
      const key = `${name}|${city ?? ""}`;
      const cached = cache.get(key);
      if (cached) return cached;
      const evidence: PlaceEvidence = { status: "unavailable", source: this.source, checkedAt: new Date().toISOString(), place: null };
      // Bound provider work, including origin, for a single preview.
      if (cache.size >= 20 || Date.now() > evidenceDeadline) return evidence;
      try {
        const results = await this.geo.placeSearch({ query: `${name}${city ? `, ${city}` : ""}, India`, limit: 5 });
        const matches = results.filter((place) =>
          normalize(place.name) === normalize(name) &&
          place.address?.countryCode?.toLowerCase() === "in" &&
          (!city || normalize(place.label).includes(normalize(city))) &&
          Number.isFinite(place.lat) && Number.isFinite(place.lng) &&
          Math.abs(place.lat) <= 90 && Math.abs(place.lng) <= 180,
        );
        evidence.status = matches.length === 1 ? "matched" : results.length ? "ambiguous" : "unavailable";
        if (matches.length === 1) {
          const { id, name, label, lat, lng } = matches[0]!;
          evidence.place = { id, name, label, lat, lng };
        }
      } catch { /* An unavailable provider never becomes model-supplied coordinates. */ }
      cache.set(key, evidence);
      return evidence;
    };
    const origin = await resolve(intent.origin!);
    if (!origin.place) issues.add("places_unverified");
    let previous = origin;
    const days = [];
    let routeCalls = 0;
    let endOfPreviousDay = 0;
    const travelTime = async (from: PlaceEvidence, to: PlaceEvidence) => {
      if (!from.place || !to.place || routeCalls >= 43 || Date.now() > evidenceDeadline) return null;
      if (from.place.id === to.place.id) return 0;
      routeCalls++;
      try {
        const route = await this.geo.routeCompute({ waypoints: [from.place, to.place], mode: "driving", includeGeometry: false });
        if (route && Number.isFinite(route.durationSeconds) && route.durationSeconds >= 0) return Math.ceil(route.durationSeconds / 60);
      } catch { /* Road estimates are optional evidence, never bus/train schedules. */ }
      return null;
    };
    for (const day of candidate.days) {
      const stops = [];
      // Allow eight hours of rest between days; do not assume overnight driving.
      let previousEnd = day.day === 1 ? 0 : Math.max(0, endOfPreviousDay + 480 - 1440);
      for (const stop of day.stops) {
        const evidence = await resolve(stop.name, day.city);
        if (!evidence.place) issues.add("places_unverified");
        const travelMinutes = await travelTime(previous, evidence);
        if (travelMinutes == null) issues.add("routes_unverified");
        if (stop.startMinute < previousEnd + (travelMinutes ?? 0) || stop.startMinute + stop.durationMinutes > 1440) issues.add("schedule_infeasible");
        stops.push({ ...stop, evidence, travel: { status: travelMinutes == null ? "unavailable" : "road_estimate", minutes: travelMinutes, source: this.source } });
        previousEnd = stop.startMinute + stop.durationMinutes;
        previous = evidence;
      }
      endOfPreviousDay = previousEnd;
      days.push({ ...day, stops });
    }
    const returnMinutes = await travelTime(previous, origin);
    if (returnMinutes == null) issues.add("return_travel_unverified");
    else if (endOfPreviousDay + returnMinutes > 1440) issues.add("schedule_infeasible");
    const preview = {
      status: "preview" as const, proposalId: crypto.randomUUID(), saved: false as const,
      approvable: !!this.proposals && !request.tripId && [...issues].every((issue) => issue === "dates_unknown"),
      contextRevision: context?.revision ?? null, intent, title: candidate.title, days,
      returnTravel: { status: returnMinutes == null ? "unavailable" : "road_estimate", minutes: returnMinutes, source: this.source },
      origin, budget: {
        currency: "INR", groupBudgetPaise, estimates,
        knownMinPerPersonPaise: knownMin, knownMaxPerPersonPaise: knownMax,
        knownMaxGroupPaise: knownMax * intent.partySize!,
        status: overBudget ? "over_budget" : issues.has("costs_incomplete") ? "incomplete" : "within_estimate",
        source: "ai_estimate", availability: "unverified",
      },
      issues: [...issues],
    };
    if (this.proposals) await this.proposals.save({ id: preview.proposalId, ownerId: userId, payload: preview, contextTripId: request.tripId ?? null, baseRevision: preview.contextRevision, expiresAt: new Date(Date.now() + 30 * 60_000) });
    return preview;
  }
}
