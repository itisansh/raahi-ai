import { createTripChange, type TripChangePublisher } from "../domain/realtime";
import { DomainError, NotFoundError } from "../domain/shared/errors";
import type { BudgetContext, BudgetForecast, BudgetStore } from "../services/budget/budget-service";
import type { SqlClient, SqlConnection } from "./sql";
import { SqlTripRepository } from "./trip-repository.db";
import { SqlReservationRepository } from "./reservation-repository.db";
import { SqlProposalStore } from "./proposal-store.db";

function scopedClient(db: SqlClient, connection: SqlConnection): SqlClient {
  let queued: Promise<unknown> = Promise.resolve();
  return { provider: db.provider, query<T>(sql: string, params?: unknown[]) { const result = queued.then(() => connection.query<T>(sql, params)); queued = result.catch(() => {}); return result; }, connect: async () => connection, end: async () => {} };
}
export class SqlBudgetStore implements BudgetStore {
  constructor(private db: SqlClient, private publisher?: TripChangePublisher) {}
  private async notify(id: string, actor: string, revision: number) {
    if (!this.publisher) return;
    try {
      await this.publisher.publish(createTripChange({ eventId: crypto.randomUUID(), tripId: id, actorId: actor, revision, occurredAt: new Date().toISOString(), scopes: ["trip", "stops"] }));
    } catch { console.warn("Budget update committed but realtime notification failed"); }
  }
  private async context(db: SqlClient, id: string, actor: string, editable: boolean): Promise<BudgetContext> {
    const trip = await new SqlTripRepository(db).findById(id);
    if (!trip || !trip.permissionsFor(actor).isMember) throw new NotFoundError("trip_not_found", "Trip not found");
    if (editable && !trip.permissionsFor(actor).canEdit) throw new DomainError("budget_forbidden", "Trip edit permission required");
    return { trip: trip.toSnapshot(), reservations: (await new SqlReservationRepository(db).listByTrip(id)).map(r => r.toSnapshot()) };
  }
  async read(id: string, actor: string, editable = false) { return this.context(this.db, id, actor, editable); }
  async forecast(id: string, actor: string, forecast: BudgetForecast) {
    const c = await this.db.connect();
    try {
      await c.query("BEGIN"); await c.query(`SELECT id FROM trips WHERE id=$1 FOR UPDATE`, [id]);
      const context = await this.context(scopedClient(this.db, c), id, actor, true);
      if (Object.keys(forecast.costs).some(key => !context.trip.stops.some(s => s.id === key))) throw new DomainError("budget_invalid_forecast", "Forecast names an unknown stop");
      await c.query(`UPDATE trips SET intake=$1, version=version+1 WHERE id=$2`, [JSON.stringify({ ...context.trip.intake, budgetForecast: forecast }), id]);
      await c.query("COMMIT");
      await this.notify(id, actor, context.trip.version + 1);
    } catch (error) { await c.query("ROLLBACK"); throw error; } finally { c.release(); }
  }
  async saveProposal(tripId: string, actor: string, revision: number, payload: unknown) {
    const id = crypto.randomUUID();
    // Recheck permission after provider work before retaining a private proposal.
    await this.context(this.db, tripId, actor, true);
    await new SqlProposalStore(this.db).save({ id, ownerId: actor, contextTripId: tripId, baseRevision: revision, payload, expiresAt: new Date(Date.now() + 30 * 60_000) });
    return id;
  }
  async approve(id: string, actor: string, mutate: (context: BudgetContext, payload: unknown, revision: number) => string[], tripId: string) {
    const c = await this.db.connect();
    try {
      await c.query("BEGIN");
      const { rows } = await c.query<{ context_trip_id: string; payload: unknown; base_revision: number; result_trip_id: string | null; expires_at: Date }>(`SELECT * FROM planning_proposals WHERE id=$1 AND owner_id=$2 AND context_trip_id=$3 FOR UPDATE`, [id, actor, tripId]);
      const row = rows[0];
      if (!row?.context_trip_id) throw new NotFoundError("proposal_not_found", "Proposal not found");
      await c.query(`SELECT id FROM trips WHERE id=$1 FOR UPDATE`, [row.context_trip_id]);
      const context = await this.context(scopedClient(this.db, c), row.context_trip_id, actor, true);
      const payload = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload;
      if ((payload as {kind?: string}).kind !== "budget_replan") throw new DomainError("budget_invalid_proposal", "Not a budget replan");
      if (row.result_trip_id) { await c.query("COMMIT"); return row.result_trip_id; }
      if (new Date(row.expires_at).getTime() <= Date.now()) throw new DomainError("proposal_expired", "Generate a fresh proposal");
      const removed = mutate(context, payload, Number(row.base_revision));
      for (const stopId of removed) await c.query(`DELETE FROM stops WHERE trip_id=$1 AND id=$2`, [context.trip.id, stopId]);
      const intake = context.trip.intake!;
      const costs = { ...intake.budgetForecast!.costs };
      removed.forEach(stopId => { delete costs[stopId]; });
      await c.query(`UPDATE trips SET intake=$1, version=version+1 WHERE id=$2`, [JSON.stringify({ ...intake, budgetForecast: { ...intake.budgetForecast, costs } }), context.trip.id]);
      await c.query(`UPDATE planning_proposals SET result_trip_id=$1, approved_at=CURRENT_TIMESTAMP, payload=$3 WHERE id=$2`, [context.trip.id, id, JSON.stringify({ ...payload as object, appliedRevision: context.trip.version + 1, approvedBy: actor })]);
      await c.query("COMMIT"); await this.notify(context.trip.id, actor, context.trip.version + 1); return context.trip.id;
    } catch (error) { await c.query("ROLLBACK"); throw error; } finally { c.release(); }
  }
}
