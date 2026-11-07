import { describe, expect, it, vi } from "vitest";
import { Trip } from "../src/domain/trip";
import { budgetSnapshot, BudgetService, type BudgetContext, type BudgetStore } from "../src/services/budget/budget-service";
import type { ReservationSnapshot } from "../src/domain/reservation";
export function budgetFixture(): BudgetContext {
  const trip = Trip.create({ title: "Budget fixture", currency: "INR", startDate: "2099-01-01", dayCount: 2 }, { id: "owner", name: "Owner" });
  const member = trip.toSnapshot().members[0]!.id;
  trip.insertStop({ day: 1, index: 0, time: "10:00", area: "Lucknow", name: "Optional museum", category: "Sight", lat: 26, lng: 80 }, member);
  trip.addExpense({ description: "Recorded meals", amount: 600, payer: member, participants: [member], currency: "INR" });
  const snapshot = trip.toSnapshot(); const stop = snapshot.stops[0]!;
  snapshot.intake = { partySize: 5, budgetForecast: { groupBudgetPaise: 100000, otherFuturePaise: 0, bufferPaise: 10000, costs: { [stop.id]: 50000 } } };
  return { trip: snapshot, reservations: [] };
}
describe("deterministic group budget", () => {
  it("counts actual plus future plus buffer and derives the per-person average", () => {
    const context = budgetFixture(); const status = budgetSnapshot(context, "2026-11-02");
    expect(status.spentPaise).toBe(60000); expect(status.projectedPaise).toBe(120000);
    expect(status.remainingPaise).toBe(-20000); expect(status.remainingPerPersonPaise).toBe(-4000); expect(status.issues).toEqual([]);
  });
  it("counts confirmed commitments once and protects every reserved stop", () => {
    const c = budgetFixture(); const stopId = c.trip.stops[0]!.id;
    c.reservations = [{ status: "confirmed", amountMinor: 30000, currency: "INR", stopId, expenseId: null }] as ReservationSnapshot[];
    let s = budgetSnapshot(c, "2026-11-02"); expect(s.committedPaise).toBe(30000); expect(s.estimatedPaise).toBe(0); expect(s.future).toEqual([]);
    c.reservations[0]!.expenseId = c.trip.expenses[0]!.id;
    s = budgetSnapshot(c, "2026-11-02"); expect(s.committedPaise).toBe(0);
  });
  it("requires complete costs/dates and refuses foreign-currency arithmetic", () => {
    const c = budgetFixture(); c.trip.intake!.budgetForecast!.costs = {}; c.trip.days[1]!.date = ""; c.trip.expenses[0]!.currency = "USD";
    expect(budgetSnapshot(c, "2026-11-02").issues).toEqual(expect.arrayContaining(["future_costs_missing", "dates_unknown", "foreign_expenses"]));
  });
  it("excludes past activities from forecasts and candidates", () => {
    const c = budgetFixture(); c.trip.days[0]!.date = "2020-01-01";
    expect(budgetSnapshot(c, "2026-11-02").future).toEqual([]);
  });
  it("counts today's unpaid activities but does not offer them for removal", () => {
    const c = budgetFixture(); c.trip.days[0]!.date = "2026-11-02";
    const status = budgetSnapshot(c, "2026-11-02");
    expect(status.estimatedPaise).toBe(50000);
    expect(status.remainingPaise).toBe(-20000);
    expect(status.future[0]!.optional).toBe(false);
  });
  it("reports an unknown remaining cost today instead of claiming headroom", () => {
    const c = budgetFixture(); c.trip.days[0]!.date = "2026-11-02";
    c.trip.intake!.budgetForecast!.costs = {};
    expect(budgetSnapshot(c, "2026-11-02").issues).toContain("future_costs_missing");
  });
});
function serviceFixture() {
  const c = budgetFixture(); let payload: unknown;
  const store: BudgetStore = {
    read: vi.fn(async () => c), forecast: vi.fn(async () => {}),
    saveProposal: vi.fn(async (_id, _actor, _version, data) => { payload = data; return "proposal"; }),
    approve: vi.fn(async (_id, _actor, mutate) => { mutate(c, payload, c.trip.version); return c.trip.id; }),
  };
  const model = { propose: vi.fn(async () => ({ stopIds: [c.trip.stops[0]!.id], reason: "Retain free activities and skip this optional museum." })) };
  const service = new BudgetService(store, model, { consume: async () => true }, () => "2026-11-02");
  return { c, store, model, service };
}
describe("reviewed replan", () => {
  it("retains the old plan while proposing and computes savings independently", async () => {
    const f = serviceFixture(); const before = structuredClone(f.c.trip);
    const proposal = await f.service.propose(f.c.trip.id, "owner");
    expect(f.c.trip).toEqual(before); expect(proposal.savingsPaise).toBe(50000); expect(proposal.afterProjectedPaise).toBe(70000);
    expect(f.store.read).toHaveBeenCalledWith(f.c.trip.id, "owner", true);
    expect(await f.service.approve("proposal", "owner", f.c.trip.id)).toEqual({ tripId: f.c.trip.id });
  });
  it("rejects invented stop IDs and insufficient savings", async () => {
    const f = serviceFixture(); f.model.propose.mockResolvedValueOnce({ stopIds: ["invented"], reason: "test" });
    await expect(f.service.propose(f.c.trip.id, "owner")).rejects.toMatchObject({ code: "budget_invalid_proposal" });
    f.c.trip.intake!.budgetForecast!.groupBudgetPaise = 100;
    await expect(f.service.propose(f.c.trip.id, "owner")).rejects.toMatchObject({ code: "budget_insufficient_savings" });
  });
  it("does not contact the model when the budget is incomplete or balanced", async () => {
    const f = serviceFixture(); f.c.trip.intake = null;
    await expect(f.service.propose(f.c.trip.id, "owner")).rejects.toMatchObject({ code: "budget_not_ready" });
    expect(f.model.propose).not.toHaveBeenCalled();
  });
  it("rejects stale revisions at approval", async () => {
    const f = serviceFixture(); const p = await f.service.propose(f.c.trip.id, "owner");
    const baseVersion = f.c.trip.version; f.c.trip.version++;
    (f.store.approve as ReturnType<typeof vi.fn>).mockImplementationOnce(async (_id, _actor, mutate) => mutate(f.c, p, baseVersion));
    await expect(f.service.approve("proposal", "owner", f.c.trip.id)).rejects.toMatchObject({ code: "budget_stale" });
  });
});
