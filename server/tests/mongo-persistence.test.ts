import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { connectMongo, type MongoDatabase } from "../src/db/connection";
import { initializeMongo } from "../src/db/migrations/001-mongo-indexes";
import { loadNodeConfig } from "../src/config/env";
import { createMongoContainer } from "../src/config/mongo-container";
import { TripService } from "../src/services";
import { Trip } from "../src/services/rules/trip";
import { Reservation } from "../src/services/rules/reservation";
import { MongoTripRepository } from "../src/db/repositories/trip";
import { MongoReservationRepository } from "../src/db/repositories/reservation";
import { MongoProposalStore } from "../src/db/repositories/proposal";
import { MongoBudgetStore } from "../src/db/repositories/budget";
import { MongoAgentSessionRepository } from "../src/db/repositories/agent";
import { MongoUserPreferenceRepository } from "../src/db/repositories/preferences";
import { MongoTripInviteRepository } from "../src/db/repositories/invite";
import { createApp } from "./http-app";
import { vi } from "vitest";
import { hashPassword } from "better-auth/crypto";

let replica: MongoMemoryReplSet;
let db: MongoDatabase;
let trips: MongoTripRepository;
beforeAll(async () => {
  // This test never reads .env/MONGO_URI and cannot touch a supplied database.
  replica = await MongoMemoryReplSet.create({ binary: { version: "8.2.1" }, replSet: { count: 1, storageEngine: "wiredTiger", ip: "127.0.0.1" } });
  db = await connectMongo(replica.getUri("m3_tests"));
  await initializeMongo(db);
  await db.connection.db!.collection<{ _id: string }>("user").insertOne({ _id: "owner" });
  trips = new MongoTripRepository(db);
}, 90_000);
afterAll(async () => { await db?.close(); await replica?.stop(); });
function fixture() {
  const trip = Trip.create({ title: "Mongo test trip", currency: "INR", startDate: "2099-01-01", dayCount: 2 }, { id: "owner", name: "Owner" });
  const member = trip.toSnapshot().members[0]!.id;
  trip.insertStop({ day: 1, index: 0, time: "10:00", name: "Museum", lat: 26, lng: 80, category: "Sight" }, member);
  return trip;
}

describe("Mongo replica-set persistence", () => {
  it("requires a Mongo URI and ignores legacy SQL settings for Node", () => {
    expect(() => loadNodeConfig({})).toThrow("MONGO_URI is required");
    const env = { MONGO_URI: replica.getUri("config_test"), DATABASE_PROVIDER: "unused", DATABASE_SSL: "unused", BASE_URL: "http://localhost:8780", BETTER_AUTH_SECRET: "synthetic-config-secret-at-least-32-characters", STORAGE_BACKEND: "fs", STORAGE_ROOT: "/tmp/raahi-config-test" };
    const config = loadNodeConfig(env);
    expect(config.mongoUri).toContain("mongodb://"); expect(config).not.toHaveProperty("databaseUrl");
  });
  it("creates explicit indexes repeatably and rejects invalid records", async () => {
    const migrations = db.connection.db!.collection("mongo_migrations");
    const before = await migrations.find().sort({ name: 1 }).toArray();
    expect(before.map(migration => migration.name)).toEqual(["001-mongo-indexes", "002-trip-finance"]);
    await db.models.trips.collection.createIndex({ title: 1 }, { name: "existing_title_index" });
    await initializeMongo(db);
    expect(await migrations.find().sort({ name: 1 }).toArray()).toEqual(before);
    expect((await db.models.trips.collection.indexes()).some(index => index.name === "existing_title_index")).toBe(true);
    await expect(db.models.expenses.create({ id: "invalid", tripId: "t", description: "Bad", payer: "p", amountMinor: 1.5, scale: 100, category: "Food", participants: ["p"], createdOrder: 0 })).rejects.toThrow();
    expect((await db.models.proposals.collection.indexes()).some(i => i.expireAfterSeconds !== undefined)).toBe(false);
  });
  it("round-trips DTOs without Mongo fields and scopes summaries by membership", async () => {
    const trip = fixture(); await trips.create(trip);
    expect((await trips.findById(trip.toSnapshot().id))!.toSnapshot()).toEqual(trip.toSnapshot());
    expect((await trips.findSummaries("owner")).some(t => t.id === trip.toSnapshot().id)).toBe(true);
    expect((await trips.findSummaries("stranger")).some(t => t.id === trip.toSnapshot().id)).toBe(false);
  });
  it("rolls back all child writes on invalid creation", async () => {
    const s = fixture().toSnapshot(); s.stops[0]!.day = 99;
    await expect(trips.create(Trip.fromSnapshot(s))).rejects.toThrow();
    expect(await db.models.trips.countDocuments({ id: s.id })).toBe(0);
    expect(await db.models.members.countDocuments({ tripId: s.id })).toBe(0);
  });
  it("allows one competing snapshot and never rebases the stale loser", async () => {
    const trip = fixture(); await trips.create(trip);
    const id = trip.toSnapshot().id;
    const a = (await trips.findById(id))!; const b = (await trips.findById(id))!;
    const version = a.toSnapshot().version;
    a.updateStop(a.toSnapshot().stops[0]!.id, { name: "A" });
    b.updateStop(b.toSnapshot().stops[0]!.id, { name: "B" });
    const outcomes = await Promise.allSettled([trips.save(a, version), trips.save(b, version)]);
    expect(outcomes.filter(o => o.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.find(o => o.status === "rejected")).toMatchObject({ reason: { code: "trip_write_conflict" } });
    expect((await trips.findById(id))!.toSnapshot().version).toBe(version + 1);
  });
  it("serializes expense retries, preserves allocations and exact minor units", async () => {
    const trip = fixture(); await trips.create(trip);
    const s = trip.toSnapshot(); const member = s.members[0]!.id;
    const service = new TripService(trips);
    const requestId = crypto.randomUUID();
    const add = () => service.addExpense(s.id, { requestId, description: "Meal", amount: 12.34, currency: "INR", payer: member, participants: [member], allocations: { [member]: 12.34 } }, "owner");
    await Promise.all([add(), add()]);
    const result = (await trips.findById(s.id))!.toSnapshot();
    expect(result.expenses).toHaveLength(1);
    expect(result.expenses[0]).toMatchObject({ amount: 12.34, allocations: { [member]: 12.34 } });
    expect(await db.models.expenses.findOne({ tripId: s.id }).lean()).toMatchObject({ amountMinor: 1234, scale: 100, allocations: { [member]: 1234 } });
    expect(result.version).toBe(s.version + 1);
  });
  it("keeps reservation links, clears removed stop links and checks revisions", async () => {
    const trip = fixture(); await trips.create(trip); const s = trip.toSnapshot();
    const repo = new MongoReservationRepository(db);
    const make = (id: string) => Reservation.create({ id, tripId: s.id, actorId: "owner", now: new Date().toISOString(), draft: { type: "activity", title: "Museum", startAt: "2099-01-01T10:00:00Z", timezone: "Asia/Kolkata", stopId: s.stops[0]!.id, amountMinor: 1234, currency: "INR" } });
    const [a, b] = await Promise.all([repo.create(make(crypto.randomUUID()), "same"), repo.create(make(crypto.randomUUID()), "same")]);
    expect(a.reservation.toSnapshot().id).toBe(b.reservation.toSnapshot().id);
    expect((await trips.findById(s.id))!.toSnapshot().version).toBe(s.version + 1);
    const edited = (await trips.findById(s.id))!; const v = edited.toSnapshot().version;
    edited.updateStop(s.stops[0]!.id, { name: "Retained" }); await trips.save(edited, v);
    expect((await repo.listByTrip(s.id))[0]!.toSnapshot().stopId).toBe(s.stops[0]!.id);
    const removed = (await trips.findById(s.id))!; const old = removed.toSnapshot().version;
    removed.deleteDay(1); await trips.deleteDay(removed, old);
    expect((await repo.listByTrip(s.id))[0]!.toSnapshot()).toMatchObject({ stopId: null, amountMinor: 1234 });
    expect(await repo.save(a.reservation, 99)).toBeNull();
    await expect(repo.create(make(crypto.randomUUID()), "missing-stop")).rejects.toMatchObject({ code: "invalid_stop" });
  });
  it("atomically approves once, hides other owners and retains expired approval results", async () => {
    const store = new MongoProposalStore(db); const id = crypto.randomUUID();
    await store.save({ id, ownerId: "owner", payload: {}, contextTripId: null, baseRevision: null, expiresAt: new Date(Date.now() + 60_000) });
    await expect(store.approve(id, "stranger", fixture)).rejects.toMatchObject({ code: "proposal_not_found" });
    const [a, b] = await Promise.all([store.approve(id, "owner", fixture), store.approve(id, "owner", fixture)]);
    expect(a).toBe(b);
    await db.models.proposals.updateOne({ id }, { $set: { expiresAt: new Date(0) } }, { runValidators: true });
    expect(await store.approve(id, "owner", fixture)).toBe(a);
    const broken = crypto.randomUUID(); await store.save({ id: broken, ownerId: "owner", payload: {}, contextTripId: null, baseRevision: null, expiresAt: new Date(Date.now() + 60_000) });
    await expect(store.approve(broken, "owner", () => { const s = fixture().toSnapshot(); s.stops[0]!.day = 99; return Trip.fromSnapshot(s); })).rejects.toThrow();
    expect(await db.models.proposals.findOne({ id: broken }).lean()).toMatchObject({ resultTripId: null, approvedAt: null });
  });
  it("checks budget authorization and rejects a stale proposal atomically", async () => {
    const trip = fixture(); await trips.create(trip); const id = trip.toSnapshot().id;
    const store = new MongoBudgetStore(db);
    await expect(store.read(id, "stranger")).rejects.toMatchObject({ code: "trip_not_found" });
    await store.forecast(id, "owner", { groupBudgetPaise: 5000, otherFuturePaise: 0, bufferPaise: 0, costs: { [trip.toSnapshot().stops[0]!.id]: 1000 } });
    const context = await store.read(id, "owner");
    const proposal = await store.saveProposal(id, "owner", context.trip.version, { kind: "budget_replan" });
    await trips.rename(id, "Changed");
    await expect(store.approve(proposal, "owner", c => [c.trip.stops[0]!.id], id)).rejects.toMatchObject({ code: "trip_write_conflict" });
    expect((await trips.findById(id))!.toSnapshot().stops).toHaveLength(1);
    expect(await db.models.proposals.findOne({ id: proposal }).lean()).toMatchObject({ resultTripId: null });
  });
  it("commits a reviewed budget reduction once while keeping the expense ledger", async () => {
    const trip = fixture(); await trips.create(trip); const snapshot = trip.toSnapshot();
    const member = snapshot.members[0]!.id;
    const service = new TripService(trips);
    await service.addExpense(snapshot.id, { description: "Paid meal", amount: 2.5, payer: member, participants: [member] }, "owner");
    const store = new MongoBudgetStore(db);
    await store.forecast(snapshot.id, "owner", { groupBudgetPaise: 1000, otherFuturePaise: 0, bufferPaise: 100, costs: { [snapshot.stops[0]!.id]: 2000 } });
    const before = await store.read(snapshot.id, "owner");
    const proposal = await store.saveProposal(snapshot.id, "owner", before.trip.version, { kind: "budget_replan" });
    const remove = () => [snapshot.stops[0]!.id];
    expect(await store.approve(proposal, "owner", remove, snapshot.id)).toBe(snapshot.id);
    expect(await store.approve(proposal, "owner", remove, snapshot.id)).toBe(snapshot.id);
    const after = await store.read(snapshot.id, "owner");
    expect(after.trip.expenses).toEqual(before.trip.expenses);
    expect(after.trip.stops).toHaveLength(0);
    expect(after.trip.version).toBe(before.trip.version + 1);
    expect(after.trip.intake!.budgetForecast!.costs).toEqual({});
  });
  it("updates member projections and preserves legacy whole-unit money", async () => {
    const s = fixture().toSnapshot(); s.currency = "JPY"; const trip = Trip.fromSnapshot(s); await trips.create(trip);
    const service = new TripService(trips); const member = s.members[0]!.id;
    await service.addExpense(s.id, { description: "Legacy", amount: 1200, payer: member, participants: [member] }, "owner");
    expect(await db.models.expenses.findOne({ tripId: s.id }).lean()).toMatchObject({ amountMinor: 1200, scale: 1 });
    expect((await trips.findById(s.id))!.toSnapshot().expenses[0]!.amount).toBe(1200);
    const before = (await trips.findById(s.id))!.toSnapshot().version;
    await trips.syncMemberProfile("owner", { name: "Updated Name", image: null });
    const after = (await trips.findById(s.id))!.toSnapshot();
    expect(after.members[0]).toMatchObject({ name: "Updated Name", initials: "UN", image: null });
    expect(after.version).toBe(before + 1);
  });
  it("maintains message sequence and permits one suggestion claimant", async () => {
    const trip = fixture(); await trips.create(trip); const id = trip.toSnapshot().id;
    const repo = new MongoAgentSessionRepository(db);
    await Promise.all(Array.from({ length: 4 }, () => repo.appendMessage({ id: crypto.randomUUID(), tripId: id, role: "user", source: "chat", actorUserId: "owner", parts: [{ type: "text", text: "hello" }], tripVersion: 0 })));
    const messages = await repo.listMessages(id); expect(new Set(messages.map(m => m.seq)).size).toBe(4);
    expect(await repo.latestSeq(id)).toBe(messages[3]!.seq);
    const suggestion = await repo.createSuggestion({ id: crypto.randomUUID(), tripId: id, messageId: null, severity: "info", confidence: 0.9, reason: "test", suggestionText: "test", patch: { kind: "rename_trip", title: "Proposed" }, tripVersion: 0, expiresAt: null });
    expect((await Promise.all([repo.claimForApply(suggestion.id, "owner"), repo.claimForApply(suggestion.id, "owner")])).filter(Boolean)).toHaveLength(1);
  });
  it("preserves unrelated preferences and deduplicates invite acceptances", async () => {
    const preferences = new MongoUserPreferenceRepository(db);
    await preferences.updateAgentPanel("owner", false);
    await Promise.all([preferences.updateAgentPanel("owner", true), preferences.updatePlannerSidebar("owner", 35, true)]);
    expect(await preferences.findByUserId("owner")).toMatchObject({ plannerSidebar: { width: 35, collapsed: true }, agentPanelCollapsed: true });
    const trip = fixture(); await trips.create(trip); const invites = new MongoTripInviteRepository(db); const id = crypto.randomUUID();
    await invites.create({ id, tripId: trip.toSnapshot().id, tokenHash: crypto.randomUUID(), createdBy: "owner", accessScope: "anyone", allowedEmails: [], role: "editor", canInvite: false, status: "active", expiresAt: null, createdAt: new Date().toISOString() });
    await Promise.all([invites.recordAcceptance(id, "owner"), invites.recordAcceptance(id, "owner")]);
    expect(await db.models.acceptances.countDocuments({ inviteId: id })).toBe(1);
    await invites.revoke(id);
    expect(await db.models.invites.findOne({ id }).lean()).toMatchObject({ status: "revoked" });
  });
  it("uses real Better Auth through Mongo composition with imported string IDs", async () => {
    const config = loadNodeConfig({ MONGO_URI: replica.getUri("m3_auth"), STORAGE_BACKEND: "fs", STORAGE_ROOT: "/tmp/raahi-m3-test-storage", BETTER_AUTH_SECRET: "m3-disposable-test-secret-with-at-least-32-characters", BASE_URL: "http://localhost:8780" });
    const container = await createMongoContainer(config, { read: async () => null, write: async () => {}, delete: async () => {}, getPublicUrl: path => path });
    const connection = await connectMongo(config.mongoUri);
    try {
      const authDb = connection.connection.db!; const now = new Date();
      // Synthetic legacy account, never copied from a real user/database.
      await authDb.collection<{ _id: string; [key: string]: unknown }>("user").insertOne({ _id: "legacy-user", email: "legacy@example.test", name: "Legacy", emailVerified: true, defaultCurrency: "INR", createdAt: now, updatedAt: now });
      await authDb.collection<{ _id: string; [key: string]: unknown }>("account").insertOne({ _id: "legacy-account", userId: "legacy-user", accountId: "legacy-user", providerId: "credential", password: await hashPassword("Synthetic-Password-123!"), createdAt: now, updatedAt: now });
      const app = createApp(container);
      const login = await app.request(new Request("http://localhost:8780/api/auth/sign-in/email", { method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost:8780" }, body: JSON.stringify({ email: "legacy@example.test", password: "Synthetic-Password-123!" }) }));
      expect(login.status).toBe(200);
      const data = await login.json() as { user: { id: string }; token: string };
      expect(data.user.id).toBe("legacy-user");
      expect(login.headers.getSetCookie().length).toBeGreaterThan(0);
      const session = await container.auth.api.getSession({ headers: new Headers({ authorization: `Bearer ${data.token}` }) });
      expect(session?.user.id).toBe("legacy-user");
      expect(container.budgetService).toBeDefined(); expect(container.proposalApprovalService).not.toBeNull();
      expect(container).not.toHaveProperty("pool");
      const denied = await app.request("/api/trips"); expect(denied.status).toBe(401);
      const headers = { authorization: `Bearer ${data.token}`, "content-type": "application/json" };
      const created = await app.request("/api/trips", { method: "POST", headers, body: JSON.stringify({ title: "Persisted over HTTP", currency: "INR", dayCount: 2 }) });
      expect(created.status).toBe(201);
      const ownTrips = await app.request("/api/trips", { headers }); expect(ownTrips.status).toBe(200);
      expect(JSON.stringify(await ownTrips.json())).toContain("Persisted over HTTP");
      const cookie = login.headers.getSetCookie().map(c => c.split(";")[0]).join("; ");
      expect((await app.request("/api/trips", { headers: { cookie } })).status).toBe(200);
      const wrong = await app.request("/api/auth/sign-in/email", { method: "POST", headers: { "content-type": "application/json", Origin: "http://localhost:8780" }, body: JSON.stringify({ email: "legacy@example.test", password: "wrong-password" }) });
      expect(wrong.status).toBe(401);
      // Capture console mail in memory, never send a real email.
      const log = vi.spyOn(console, "info").mockImplementation(() => {});
      try {
        const signup = await app.request("/api/auth/sign-up/email", { method: "POST", headers: { "content-type": "application/json", Origin: "http://localhost:8780" }, body: JSON.stringify({ name: "New Traveler", email: "new@example.test", password: "New-Synthetic-Password-123!" }) });
        expect(signup.status).toBe(200);
        const newUser = await signup.json() as { user: { id: string; emailVerified: boolean }; token: string | null };
        expect(typeof newUser.user.id).toBe("string");
        expect(newUser.token).toBeNull();
        expect(newUser.user.emailVerified).toBe(false);
        expect(log.mock.calls.flat().some(value => typeof value === "string" && /verification code is \d{6}/.test(value))).toBe(true);
        const signupCookie = signup.headers.getSetCookie().map(c => c.split(";")[0]).join("; ");
        expect((await app.request("/api/trips", { headers: { cookie: signupCookie } })).status).toBe(401);
        const immediateLogin = await app.request("/api/auth/sign-in/email", { method: "POST", headers: { "content-type": "application/json", Origin: "http://localhost:8780" }, body: JSON.stringify({ email: "new@example.test", password: "New-Synthetic-Password-123!" }) });
        expect(immediateLogin.status).toBe(403);
        expect(await immediateLogin.json()).toMatchObject({ code: "EMAIL_NOT_VERIFIED" });
        expect(log.mock.calls.flat().filter(value => typeof value === "string" && value.includes("verification code is"))).toHaveLength(2);
        log.mockClear();
        const provisioned = await new MongoTripRepository(connection).findSummaries(newUser.user.id);
        expect(provisioned.length).toBe(1);
        expect(provisioned[0]!.currency).toBe("INR");
        const sendOtp = await app.request("/api/auth/email-otp/send-verification-otp", { method: "POST", headers: { "content-type": "application/json", Origin: "http://localhost:8780" }, body: JSON.stringify({ email: "new@example.test", type: "email-verification" }) });
        expect(sendOtp.status).toBe(200);
        const otpMail = log.mock.calls.flat().find(value => typeof value === "string" && value.includes("verification code is"));
        const otp = String(otpMail).match(/verification code is (\d{6})/)?.[1];
        expect(otp).toBeDefined();
        const verify = (code: string) => app.request("/api/auth/email-otp/verify-email", { method: "POST", headers: { "content-type": "application/json", Origin: "http://localhost:8780" }, body: JSON.stringify({ email: "new@example.test", otp: code }) });
        const invalid = await verify(otp === "000000" ? "111111" : "000000");
        expect(invalid.status).toBe(400);
        const verified = await app.request("/api/auth/email-otp/verify-email", { method: "POST", headers: { "content-type": "application/json", Origin: "http://localhost:8780" }, body: JSON.stringify({ email: "new@example.test", otp }) });
        expect(verified.status).toBe(200);
        const verifiedCookie = verified.headers.getSetCookie().map(c => c.split(";")[0]).join("; ");
        expect((await app.request("/api/trips", { headers: { cookie: verifiedCookie } })).status).toBe(200);
        expect(await authDb.collection("user").findOne({ email: "new@example.test" })).toMatchObject({ emailVerified: true });
        expect((await verify(otp!)).status).toBe(400);
        const verifiedLogin = await app.request("/api/auth/sign-in/email", { method: "POST", headers: { "content-type": "application/json", Origin: "http://localhost:8780" }, body: JSON.stringify({ email: "new@example.test", password: "New-Synthetic-Password-123!" }) });
        expect(verifiedLogin.status).toBe(200);
      } finally { log.mockRestore(); }
      const logout = await app.request("/api/auth/sign-out", { method: "POST", headers: { ...headers, Origin: "http://localhost:8780" }, body: "{}" });
      expect(logout.status).toBe(200);
      expect((await app.request("/api/trips", { headers })).status).toBe(401);
    } finally { await connection.close(); await container.dispose(); }
  }, 30_000);
});

// Planning additions share the existing snapshot/revision/transaction boundary.
it("applies a reviewed plan alongside existing stops once and preserves linked data", async () => {
  const { ProposalApprovalService } = await import("../src/services/planning/approval-service");
  const trip = fixture();
  trip.addMember({ userId: "second-planner", name: "Second", role: "editor", canInvite: false });
  const before = trip.toSnapshot();
  const oldStop = before.stops[0]!;
  trip.toggleVote(oldStop.id, before.members[0]!.id);
  trip.addComment(oldStop.id, before.members[0]!.id, "Keep this stop");
  await trips.create(trip);
  const saved = (await trips.findById(before.id))!.toSnapshot();
  const publisher = { publish: vi.fn(async () => {}) };
  const store = new MongoProposalStore(db, publisher);
  const approval = new ProposalApprovalService(store);
  const id = crypto.randomUUID();
  await store.save({ id, ownerId: "owner", contextTripId: before.id, baseRevision: saved.version, expiresAt: new Date(Date.now() + 60_000), payload: {
    status: "preview", issues: [], days: [{ day: 1, city: "Jaipur", stops: [{ name: "New museum", startMinute: 900, durationMinutes: 60, evidence: { source: "fixture", checkedAt: new Date().toISOString(), place: { lat: 26.9, lng: 75.8 } } }] }],
  } });
  const results = await Promise.all([approval.approve(id, { id: "owner", name: "Owner" }), approval.approve(id, { id: "owner", name: "Owner" })]);
  expect(results.map(r => r.tripId)).toEqual([before.id, before.id]);
  const after = (await trips.findById(before.id))!.toSnapshot();
  expect(after.stops).toHaveLength(saved.stops.length + 1);
  expect(after.stops.find(s => s.id === oldStop.id)).toEqual(saved.stops.find(s => s.id === oldStop.id));
  expect(after.days).toEqual(saved.days); expect(after.expenses).toEqual(saved.expenses);
  expect(after.version).toBe(saved.version + 1);
  expect((await trips.findById(before.id))!.permissionsFor("second-planner").isMember).toBe(true);
  expect(publisher.publish).toHaveBeenCalledTimes(1);
  expect(await db.models.proposals.findOne({ id }).lean()).toMatchObject({ resultTripId: before.id });
});

it("rejects stale additions and revoked approval retries without partial writes", async () => {
  const { ProposalApprovalService } = await import("../src/services/planning/approval-service");
  const trip = fixture();
  trip.addMember({ userId: "editor-planner", name: "Editor", role: "editor", canInvite: false });
  await trips.create(trip);
  const snapshot = (await trips.findById(trip.toSnapshot().id))!.toSnapshot();
  const store = new MongoProposalStore(db);
  const approval = new ProposalApprovalService(store);
  const id = crypto.randomUUID();
  await store.save({ id, ownerId: "editor-planner", contextTripId: snapshot.id, baseRevision: snapshot.version, expiresAt: new Date(Date.now() + 60_000), payload: { status: "preview", issues: [], days: [] } });
  await trips.rename(snapshot.id, "Changed by another member");
  await expect(approval.approve(id, { id: "editor-planner", name: "Editor" })).rejects.toMatchObject({ code: "trip_write_conflict" });
  expect(await db.models.proposals.findOne({ id }).lean()).toMatchObject({ resultTripId: null, approvedAt: null });
  await db.models.members.updateOne({ tripId: snapshot.id, userId: "editor-planner" }, { $set: { role: "viewer" } });
  await expect(approval.approve(id, { id: "editor-planner", name: "Editor" })).rejects.toMatchObject({ code: "forbidden" });
  expect((await trips.findById(snapshot.id))!.toSnapshot().stops).toEqual(snapshot.stops);
});

it("persists four-of-five expense shares exactly and rejects changed retry details", async () => {
  const trip = fixture();
  for (const name of ["Asha", "Kabir", "Meera", "Ravi"]) trip.addMember({ userId: `expense-${name}`, name, role: "editor", canInvite: false });
  await trips.create(trip);
  const snapshot = trip.toSnapshot();
  const selected = snapshot.members.slice(0, 4).map(member => member.id);
  const excluded = snapshot.members[4]!.id;
  const service = new TripService(trips);
  const input = { requestId: crypto.randomUUID(), description: "Lunch", amount: 600.01, currency: "INR", payer: selected[0]!, participants: selected };
  await Promise.all([service.addExpense(trip.id, input, "owner"), service.addExpense(trip.id, input, "owner")]);
  let reloaded = (await trips.findById(trip.id))!;
  expect(reloaded.toSnapshot().expenses).toHaveLength(1);
  const budget = reloaded.budget();
  expect(budget.balances.find(row => row.memberId === excluded)!.share).toBe(0);
  expect(budget.balances.reduce((sum, row) => sum + Math.round(row.share * 100), 0)).toBe(60001);
  expect(budget.balances.reduce((sum, row) => sum + Math.round(row.net * 100), 0)).toBe(0);
  await expect(service.addExpense(trip.id, { ...input, amount: 601 }, "owner")).rejects.toThrow();
  await expect(service.addExpense(trip.id, { ...input, requestId: crypto.randomUUID() }, "outsider")).rejects.toThrow();
  const allocations = Object.fromEntries(selected.map((id, i) => [id, i === 0 ? 300.01 : 100]));
  await service.addExpense(trip.id, { ...input, requestId: crypto.randomUUID(), description: "Custom meal", allocations }, "owner");
  reloaded = (await trips.findById(trip.id))!;
  expect(reloaded.toSnapshot().expenses.find(expense => expense.description === "Custom meal")!.allocations).toEqual(allocations);
  expect(reloaded.budget().balances.reduce((sum, row) => sum + Math.round(row.net * 100), 0)).toBe(0);
  expect((await service.getTrip(trip.id, "expense-Asha")).expenses).toHaveLength(2);
});

it("records and voids repayments once without changing travel spending or personal caps", async () => {
  const { FinanceService } = await import("../src/services/finance/finance-service");
  const { MongoFinanceStore } = await import("../src/db/repositories/finance");
  const trip = fixture(); trip.addMember({ userId: "debtor", name: "Debtor", role: "editor", canInvite: false });
  const s = trip.toSnapshot(); const [owner, debtor] = s.members;
  trip.addExpense({ description: "Lunch", amount: 600.01, currency: "INR", payer: owner!.id, participants: [debtor!.id] });
  await trips.create(trip);
  const service = new FinanceService(new MongoFinanceStore(db));
  const status = await service.status(s.id, "owner");
  const input = { requestId: crypto.randomUUID(), from: debtor!.id, to: owner!.id, amountMinor: 15001, currency: "INR", revision: status.revision, confirm: true };
  await Promise.all([service.repay(s.id, "owner", input), service.repay(s.id, "owner", input)]);
  let after = await service.status(s.id, "debtor");
  expect(after.repayments).toHaveLength(1); expect(after.budget.total).toBe(600.01);
  expect(after.budget.balances.find(b => b.memberId === debtor!.id)!.net).toBe(-450);
  expect(after.budget.balances.reduce((sum, b) => sum + Math.round(b.net * 100), 0)).toBe(0);
  await expect(service.repay(s.id, "owner", { ...input, amountMinor: 15000 })).rejects.toMatchObject({ code: "repayment_conflict" });
  await expect(service.repay(s.id, "outsider", input)).rejects.toThrow();
  await expect(service.repay(s.id, "owner", { ...input, requestId: crypto.randomUUID(), revision: after.revision, amountMinor: 50000 })).rejects.toMatchObject({ code: "repayment_exceeds_balance" });
  after = await service.cap(s.id, "owner", { memberId: debtor!.id, capMinor: 50000, revision: after.revision });
  expect(after.caps.find(c => c.memberId === debtor!.id)).toMatchObject({ spentMinor: 60001, remainingMinor: -10001 });
  const voidInput = { repaymentId: after.repayments[0]!.id, revision: after.revision, confirm: true };
  await Promise.all([service.void(s.id, "owner", voidInput), service.void(s.id, "owner", voidInput)]);
  after = await service.status(s.id, "owner");
  expect(after.repayments[0]!.voidedAt).toBeTruthy(); expect(after.budget.total).toBe(600.01);
  expect(after.budget.balances.find(b => b.memberId === debtor!.id)!.net).toBe(-600.01);
  expect((await trips.findById(s.id))!.toSnapshot().expenses).toHaveLength(1);
});

it("reviews and rolls back planning additions once, preserving the expense ledger", async () => {
  const { ProposalApprovalService } = await import("../src/services/planning/approval-service");
  const { MongoHistoryStore } = await import("../src/db/repositories/history");
  const trip = fixture(); const s = trip.toSnapshot();
  trip.addExpense({ description: "Lunch", amount: 600, currency: "INR", payer: s.members[0]!.id, participants: [s.members[0]!.id] });
  await trips.create(trip);
  const before = structuredClone(trip.toSnapshot());
  const store = new MongoProposalStore(db); const approval = new ProposalApprovalService(store); const history = new MongoHistoryStore(db);
  const id = crypto.randomUUID();
  await store.save({ id, ownerId: "owner", contextTripId: s.id, baseRevision: before.version, expiresAt: new Date(Date.now() + 60_000), payload: { status: "preview", issues: [], days: [{ day: 1, city: "Jaipur", stops: [{ name: "Added stop", startMinute: 900, durationMinutes: 60, evidence: { source: "fixture", checkedAt: new Date().toISOString(), place: { lat: 26.9, lng: 75.8 } } }] }] } });
  await approval.approve(id, { id: "owner", name: "Owner" });
  expect((await history.list(s.id, "owner"))[0]).toMatchObject({ canRollback: true, beforeStops: [{ name: "Museum" }] });
  await expect(history.rollback(s.id, "outsider", id, before.version + 1)).rejects.toThrow();
  await Promise.all([history.rollback(s.id, "owner", id, before.version + 1), history.rollback(s.id, "owner", id, before.version + 1)]);
  const after = (await trips.findById(s.id))!.toSnapshot();
  expect(after.stops).toEqual(before.stops); expect(after.expenses).toEqual(before.expenses);
  expect(after.version).toBe(before.version + 2);
  expect((await history.list(s.id, "owner"))[0]).toMatchObject({ canRollback: false });
  await expect(approval.approve(id, { id: "owner", name: "Owner" })).rejects.toMatchObject({ code: "proposal_rolled_back" });
});

it("restores a budget replan forecast and refuses rollback over later changes", async () => {
  const { MongoHistoryStore } = await import("../src/db/repositories/history");
  const trip = fixture(); await trips.create(trip); const before = structuredClone(trip.toSnapshot());
  const store = new MongoBudgetStore(db); const history = new MongoHistoryStore(db);
  const forecast = { groupBudgetPaise: 100000, otherFuturePaise: 0, bufferPaise: 0, costs: { [before.stops[0]!.id]: 10000 } };
  await store.forecast(before.id, "owner", forecast);
  const revision = (await trips.findById(before.id))!.toSnapshot().version;
  const id = await store.saveProposal(before.id, "owner", revision, { kind: "budget_replan", stopIds: [before.stops[0]!.id] });
  await store.approve(id, "owner", () => [before.stops[0]!.id], before.id);
  await history.rollback(before.id, "owner", id, revision + 1);
  let after = (await trips.findById(before.id))!.toSnapshot();
  expect(after.stops).toEqual(before.stops); expect(after.intake!.budgetForecast).toEqual(forecast);
  const next = await store.saveProposal(before.id, "owner", after.version, { kind: "budget_replan", stopIds: [before.stops[0]!.id] });
  await store.approve(next, "owner", () => [before.stops[0]!.id], before.id);
  await trips.rename(before.id, "Later change"); after = (await trips.findById(before.id))!.toSnapshot();
  await expect(history.rollback(before.id, "owner", next, after.version)).rejects.toMatchObject({ code: "trip_write_conflict" });
  expect((await trips.findById(before.id))!.toSnapshot().stops).toHaveLength(0);
});
