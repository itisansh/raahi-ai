import { withTripContext } from "./context-intent";
import type { PlanningProgress } from "./contracts";
import { durationMinutes, scheduleMinute } from "./existing-plan";
import { clarificationReply, previewReply } from "./reply";
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

  async preview(userId: string, raw: unknown, progress?: PlanningProgress) {
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
    const extracted = tripIntentSchema.safeParse(await (progress ? this.model.extract(request.prompt, context, progress) : this.model.extract(request.prompt, context)));
    if (!extracted.success) throw new PlanningError("planning_invalid_output");
    progress?.signal.throwIfAborted();
    const intent = withTripContext(extracted.data, context);
    const missing = requiredIntentFields.filter((key) => intent[key] == null || (key === "currency" && intent.currency !== "INR"));
    if (!missing.length && rupeesToPaise(intent.budgetRupees!) === 0) missing.push("budgetRupees");
    if (missing.length) {
      const clarification = { status: "clarification" as const, proposalId: crypto.randomUUID(), intent, missing, reply: clarificationReply(intent, missing, Boolean(context?.existingPlan)) };
      if (this.proposals) await this.proposals.save({ id: clarification.proposalId, ownerId: userId, payload: clarification, contextTripId: request.tripId ?? null, baseRevision: context?.revision ?? null, expiresAt: new Date(Date.now() + 30 * 60_000) });
      return clarification;
    }
    const budget = rupeesToPaise(intent.budgetRupees!);
    const parsed = candidateSchema.safeParse(await (progress ? this.model.propose(intent, context, progress) : this.model.propose(intent, context)));
    if (!parsed.success) throw new PlanningError("planning_invalid_output");
    progress?.signal.throwIfAborted();
    const candidate = parsed.data;
    if (candidate.days.length !== intent.dayCount || candidate.days.some((day, i) => day.day !== i + 1 || (!context && day.stops.length === 0)) || !candidate.days.some(day => day.stops.length > 0)) {
      throw new PlanningError("planning_invalid_output");
    }
    const issues = new Set<string>();
    // A saved total is a ceiling, not money entirely available for new stops.
    // Existing commitments are not priced by this proposal pipeline.
    const savedBudget = context?.existingPlan
      ? withTripContext({ ...intent, budgetRupees: null }, context).budgetRupees : null;
    if (savedBudget != null && rupeesToPaise(savedBudget) === budget) {
      issues.add("costs_incomplete");
    }
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
    let returnMinutes = await travelTime(previous, origin);
    if (returnMinutes == null) issues.add("return_travel_unverified");
    else if (endOfPreviousDay + returnMinutes > 1440) issues.add("schedule_infeasible");
    const existing = context?.existingPlan;
    if (existing) {
      let combinedPrevious = origin;
      let combinedEnd = 0;
      if (existing.currency !== "INR" || intent.startDate !== (existing.startDate || null) || intent.dayCount !== existing.days.length) issues.add("existing_trip_constraints");
      for (const day of days) {
        if (!existing.days.some(item => item.number === day.day)) { issues.add("existing_trip_constraints"); continue; }
        const retained = existing.stops.filter(stop => stop.day === day.day);
        const combined = [
          ...retained.map(stop => ({ start: scheduleMinute(stop.time), duration: durationMinutes(stop.duration), evidence: {
            status: "matched" as const, source: "saved_trip", checkedAt: new Date().toISOString(),
            place: { id: stop.id, name: stop.name, label: stop.name, lat: stop.lat, lng: stop.lng },
          } })),
          ...day.stops.map(stop => ({ start: stop.startMinute, duration: stop.durationMinutes, evidence: stop.evidence })),
        ];
        if (combined.some(stop => stop.start == null || stop.duration == null)) { issues.add("existing_schedule_unverified"); continue; }
        combined.sort((a, b) => a.start! - b.start!);
        let previousEnd = day.day === 1 ? 0 : Math.max(0, combinedEnd + 480 - 1440);
        for (const stop of combined) {
          const minutes = await travelTime(combinedPrevious, stop.evidence);
          const addition = day.stops.find(item => item.evidence === stop.evidence);
          if (addition) addition.travel = { status: minutes == null ? "unavailable" : "road_estimate", minutes, source: this.source };
          if (minutes == null) issues.add("routes_unverified");
          if (stop.start! < previousEnd + (minutes ?? 0) || stop.start! + stop.duration! > 1440) issues.add("schedule_infeasible");
          previousEnd = stop.start! + stop.duration!;
          combinedPrevious = stop.evidence;
        }
        combinedEnd = previousEnd;
        if (day.stops.some(stop => retained.some(old => normalize(old.name) === normalize(stop.name)))) issues.add("existing_stop_duplicate");
      }
      const combinedReturn = await travelTime(combinedPrevious, origin);
      returnMinutes = combinedReturn;
      if (combinedReturn == null) issues.add("return_travel_unverified");
      else if (combinedEnd + combinedReturn > 1440) issues.add("schedule_infeasible");
    }
    const preview = {
      status: "preview" as const, proposalId: crypto.randomUUID(), saved: false as const,
      approvable: !!this.proposals && (!request.tripId || (!!this.proposals.supportsExisting && !!context?.canEdit && !!existing)) && [...issues].every((issue) => issue === "dates_unknown"),
      changeMode: request.tripId ? "append_stops" as const : "create_trip" as const,
      costScope: request.tripId ? "additions" as const : "whole_trip" as const,
      retainedStops: existing?.stops.map(({ id, day, name, time, duration }) => ({ id, day, name, time, duration })) ?? [],
      contextRevision: context?.revision ?? null, intent, title: candidate.title, days,
      guidance: candidate.guidance ?? null,
      reply: previewReply(intent, candidate, [...issues]),
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
    progress?.signal.throwIfAborted();
    if (this.proposals) await this.proposals.save({ id: preview.proposalId, ownerId: userId, payload: preview, contextTripId: request.tripId ?? null, baseRevision: preview.contextRevision, expiresAt: new Date(Date.now() + 30 * 60_000) });
    return preview;
  }
}
