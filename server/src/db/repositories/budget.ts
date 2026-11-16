import type { ClientSession } from "mongoose";
import { createTripChange, type TripChangePublisher } from "../../services/rules/realtime";
import { DomainError, NotFoundError } from "../../services/rules/shared/errors";
import type { BudgetContext, BudgetForecast, BudgetStore } from "../../services/budget/budget-service";
import type { MongoDatabase } from "../connection";
import { MongoTripRepository } from "./trip";
import { MongoReservationRepository } from "./reservation";
import { MongoProposalStore } from "./proposal";
export class MongoBudgetStore implements BudgetStore {
  constructor(private db: MongoDatabase, private publisher?: TripChangePublisher) {}
  private async notify(id: string, actor: string, revision: number) {
    if (!this.publisher) return;
    try { await this.publisher.publish(createTripChange({ eventId: crypto.randomUUID(), tripId: id, actorId: actor, revision, occurredAt: new Date().toISOString(), scopes: ["trip", "stops"] })); }
    catch { console.warn("Budget update committed but realtime notification failed"); }
  }
  private async context(id: string, actor: string, editable: boolean, session: ClientSession): Promise<BudgetContext> {
    const trip = await new MongoTripRepository(this.db, session).findById(id);
    if (!trip || !trip.permissionsFor(actor).isMember) throw new NotFoundError("trip_not_found", "Trip not found");
    if (editable && !trip.permissionsFor(actor).canEdit) throw new DomainError("budget_forbidden", "Trip edit permission required");
    return { trip: trip.toSnapshot(), reservations: (await new MongoReservationRepository(this.db, session).listByTrip(id)).map(r => r.toSnapshot()) };
  }
  async read(id: string, actor: string, editable = false) { return this.db.transaction(session => this.context(id, actor, editable, session)); }
  async forecast(id: string, actor: string, forecast: BudgetForecast) {
    const revision = await this.db.transaction(async session => {
      const context = await this.context(id, actor, true, session);
      if (Object.keys(forecast.costs).some(key => !context.trip.stops.some(s => s.id === key))) throw new DomainError("budget_invalid_forecast", "Forecast names an unknown stop");
      const revision = await new MongoTripRepository(this.db).bump(id, session, context.trip.version);
      await this.db.models.trips.updateOne({ id }, { $set: { intake: { ...context.trip.intake, budgetForecast: forecast } } }, { session, runValidators: true });
      return revision;
    });
    await this.notify(id, actor, revision);
  }
  async saveProposal(tripId: string, actor: string, revision: number, payload: unknown) {
    await this.read(tripId, actor, true);
    const id = crypto.randomUUID();
    await new MongoProposalStore(this.db).save({ id, ownerId: actor, contextTripId: tripId, baseRevision: revision, payload, expiresAt: new Date(Date.now() + 30 * 60_000) });
    return id;
  }
  async approve(id: string, actor: string, mutate: (context: BudgetContext, payload: unknown, revision: number) => string[], tripId: string) {
    const result = await this.db.transaction(async session => {
      const row = await this.db.models.proposals.findOne({ id, ownerId: actor, contextTripId: tripId }).session(session).lean();
      if (!row) throw new NotFoundError("proposal_not_found", "Proposal not found");
      const context = await this.context(tripId, actor, true, session);
      if ((row.payload as { kind?: string }).kind !== "budget_replan") throw new DomainError("budget_invalid_proposal", "Not a budget replan");
      if ((row.payload as { rolledBackAt?: string } | null)?.rolledBackAt) throw new DomainError("proposal_rolled_back", "Generate a fresh proposal after rollback");
      if (row.resultTripId) return { tripId: row.resultTripId, revision: null };
      if (row.expiresAt.getTime() <= Date.now()) throw new DomainError("proposal_expired", "Generate a fresh proposal");
      const removed = mutate(context, row.payload, Number(row.baseRevision));
      const repository = new MongoTripRepository(this.db);
      const revision = await repository.bump(tripId, session, Number(row.baseRevision));
      await repository.removeStops(tripId, removed, session);
      const intake = context.trip.intake!;
      const costs = { ...intake.budgetForecast!.costs };
      removed.forEach(stopId => { delete costs[stopId]; });
      await this.db.models.trips.updateOne({ id: tripId }, { $set: { intake: { ...intake, budgetForecast: { ...intake.budgetForecast, costs } } } }, { session, runValidators: true });
      await this.db.models.proposals.updateOne({ id, ownerId: actor }, { $set: { resultTripId: tripId, approvedAt: new Date(), payload: { ...row.payload as object, appliedRevision: revision, approvedBy: actor, beforeStops: context.trip.stops, afterStops: context.trip.stops.filter(stop => !removed.includes(stop.id)), beforeForecast: intake.budgetForecast } } }, { session, runValidators: true });
      return { tripId, revision };
    });
    if (result.revision !== null) await this.notify(tripId, actor, result.revision);
    return result.tripId;
  }
}
