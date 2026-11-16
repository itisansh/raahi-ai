import type { TripInviteRepository, TripInviteSnapshot } from "../../services/rules/invite";
import { DomainError } from "../../services/rules/shared/errors";
import type { MongoDatabase } from "../connection";
export class MongoTripInviteRepository implements TripInviteRepository {
  constructor(private db: MongoDatabase) {}
  async create(invite: TripInviteSnapshot) {
    await this.db.transaction(async session => {
      if (!await this.db.models.trips.exists({ id: invite.tripId }).session(session)) throw new DomainError("trip_not_found", "Trip not found");
      await this.db.models.invites.create([invite], { session });
    });
  }
  async findByTokenHash(tokenHash: string): Promise<TripInviteSnapshot | null> { return this.db.models.invites.findOne({ tokenHash }, { _id: 0 }).lean(); }
  async revoke(inviteId: string) { await this.db.models.invites.updateOne({ id: inviteId }, { $set: { status: "revoked" } }, { runValidators: true }); }
  async recordAcceptance(inviteId: string, userId: string) {
    try { await this.db.transaction(async session => {
      if (!await this.db.models.invites.exists({ id: inviteId }).session(session)) throw new DomainError("invite_not_found", "Invite not found");
      await this.db.models.acceptances.updateOne({ inviteId, userId }, { $setOnInsert: { acceptedAt: new Date() } }, { session, upsert: true, runValidators: true });
    }); } catch (error) {
      // Concurrent upserts may race at the unique index; only a committed matching
      // acceptance makes that particular duplicate an idempotent success.
      if (!(error instanceof Error && "code" in error && error.code === 11000) ||
          !await this.db.models.acceptances.exists({ inviteId, userId })) throw error;
    }
  }
}
