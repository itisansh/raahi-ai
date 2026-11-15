import type { HistoryStore } from "../../services/history/history-service";
import type { MongoDatabase } from "../../config/db";
import { Trip, type StopSnapshot, type TripIntake } from "../../domain/trip";
import { DomainError, NotFoundError } from "../../domain/shared/errors";
import { ForbiddenError } from "../../services/use-cases";
import { createTripChange, type TripChangePublisher } from "../../domain/realtime";
import { MongoTripRepository } from "./trip";
type HistoryPayload = { kind?: string; appliedRevision?: number; beforeStops?: StopSnapshot[]; afterStops?: StopSnapshot[]; beforeForecast?: TripIntake["budgetForecast"] | null; rolledBackAt?: string };
export class MongoHistoryStore implements HistoryStore {
  constructor(private db: MongoDatabase, private publisher?: TripChangePublisher) {}
  async list(tripId: string, actor: string) {
    const trip = await new MongoTripRepository(this.db).findById(tripId);
    if (!trip || !trip.permissionsFor(actor).isMember) throw new NotFoundError("trip_not_found", "Trip not found");
    const rows = await this.db.models.proposals.find({ contextTripId: tripId, resultTripId: tripId }).sort({ approvedAt: -1 }).limit(50).lean();
    return rows.map(row => { const p = row.payload as HistoryPayload; return {
      id: row.id, kind: p.kind === "budget_replan" ? "budget_replan" : "planning_additions", approvedAt: row.approvedAt!.toISOString(), appliedRevision: p.appliedRevision ?? null, rolledBackAt: p.rolledBackAt ?? null,
      canRollback: trip.permissionsFor(actor).canEdit && !!p.beforeStops && !p.rolledBackAt && p.appliedRevision === trip.toSnapshot().version,
      beforeStops: (p.beforeStops ?? []).map(({ name, day }) => ({ name, day })), afterStops: (p.afterStops ?? []).map(({ name, day }) => ({ name, day })),
    }; });
  }
  async rollback(tripId: string, actor: string, proposalId: string, revision: number) {
    const result = await this.db.transaction(async session => {
      const repo = new MongoTripRepository(this.db, session);
      const trip = await repo.findById(tripId);
      if (!trip || !trip.permissionsFor(actor).isMember) throw new NotFoundError("trip_not_found", "Trip not found");
      if (!trip.permissionsFor(actor).canEdit) throw new ForbiddenError("forbidden", "Trip edit permission required");
      const row = await this.db.models.proposals.findOne({ id: proposalId, contextTripId: tripId, resultTripId: tripId }).session(session).lean();
      if (!row) throw new NotFoundError("proposal_not_found", "Applied proposal not found");
      const p = row.payload as HistoryPayload;
      if (p.rolledBackAt) return null;
      const current = trip.toSnapshot();
      if (!p.beforeStops || p.appliedRevision !== current.version || revision !== current.version) throw new DomainError("trip_write_conflict", "Trip changed or this historical proposal has no rollback snapshot");
      // A later booking changes the revision; also reject linked additions explicitly.
      const removed = current.stops.filter(stop => !p.beforeStops!.some(old => old.id === stop.id)).map(s => s.id);
      if (await this.db.models.reservations.exists({ tripId, stopId: { $in: removed } }).session(session)) throw new DomainError("rollback_linked_booking", "A booking uses an added stop");
      const restored = Trip.fromSnapshot({ ...current, stops: p.beforeStops });
      await repo.save(restored, revision);
      if (p.kind === "budget_replan") {
        const intake = { ...current.intake };
        if (p.beforeForecast) intake.budgetForecast = p.beforeForecast; else delete intake.budgetForecast;
        await this.db.models.trips.updateOne({ id: tripId }, { $set: { intake } }, { session, runValidators: true });
      }
      await this.db.models.proposals.updateOne({ id: proposalId }, { $set: { payload: { ...p, rolledBackAt: new Date().toISOString(), rolledBackBy: actor, rollbackRevision: revision + 1 } } }, { session, runValidators: true });
      return revision + 1;
    });
    if (result !== null && this.publisher) {
      try { await this.publisher.publish(createTripChange({ eventId: crypto.randomUUID(), tripId, actorId: actor, revision: result, occurredAt: new Date().toISOString(), scopes: ["trip", "stops"] })); }
      catch { console.warn("Rollback saved but realtime notification failed"); }
    }
  }
}
