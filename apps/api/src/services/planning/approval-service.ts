import { DomainError } from "../../domain/shared/errors";
import { Trip, type TripOwner } from "../../domain/trip";
import type { PlanningService } from "./planning-service";
import type { ProposalStore } from "./proposal-store";
import { rupeesToPaise } from "./contracts";

type Preview = Extract<Awaited<ReturnType<PlanningService["preview"]>>, { status: "preview" }>;

export class ProposalApprovalService {
  constructor(private store: ProposalStore) {}

  async approve(proposalId: string, actor: TripOwner) {
    const tripId = await this.store.approve(proposalId, actor.id, (stored) => {
      if (stored.contextTripId) throw new DomainError("proposal_existing_trip", "Existing-trip proposals cannot be applied yet");
      const preview = stored.payload as Preview;
      if (preview.issues.some((issue) => issue !== "dates_unknown")) {
        throw new DomainError("proposal_needs_revision", "Resolve itinerary evidence, schedule and budget warnings before saving");
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
