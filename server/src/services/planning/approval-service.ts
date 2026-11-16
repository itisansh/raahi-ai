import { ForbiddenError } from "../use-cases";
import { DomainError } from "../rules/shared/errors";
import { Trip, type TripOwner } from "../rules/trip";
import type { PlanningService } from "./planning-service";
import type { ProposalStore } from "./proposal-store";
import { rupeesToPaise } from "./contracts";

type Preview = Extract<Awaited<ReturnType<PlanningService["preview"]>>, { status: "preview" }>;

export class ProposalApprovalService {
  constructor(private store: ProposalStore) {}

  async approve(proposalId: string, actor: TripOwner) {
    const tripId = await this.store.approve(proposalId, actor.id, (stored, existing) => {

      const preview = stored.payload as Preview;
      if (preview.status !== "preview") throw new DomainError("proposal_needs_revision", "Answer the planning questions before saving an itinerary");
      if (preview.issues.some((issue) => issue !== "dates_unknown")) {
        throw new DomainError("proposal_needs_revision", "Resolve itinerary evidence, schedule and budget warnings before saving");
      }
      if (stored.contextTripId) {
        if (!existing || existing.toSnapshot().id !== stored.contextTripId) throw new DomainError("proposal_existing_trip", "Existing trip approval is unavailable");
        if (!existing.permissionsFor(actor.id).canEdit) throw new ForbiddenError("forbidden", "Trip edit permission required");
        const snapshot = existing.toSnapshot();
        if (snapshot.version !== stored.baseRevision) throw new DomainError("trip_write_conflict", "Trip changed; generate a new proposal");
        const member = snapshot.members.find(member => member.userId === actor.id);
        if (!member) throw new ForbiddenError("forbidden", "Trip membership required");
        for (const day of preview.days) {
          if (!snapshot.days.some(saved => saved.number === day.day)) throw new DomainError("proposal_needs_revision", "Proposed day is not in this trip");
          for (const stop of day.stops) {
            const place = stop.evidence.place;
            if (!place) throw new DomainError("proposal_needs_revision", "Verified place coordinates are required");
            const dayStops = existing.toSnapshot().stops.filter(saved => saved.day === day.day);
            const time = `${String(Math.floor(stop.startMinute / 60)).padStart(2, "0")}:${String(stop.startMinute % 60).padStart(2, "0")}`;
            const nextIndex = dayStops.findIndex(saved => saved.time > time);
            existing.insertStop({ day: day.day, index: nextIndex < 0 ? dayStops.length : nextIndex, name: stop.name, area: day.city, category: "Sight", time, duration: `${stop.durationMinutes} min`, lat: place.lat, lng: place.lng, note: `Place source: ${stop.evidence.source}; checked: ${stop.evidence.checkedAt}. Costs and transport remain estimates.` }, member.id);
          }
        }
        return existing;
      }
      const intent = preview.intent;
      const trip = Trip.create({ title: preview.title, currency: "INR", dayCount: intent.dayCount!, startDate: intent.startDate ?? undefined, partySize: intent.partySize! }, actor);
      // Unknown dates stay unknown; the legacy manual wizard defaults to today.
      const snapshot = trip.toSnapshot();
      snapshot.agentSeedPending = false;
      snapshot.intake = { ...snapshot.intake, origin: intent.origin!, budgetBasis: intent.budgetBasis!, budgetPaise: rupeesToPaise(intent.budgetRupees!), partySize: intent.partySize!, dayCount: intent.dayCount! };
      if (!intent.startDate) { snapshot.startDate = ""; snapshot.endDate = ""; snapshot.days.forEach((day) => { day.date = ""; }); }
      const result = Trip.fromSnapshot(snapshot);
      const memberId = snapshot.members[0]!.id;
      for (const day of preview.days) {
        result.updateDay(day.day, { city: day.city });
        for (const [index, stop] of day.stops.entries()) {
          const place = stop.evidence.place;
          if (!place) throw new DomainError("proposal_needs_revision", "Verified place coordinates are required");
          result.insertStop({ day: day.day, index, name: stop.name, area: day.city, category: "Sight", time: `${String(Math.floor(stop.startMinute / 60)).padStart(2, "0")}:${String(stop.startMinute % 60).padStart(2, "0")}`, duration: `${stop.durationMinutes} min`, lat: place.lat, lng: place.lng, note: `Place source: ${stop.evidence.source}; checked: ${stop.evidence.checkedAt}. Costs and transport remain estimates.` }, memberId);
        }
      }
      return result;
    });
    return { tripId };
  }
}
