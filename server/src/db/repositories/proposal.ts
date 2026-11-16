import { ForbiddenError } from "../../services/use-cases";
import type { ProposalStore, StoredProposal } from "../../services/planning/proposal-store";
import { createTripChange, type TripChangePublisher } from "../../services/rules/realtime";
import type { Trip } from "../../services/rules/trip";
import { DomainError, NotFoundError } from "../../services/rules/shared/errors";
import type { MongoDatabase } from "../connection";
import { MongoTripRepository } from "./trip";
export class MongoProposalStore implements ProposalStore {
  readonly supportsExisting = true;
  constructor(private db: MongoDatabase, private publisher?: TripChangePublisher) {}
  async read(id: string, ownerId: string): Promise<StoredProposal | null> {
    const row = await this.db.models.proposals.findOne({ id, ownerId }).lean();
    return row ? { id: row.id, ownerId: row.ownerId, payload: row.payload, contextTripId: row.contextTripId, baseRevision: row.baseRevision, expiresAt: row.expiresAt } : null;
  }
  async save(proposal: StoredProposal) { await this.db.models.proposals.create(proposal); }
  async approve(id: string, ownerId: string, build: (proposal: StoredProposal, existing?: Trip) => Trip) {
    const result = await this.db.transaction(async session => {
      const row = await this.db.models.proposals.findOne({ id, ownerId }).session(session).lean();
      if (!row) throw new NotFoundError("proposal_not_found", "Proposal not found");
      const repository = new MongoTripRepository(this.db, session);
      const existing = row.contextTripId ? await repository.findById(row.contextTripId) : null;
      if (row.contextTripId && (!existing || !existing.permissionsFor(ownerId).canEdit)) throw new ForbiddenError("forbidden", "Trip edit permission required");
      if ((row.payload as { rolledBackAt?: string } | null)?.rolledBackAt) throw new DomainError("proposal_rolled_back", "Generate a fresh proposal after rollback");
      if (row.resultTripId) return { tripId: row.resultTripId, revision: null };
      if (row.expiresAt.getTime() <= Date.now()) throw new DomainError("proposal_expired", "Generate a fresh proposal before saving");
      await this.db.models.proposals.updateOne({ id, ownerId }, { $set: { approvedAt: new Date() } }, { session, runValidators: true });
      const beforeStops = existing ? structuredClone(existing.toSnapshot().stops) : null;
      const trip = build(row, existing ?? undefined);
      let revision: number | null = null;
      if (existing) {
        if (row.baseRevision == null || trip.toSnapshot().id !== row.contextTripId) throw new DomainError("trip_write_conflict", "Invalid proposal revision");
        await repository.save(trip, row.baseRevision);
        revision = row.baseRevision + 1;
      } else await repository.create(trip);
      const tripId = trip.toSnapshot().id;
      await this.db.models.proposals.updateOne({ id, ownerId }, { $set: { resultTripId: tripId, approvedAt: new Date(), ...(existing ? { payload: { ...row.payload as object, beforeStops, afterStops: trip.toSnapshot().stops, appliedRevision: revision } } : {}) } }, { session, runValidators: true });
      return { tripId, revision };
    });
    if (result.revision !== null && this.publisher) {
      try { await this.publisher.publish(createTripChange({ eventId: crypto.randomUUID(), tripId: result.tripId, actorId: ownerId, revision: result.revision, occurredAt: new Date().toISOString(), scopes: ["trip", "stops"] })); }
      catch { console.warn("Planning changes saved but realtime notification failed"); }
    }
    return result.tripId;
  }
}
