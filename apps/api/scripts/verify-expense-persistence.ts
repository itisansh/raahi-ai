/** Local-only integration fixtures, cleaned up by their generated IDs. */
import assert from "node:assert/strict";
import { createSqlClient } from "../src/repositories/sql/create-sql-client";
import { SqlTripRepository } from "../src/repositories/trip-repository.db";
import { TripService } from "../src/services/use-cases";
import { Trip } from "../src/domain/trip";
const url = new URL(process.env.DATABASE_URL!);
assert(["localhost", "127.0.0.1"].includes(url.hostname));
const db = createSqlClient("postgres", url.toString(), { max: 5 });
const owner = { id: crypto.randomUUID(), name: "Expense fixture" };
const trip = Trip.create({ title: "Expense fixture", currency: "INR" }, owner);
const id = trip.toSnapshot().id;
try {
  await db.query('INSERT INTO "user" (id,name,email) VALUES ($1,$2,$3)', [owner.id, owner.name, `${owner.id}@example.test`]);
  const repo = new SqlTripRepository(db); await repo.create(trip);
  const member = trip.toSnapshot().members[0]!.id;
  const service = new TripService(repo);
  const draft = { requestId: crypto.randomUUID(), description: "Lunch", amount: 600.01, currency: "INR", payer: member, participants: [member], allocations: { [member]: 600.01 } };
  await Promise.all([service.addExpense(id, draft, owner.id), service.addExpense(id, draft, owner.id)]);
  const loaded = await service.getTrip(id, owner.id);
  assert.equal(loaded.expenses.length, 1); assert.equal(loaded.expenses[0]!.amount, 600.01);
  assert.equal(loaded.expenses[0]!.allocations?.[member], 600.01);
  await service.addExpense(id, draft, owner.id);
  assert.equal((await service.getTrip(id, owner.id)).expenses.length, 1);
  await assert.rejects(service.addExpense(id, { ...draft, amount: 700 }, owner.id));
  await Promise.all([service.addExpense(id, { ...draft, requestId: crypto.randomUUID(), description: 'Second' }, owner.id), service.addExpense(id, { ...draft, requestId: crypto.randomUUID(), description: 'Third' }, owner.id)]);
  assert.equal((await service.getTrip(id, owner.id)).expenses.length, 3);
  await assert.rejects(service.addExpense(id, { ...draft, requestId: crypto.randomUUID() }, crypto.randomUUID()));
  console.log('PASS: decimal/custom share reload, concurrent/repeated same-key approval, reused-key rejection');
} finally {
  await db.query('DELETE FROM trips WHERE id=$1', [id]);
  await db.query('DELETE FROM "user" WHERE id=$1', [owner.id]);
  await db.end();
}
