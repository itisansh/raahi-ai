/** Local PostgreSQL regression fixtures only; never modifies existing trips. */
import assert from "node:assert/strict";
import { createSqlClient } from "../src/repositories/sql/create-sql-client";
import { SqlTripRepository } from "../src/repositories/trip-repository.db";
import { SqlReservationRepository } from "../src/repositories/reservation-repository.db";
import { Reservation } from "../src/domain/reservation";
import { Trip } from "../src/domain/trip";
import { TripService } from "../src/services/use-cases";
const url = new URL(process.env.DATABASE_URL!);
assert(["localhost", "127.0.0.1"].includes(url.hostname));
const db = createSqlClient("postgres", url.toString(), { max: 5 });
const owner = { id: crypto.randomUUID(), name: "Integrity test owner" };
const trip = Trip.create({ title: "Integrity fixture", currency: "INR", startDate: "2099-01-01", dayCount: 2 }, owner);
const id = trip.toSnapshot().id;
try {
  await db.query('INSERT INTO "user" (id,name,email) VALUES ($1,$2,$3)', [owner.id, owner.name, `${owner.id}@example.test`]);
  const member = trip.toSnapshot().members[0]!.id;
  trip.insertStop({ day: 1, index: 0, time: "10:00", name: "Booked museum", area: "Lucknow", category: "Sight", lat: 26, lng: 80 }, member);
  const stopId = trip.toSnapshot().stops[0]!.id;
  const repo = new SqlTripRepository(db); await repo.create(trip);
  const reservations = new SqlReservationRepository(db);
  await reservations.create(Reservation.create({ id: crypto.randomUUID(), tripId: id, actorId: owner.id, now: new Date().toISOString(), draft: { type: "activity", title: "Reserved museum", status: "confirmed", startAt: "2099-01-01T10:00:00Z", timezone: "Asia/Kolkata", stopId, amountMinor: 10000, currency: "INR" } }), crypto.randomUUID());
  const service = new TripService(repo);
  const checkLink = async () => assert.equal((await reservations.listByTrip(id))[0]!.toSnapshot().stopId, stopId);
  await service.updateStop(id, stopId, { name: "Updated museum" }, owner.id); await checkLink();
  await service.toggleVote(id, stopId, owner.id); await checkLink();
  await service.addComment(id, stopId, "Keep the booking", owner.id); await checkLink();
  await service.reorderDays(id, [2, 1], owner.id); await checkLink();
  let loaded = (await repo.findById(id))!.toSnapshot();
  assert.equal(loaded.stops[0]!.day, 2);
  assert.equal(loaded.stops[0]!.comments[0]!.text, "Keep the booking");
  assert.deepEqual(loaded.stops[0]!.votes, [member]);
  const a = (await repo.findById(id))!; const b = (await repo.findById(id))!;
  const base = a.toSnapshot().version;
  a.updateStop(stopId, { name: "Concurrent A" }); b.updateStop(stopId, { name: "Concurrent B" });
  const outcomes = await Promise.allSettled([repo.save(a, base), repo.save(b, base)]);
  assert.equal(outcomes.filter(r => r.status === "fulfilled").length, 1);
  const rejected = outcomes.find(r => r.status === "rejected");
  assert(rejected?.status === "rejected"); assert.equal(rejected.reason.code, "trip_write_conflict");
  loaded = (await repo.findById(id))!.toSnapshot(); assert.equal(loaded.version, base + 1); await checkLink();
  // An expense committed after an itinerary snapshot must not be reverted by it.
  const stale = (await repo.findById(id))!; const revision = stale.toSnapshot().version;
  await service.addExpense(id, { description: "New meal", amount: 100, currency: "INR", payer: member, participants: [member] }, owner.id);
  stale.updateStop(stopId, { name: "Stale overwrite" });
  await assert.rejects(repo.save(stale, revision), { code: "trip_write_conflict" });
  assert.equal((await repo.findById(id))!.toSnapshot().expenses.length, 1); await checkLink();
  console.log("PASS: booking links survive edit/vote/comment/day reorder; concurrent and stale saves rejected; expense preserved");
} finally {
  await db.query("DELETE FROM trips WHERE id=$1", [id]);
  await db.query('DELETE FROM "user" WHERE id=$1', [owner.id]);
  await db.end();
}
