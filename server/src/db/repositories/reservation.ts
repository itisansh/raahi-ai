import type { ClientSession } from "mongoose";
import { Reservation, type ReservationRepository, type ReservationSnapshot } from "../../services/rules/reservation";
import { DomainError } from "../../services/rules/shared/errors";
import type { MongoDatabase } from "../connection";
import { MongoTripRepository } from "./trip";

export class MongoReservationRepository implements ReservationRepository {
  constructor(private db: MongoDatabase, private session?: ClientSession) {}
  async listByTrip(tripId: string) {
    const rows = await this.db.models.reservations.find({ tripId }, { _id: 0, idempotencyKey: 0 }).sort({ startAt: 1, createdAt: 1, id: 1 }).session(this.session ?? null).lean();
    return rows.map(row => Reservation.fromSnapshot(row));
  }
  async findById(tripId: string, id: string) {
    const row = await this.db.models.reservations.findOne({ tripId, id }, { _id: 0, idempotencyKey: 0 }).session(this.session ?? null).lean();
    return row ? Reservation.fromSnapshot(row) : null;
  }
  private async validateLinks(s: ReservationSnapshot, session: ClientSession) {
    const m = this.db.models;
    if (s.stopId && !await m.stops.exists({ tripId: s.tripId, id: s.stopId }).session(session)) throw new DomainError("invalid_stop", "Reservation stop does not exist in this trip");
    if (s.expenseId && !await m.expenses.exists({ tripId: s.tripId, id: s.expenseId }).session(session)) throw new DomainError("invalid_expense", "Reservation expense does not exist in this trip");
    if (s.dayNumber != null && !await m.days.exists({ tripId: s.tripId, number: s.dayNumber }).session(session)) throw new DomainError("invalid_day", "Reservation day does not exist in this trip");
  }
  async create(reservation: Reservation, idempotencyKey: string) {
    return this.db.transaction(async session => {
      const s = reservation.toSnapshot();
      // Serialize before the idempotency lookup, so concurrent retries see the winner.
      const tripRevision = await new MongoTripRepository(this.db).bump(s.tripId, session);
      const existing = await this.db.models.reservations.findOne({ tripId: s.tripId, createdBy: s.createdBy, idempotencyKey }, { _id: 0, idempotencyKey: 0 }).session(session).lean();
      if (existing) {
        await this.db.models.trips.updateOne({ id: s.tripId }, { $inc: { version: -1 } }, { session, runValidators: true });
        return { reservation: Reservation.fromSnapshot(existing), tripRevision: tripRevision - 1 };
      }
      await this.validateLinks(s, session);
      await this.db.models.reservations.create([{ ...s, idempotencyKey }], { session });
      return { reservation, tripRevision };
    });
  }
  async save(reservation: Reservation, previousRevision: number) {
    return this.db.transaction(async session => {
      const s = reservation.toSnapshot();
      const trip = await this.db.models.trips.findOne({ id: s.tripId }).session(session).lean();
      if (!trip) throw new DomainError("trip_not_found", "Trip not found");
      const current = await this.db.models.reservations.findOne({ tripId: s.tripId, id: s.id, revision: previousRevision }).session(session).lean();
      if (!current) return null;
      const tripRevision = await new MongoTripRepository(this.db).bump(s.tripId, session, trip.version);
      await this.validateLinks(s, session);
      await this.db.models.reservations.updateOne({ id: s.id, tripId: s.tripId, revision: previousRevision }, { $set: s }, { session, runValidators: true });
      return { reservation, tripRevision };
    });
  }
  async delete(tripId: string, id: string, expectedRevision: number) {
    return this.db.transaction(async session => {
      const trip = await this.db.models.trips.findOne({ id: tripId }).session(session).lean();
      if (!trip) throw new DomainError("trip_not_found", "Trip not found");
      const result = await this.db.models.reservations.deleteOne({ tripId, id, revision: expectedRevision }, { session });
      return { deleted: result.deletedCount > 0, tripRevision: result.deletedCount ? await new MongoTripRepository(this.db).bump(tripId, session, trip.version) : trip.version };
    });
  }
}
