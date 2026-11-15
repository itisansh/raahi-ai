import type { FinanceStore } from "../../services/finance/finance-service";
import type { TripSnapshot } from "../../domain/trip";
import type { MongoDatabase } from "../../config/db";
import { ForbiddenError } from "../../services/use-cases";
import { NotFoundError } from "../../domain/shared/errors";
import { createTripChange, type TripChangePublisher } from "../../domain/realtime";
import { MongoTripRepository } from "./trip";
export class MongoFinanceStore implements FinanceStore {
  constructor(private db: MongoDatabase, private publisher?: TripChangePublisher) {}
  async read(id: string, actor: string) {
    const trip = await new MongoTripRepository(this.db).findById(id);
    if (!trip || !trip.permissionsFor(actor).isMember) throw new NotFoundError("trip_not_found", "Trip not found");
    return trip.toSnapshot();
  }
  async mutate(id: string, actor: string, mutate: (trip: TripSnapshot) => boolean) {
    const revision = await this.db.transaction(async session => {
      const repo = new MongoTripRepository(this.db, session);
      const trip = await repo.findById(id);
      if (!trip || !trip.permissionsFor(actor).isMember) throw new NotFoundError("trip_not_found", "Trip not found");
      if (!trip.permissionsFor(actor).canEdit) throw new ForbiddenError("forbidden", "Trip edit permission required");
      const snapshot = trip.toSnapshot();
      if (!mutate(snapshot)) return null;
      const version = await repo.bump(id, session, snapshot.version);
      await this.db.models.trips.updateOne({ id }, { $set: { finance: snapshot.finance } }, { session, runValidators: true });
      return version;
    });
    if (revision !== null && this.publisher) {
      try { await this.publisher.publish(createTripChange({ eventId: crypto.randomUUID(), tripId: id, actorId: actor, revision, occurredAt: new Date().toISOString(), scopes: ["trip", "expenses"] })); }
      catch { console.warn("Finance saved but realtime notification failed"); }
    }
  }
}
