/** Local PostgreSQL acceptance test; only generated fixtures are removed. */
import assert from "node:assert/strict";
import { createSqlClient } from "../src/repositories/sql/create-sql-client";
import { SqlTripRepository } from "../src/repositories/trip-repository.db";
import { SqlBudgetStore } from "../src/repositories/budget-store.db";
import { SqlReservationRepository } from "../src/repositories/reservation-repository.db";
import { Reservation } from "../src/domain/reservation";
import { Trip } from "../src/domain/trip";
import { TripService } from "../src/services/use-cases";
import { BudgetService } from "../src/services/budget/budget-service";
const url = new URL(process.env.DATABASE_URL!); assert(["localhost", "127.0.0.1"].includes(url.hostname));
const db = createSqlClient("postgres", url.toString(), { max: 5 });
const owner = { id: crypto.randomUUID(), name: "Budget test owner" }; const guest = { id: crypto.randomUUID(), name: "Budget test viewer" };
const trip = Trip.create({ title: "Budget fixture", currency: "INR", startDate: "2099-01-01", dayCount: 2 }, owner);
const id = trip.toSnapshot().id; const proposals: string[] = [];
try {
  for (const actor of [owner, guest]) await db.query('INSERT INTO "user" (id,name,email) VALUES ($1,$2,$3)', [actor.id, actor.name, `${actor.id}@example.test`]);
  const member = trip.toSnapshot().members[0]!.id;
  for (const [index, name] of ["Past activity", "Optional museum", "Booked visit"].entries()) trip.insertStop({ day: index === 0 ? 1 : 2, index, time: "10:00", name, area: "Lucknow", category: "Sight", lat: 26, lng: 80 }, member);
  trip.toSnapshot().days[0]!.date = "2020-01-01";
  const repo = new SqlTripRepository(db); await repo.create(trip);
  await repo.addMember(id, { ...Trip.create({ title: "Guest" }, guest).toSnapshot().members[0]!, role: "viewer" });
  const writes = new TripService(repo);
  await writes.addExpense(id, { description: "Paid booking", amount: 100, currency: "INR", payer: member, participants: [member] }, owner.id);
  const expense = (await writes.getTrip(id, owner.id)).expenses[0]!;
  const bookedId = trip.toSnapshot().stops[2]!.id; const removeId = trip.toSnapshot().stops[1]!.id;
  const reservation = Reservation.create({ id: crypto.randomUUID(), tripId: id, actorId: owner.id, now: new Date().toISOString(), draft: { type: "activity", title: "Paid booking", status: "confirmed", startAt: "2099-01-02T10:00:00Z", timezone: "Asia/Kolkata", stopId: bookedId, expenseId: expense.id, amountMinor: 10000, currency: "INR" } });
  const bookings = new SqlReservationRepository(db); await bookings.create(reservation, crypto.randomUUID());
  const store = new SqlBudgetStore(db); const service = new BudgetService(store, { propose: async () => ({ stopIds: [removeId], reason: "Skip optional visit." }) }, { consume: async () => true }, () => "2026-11-02");
  await service.setForecast(id, owner.id, { groupBudgetPaise: 100000, otherFuturePaise: 0, bufferPaise: 10000, costs: { [removeId]: 50000 } });
  await writes.addExpense(id, { description: "New group spending", amount: 600, currency: "INR", payer: member, participants: [member] }, owner.id);
  assert.equal((await service.status(id, owner.id)).remainingPaise, -30000);
  const stale = await service.propose(id, owner.id); proposals.push(stale.proposalId);
  assert.equal((await writes.getTrip(id, owner.id)).stops.length, 3); // Discard leaves trip unchanged.
  await writes.addExpense(id, { description: "Later expense", amount: 1, currency: "INR", payer: member, participants: [member] }, owner.id);
  await assert.rejects(service.approve(stale.proposalId, owner.id, id));
  const proposal = await service.propose(id, owner.id); proposals.push(proposal.proposalId);
  await Promise.all([service.approve(proposal.proposalId, owner.id, id), service.approve(proposal.proposalId, owner.id, id)]);
  const loaded = await writes.getTrip(id, guest.id);
  assert.equal(loaded.stops.length, 2); assert(loaded.stops.some(s => s.id === bookedId));
  assert.equal(loaded.expenses.length, 3); assert.equal(loaded.expenses[0]!.amount, 100);
  assert.equal((await bookings.listByTrip(id))[0]!.toSnapshot().expenseId, expense.id);
  assert((await service.status(id, owner.id)).remainingPaise! >= 0);
  await assert.rejects(service.propose(id, guest.id));
  const audit = await db.query<{ approved_at: Date; payload: { removedStops: unknown[] } }>(`SELECT approved_at,payload FROM planning_proposals WHERE id=$1`, [proposal.proposalId]);
  assert(audit.rows[0]!.approved_at); assert.equal(audit.rows[0]!.payload.removedStops.length, 1);
  console.log("PASS: expense shortfall, discard, stale rejection, idempotent approval, preserved bookings/history/expenses, second-member reload");
} finally {
  for (const p of proposals) await db.query('DELETE FROM planning_proposals WHERE id=$1', [p]);
  await db.query('DELETE FROM trips WHERE id=$1', [id]);
  for (const actor of [owner, guest]) await db.query('DELETE FROM "user" WHERE id=$1', [actor.id]);
  await db.end();
}
