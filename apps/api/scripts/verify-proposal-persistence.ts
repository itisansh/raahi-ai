/** Development-only integration verification. Creates and removes its own fixtures. */
import assert from "node:assert/strict";
import { createSqlClient } from "../src/repositories/sql/create-sql-client";
import { SqlProposalStore } from "../src/repositories/proposal-store.db";
import { SqlTripRepository } from "../src/repositories/trip-repository.db";
import { ProposalApprovalService } from "../src/services/planning/approval-service";
import { PlanningService } from "../src/services/planning/planning-service";
import { TripService } from "../src/services/use-cases";
import { Trip } from "../src/domain/trip";

const url = new URL(process.env.DATABASE_URL!);
assert(["localhost", "127.0.0.1"].includes(url.hostname), "Use an isolated local database only");
const db = createSqlClient("postgres", url.toString(), { max: 5 });
const owner = { id: crypto.randomUUID(), name: "Proposal verification owner" };
const guest = { id: crypto.randomUUID(), name: "Proposal verification guest" };
const proposalIds: string[] = [];
const tripIds: string[] = [];
try {
  for (const actor of [owner, guest]) await db.query('INSERT INTO "user" (id,name,email) VALUES ($1,$2,$3)', [actor.id, actor.name, `${actor.id}@example.test`]);
  const store = new SqlProposalStore(db);
  const approvals = new ProposalApprovalService(store);
  const repo = new SqlTripRepository(db);
  const reads = new TripService(repo);
  const planner = new PlanningService({
    extract: async () => ({ origin: "Lucknow", partySize: 5, dayCount: 1, budgetRupees: "7000.01", budgetBasis: "per_person", currency: "INR", destinationHints: [], startDate: null, language: "en" }),
    propose: async () => ({ title: "Integration test fixture", days: [{ day: 1, city: "Lucknow", stops: [{ name: "Test park", startMinute: 600, durationMinutes: 60 }] }], costs: Object.fromEntries(["transport", "accommodation", "food", "activities", "buffer"].map(k => [k, { minRupees: "1", maxRupees: "2" }])) }),
  }, {
    placeSearch: async ({ query }) => [{ id: query, name: query.startsWith("Lucknow") ? "Lucknow" : "Test park", label: query, lat: 26.85, lng: 80.95, categories: [], address: { countryCode: "in" } }],
    routeCompute: async () => ({ distanceMeters: 1000, durationSeconds: 60, legs: [], mode: "driving" }),
  }, "test_fixture", async () => { throw new Error("No existing context expected"); }, { consume: async () => true }, store);
  const preview = await planner.preview(owner.id, { prompt: "Integration test fixture request" });
  assert.equal(preview.status, "preview");
  if (preview.status !== "preview") throw new Error("Expected preview");
  proposalIds.push(preview.proposalId);
  assert.equal(preview.approvable, true);
  assert.equal((await repo.findSummaries(owner.id)).filter(t => t.title === "Integration test fixture").length, 0);
  await assert.rejects(approvals.approve(preview.proposalId, guest));
  const results = await Promise.all([approvals.approve(preview.proposalId, owner), approvals.approve(preview.proposalId, owner)]);
  assert.equal(results[0]!.tripId, results[1]!.tripId);
  const tripId = results[0]!.tripId; tripIds.push(tripId);
  const loaded = await reads.getTrip(tripId, owner.id);
  assert.equal(loaded.stops.length, 1);
  assert.equal(loaded.stops[0]!.name, "Test park");
  assert.equal(loaded.stops[0]!.lat, 26.85);
  assert.equal(loaded.startDate, "");
  assert.equal(loaded.days[0]!.city, "Lucknow");
  assert.equal(loaded.intake?.budgetPaise, 700001);
  await assert.rejects(reads.getTrip(tripId, guest.id));
  const member = Trip.create({ title: "Membership fixture" }, guest).toSnapshot().members[0]!;
  await repo.addMember(tripId, { ...member, role: "viewer" });
  assert.equal((await reads.getTrip(tripId, guest.id)).stops[0]!.name, "Test park");
  const expired = crypto.randomUUID(); proposalIds.push(expired);
  await store.save({ id: expired, ownerId: owner.id, payload: preview, contextTripId: null, baseRevision: null, expiresAt: new Date(0) });
  await assert.rejects(approvals.approve(expired, owner));
  const blocked = crypto.randomUUID(); proposalIds.push(blocked);
  await store.save({ id: blocked, ownerId: owner.id, payload: { ...preview, issues: ["places_unverified"] }, contextTripId: null, baseRevision: null, expiresAt: new Date(Date.now() + 60000) });
  await assert.rejects(approvals.approve(blocked, owner));
  assert.equal((await db.query<{ result_trip_id: string | null }>('SELECT result_trip_id FROM planning_proposals WHERE id=$1', [blocked])).rows[0]!.result_trip_id, null);
  console.log("PASS: persisted preview; explicit atomic approval; concurrent idempotency; exact stops/dates/budget; guest denial; second-member reload; expiry and invalid-evidence rollback");
} finally {
  for (const id of proposalIds) await db.query("DELETE FROM planning_proposals WHERE id=$1", [id]);
  for (const id of tripIds) await db.query("DELETE FROM trips WHERE id=$1", [id]);
  for (const actor of [owner, guest]) await db.query('DELETE FROM "user" WHERE id=$1', [actor.id]);
  await db.end();
}
