import type { ProposalStore, StoredProposal } from "../../services/planning/proposal-store";
import type { Trip } from "../../domain/trip";
import { DomainError, NotFoundError } from "../../domain/shared/errors";
import type { MongoDatabase } from "../../config/db";
import { MongoTripRepository } from "./trip";
export class MongoProposalStore implements ProposalStore {
  constructor(private db: MongoDatabase) {}
  async read(id: string, ownerId: string): Promise<StoredProposal | null> {
    const row = await this.db.models.proposals.findOne({ id, ownerId }).lean();
    return row ? { id: row.id, ownerId: row.ownerId, payload: row.payload, contextTripId: row.contextTripId, baseRevision: row.baseRevision, expiresAt: row.expiresAt } : null;
  }
  async save(proposal: StoredProposal) { await this.db.models.proposals.create(proposal); }
  async approve(id: string, ownerId: string, build: (proposal: StoredProposal) => Trip) {
    return this.db.transaction(async session => {
      const row = await this.db.models.proposals.findOne({ id, ownerId }).session(session).lean();
      if (!row) throw new NotFoundError("proposal_not_found", "Proposal not found");
      if (row.resultTripId) return row.resultTripId;
      if (row.expiresAt.getTime() <= Date.now()) throw new DomainError("proposal_expired", "Generate a fresh proposal before saving");
      // Claim the proposal before building; a retry then returns the committed result.
      await this.db.models.proposals.updateOne({ id, ownerId }, { $set: { approvedAt: new Date() } }, { session, runValidators: true });
      const trip = build(row);
      await new MongoTripRepository(this.db, session).create(trip);
      const tripId = trip.toSnapshot().id;
      await this.db.models.proposals.updateOne({ id, ownerId }, { $set: { resultTripId: tripId } }, { session, runValidators: true });
      return tripId;
    });
  }
}
