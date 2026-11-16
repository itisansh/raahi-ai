import { z } from "zod";
import { DomainError } from "../rules/shared/errors";
import type { TripSnapshot } from "../rules/trip";
import type { ReservationSnapshot } from "../rules/reservation";
import { expenseMinor } from "../rules/trip/expense-money";
export const forecastSchema = z.object({
  groupBudgetPaise: z.number().int().positive().max(999999999999),
  otherFuturePaise: z.number().int().nonnegative().max(999999999999),
  bufferPaise: z.number().int().nonnegative().max(999999999999),
  costs: z.record(z.string(), z.number().int().nonnegative().max(999999999999)),
}).strict();
export type BudgetForecast = z.infer<typeof forecastSchema>;
export interface BudgetContext { trip: TripSnapshot; reservations: ReservationSnapshot[]; }
export interface BudgetStore {
  read(tripId: string, actor: string, editable?: boolean): Promise<BudgetContext>;
  forecast(tripId: string, actor: string, forecast: BudgetForecast): Promise<void>;
  saveProposal(tripId: string, actor: string, revision: number, payload: unknown): Promise<string>;
  approve(proposalId: string, actor: string, mutate: (context: BudgetContext, payload: unknown, revision: number) => string[], tripId: string): Promise<string>;
}
export const reductionsSchema = z.object({ stopIds: z.array(z.string()).max(30), reason: z.string().min(1).max(600) }).strict();
export interface BudgetModel { propose(context: unknown): Promise<unknown>; }
export const indiaToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export function budgetSnapshot(context: BudgetContext, today: string) {
  const { trip, reservations } = context;
  const forecast = forecastSchema.safeParse(trip.intake?.budgetForecast);
  const issues: string[] = [];
  if (trip.currency !== "INR") issues.push("inr_only");
  if (!forecast.success) issues.push("forecast_missing");
  const protectedStops = new Set(reservations.map(r => r.stopId).filter(Boolean));
  const future = trip.stops.filter(s => (trip.days.find(d => d.number === s.day)?.date ?? "") >= today);
  if (trip.days.some(d => !d.date)) issues.push("dates_unknown");
  const spentPaise = trip.expenses.filter(e => (e.currency || trip.currency) === "INR").reduce((sum, e) => sum + expenseMinor(e.amount, "INR"), 0);
  if (trip.expenses.some(e => (e.currency || trip.currency) !== "INR")) issues.push("foreign_expenses");
  let committedPaise = 0;
  for (const r of reservations.filter(r => r.status === "confirmed" || r.status === "completed")) {
    if (r.expenseId && trip.expenses.some(e => e.id === r.expenseId)) continue;
    if (r.currency !== "INR" || r.amountMinor == null) issues.push("booking_cost_unknown");
    else committedPaise += r.amountMinor;
  }
  const pricedBookings = new Set(reservations.filter(r => (r.status === "confirmed" || r.status === "completed") && r.stopId).map(r => r.stopId));
  const unbookedFuture = future.filter(s => !pricedBookings.has(s.id));
  if (forecast.success && unbookedFuture.some(s => forecast.data.costs[s.id] == null)) issues.push("future_costs_missing");
  const estimatedPaise = forecast.success ? unbookedFuture.reduce((sum, s) => sum + (forecast.data.costs[s.id] ?? 0), forecast.data.otherFuturePaise) : 0;
  const groupBudgetPaise = forecast.success ? forecast.data.groupBudgetPaise : null;
  const bufferPaise = forecast.success ? forecast.data.bufferPaise : 0;
  const projectedPaise = spentPaise + committedPaise + estimatedPaise + bufferPaise;
  const remainingPaise = groupBudgetPaise == null ? null : groupBudgetPaise - projectedPaise;
  return { revision: trip.version, groupBudgetPaise, spentPaise, committedPaise, estimatedPaise, bufferPaise, projectedPaise, remainingPaise,
    remainingPerPersonPaise: remainingPaise == null || !trip.intake?.partySize ? null : Math.floor(remainingPaise / trip.intake.partySize),
    issues: [...new Set(issues)], forecast: forecast.success ? forecast.data : null,
    future: unbookedFuture.map(s => ({ id: s.id, name: s.name, day: s.day, optional: (trip.days.find(d => d.number === s.day)?.date ?? "") > today && !protectedStops.has(s.id) && ["Sight", "Shopping", "Activity", "Park"].includes(s.category), estimatePaise: forecast.success ? forecast.data.costs[s.id] ?? null : null })),
  };
}
export class BudgetService {
  constructor(private store: BudgetStore, private model: BudgetModel | null, private limiter: { consume(actor: string): Promise<boolean> }, private today = indiaToday) {}
  async status(tripId: string, actor: string) { return budgetSnapshot(await this.store.read(tripId, actor), this.today()); }
  async setForecast(tripId: string, actor: string, raw: unknown) { await this.store.forecast(tripId, actor, forecastSchema.parse(raw)); return this.status(tripId, actor); }
  async propose(tripId: string, actor: string) {
    const context = await this.store.read(tripId, actor, true); const status = budgetSnapshot(context, this.today());
    if (status.issues.length || status.remainingPaise == null || status.remainingPaise >= 0) throw new DomainError("budget_not_ready", "Complete the forecast and confirm an actual shortfall first");
    if (!this.model || !await this.limiter.consume(actor)) throw new DomainError("budget_unavailable", "Replanning unavailable; try later");
    const candidates = status.future.filter(s => s.optional && (s.estimatePaise ?? 0) > 0);
    if (!candidates.length) throw new DomainError("budget_insufficient_savings", "No optional future costs can be reduced");
    const result = reductionsSchema.parse(await this.model.propose({ shortfallPaise: -status.remainingPaise, optionalActivities: candidates }));
    const stopIds = [...new Set(result.stopIds)];
    if (!stopIds.length || stopIds.some(id => !candidates.some(s => s.id === id))) throw new DomainError("budget_invalid_proposal", "The model suggested an ineligible activity");
    const savingsPaise = candidates.filter(s => stopIds.includes(s.id)).reduce((sum, s) => sum + s.estimatePaise!, 0);
    if (status.remainingPaise + savingsPaise < 0) throw new DomainError("budget_insufficient_savings", "Optional activities cannot resolve this shortfall; revise your budget or commitments");
    const payload = { kind: "budget_replan", before: status, stopIds, removedStops: context.trip.stops.filter(s => stopIds.includes(s.id)), reason: result.reason, savingsPaise, afterProjectedPaise: status.projectedPaise - savingsPaise };
    const proposalId = await this.store.saveProposal(tripId, actor, context.trip.version, payload);
    return { proposalId, ...payload };
  }
  async approve(id: string, actor: string, tripId: string) {
    return { tripId: await this.store.approve(id, actor, (context, raw, revision) => {
      const payload = raw as { kind: string; stopIds: string[] };
      if (payload.kind !== "budget_replan" || context.trip.version !== revision) throw new DomainError("budget_stale", "Trip changed; generate a fresh replan");
      const status = budgetSnapshot(context, this.today());
      if (status.issues.length || !payload.stopIds.length || payload.stopIds.some(id => !status.future.some(s => s.id === id && s.optional))) throw new DomainError("budget_stale", "Activities are no longer eligible");
      return payload.stopIds;
    }, tripId) };
  }
}
