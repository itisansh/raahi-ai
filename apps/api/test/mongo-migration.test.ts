import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { connectMongo, type MongoDatabase } from "../src/config/db";
import type { SqlClient, SqlConnection } from "../src/repositories/sql";
import { exportSql, sourceColumns } from "../src/repositories/migration/export";
import { importSnapshot, reconcile, restoreSnapshot } from "../src/repositories/migration/import";
import { exactMinor, digest, transformExport } from "../src/repositories/migration/transform";
import { tables, type MigrationExport, type Row, type SourceTable } from "../src/repositories/migration/manifest";
import { MongoTripRepository } from "../src/repositories/mongo/trip";
import { MongoAgentSessionRepository } from "../src/repositories/mongo/agent";
import { hashPassword } from "better-auth/crypto";
import { createAuth } from "../src/integrations/auth";
import { loadNodeConfig } from "../src/config/env";
import { mongodbAdapter } from "better-auth/adapters/mongodb";

const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
const date = "2099-01-01T00:00:00.000Z";
function fixture(): MigrationExport {
  const columns = sourceColumns(schema);
  const rows = Object.fromEntries(Object.keys(tables).map(name => [name, []])) as unknown as MigrationExport["rows"];
  const add = (table: SourceTable, overrides: Row) => {
    const row = Object.fromEntries(columns[table].map(c => [c.name, c.nullable ? null : c.type === "DateTime" ? date : c.type === "Json" ? {} : c.type === "Boolean" ? false : ["Int", "Float"].includes(c.type) ? 0 : c.type === "Decimal" || c.type === "BigInt" ? "0" : ""]));
    rows[table].push({ ...row, ...overrides });
  };
  add("user", { id: "legacy-user", name: "Traveler", email: "m4@example.test", emailVerified: true, defaultCurrency: "INR" });
  add("account", { id: "legacy-account", userId: "legacy-user", accountId: "legacy-user", providerId: "credential", password: "set-in-test" });
  add("session", { id: "legacy-session", userId: "legacy-user", token: "legacy-token" });
  add("verification", { id: "legacy-verification", identifier: "fixture", value: "hashed-fixture" });
  add("twoFactor", { id: "legacy-twofactor", userId: "legacy-user", secret: "encrypted-fixture", backupCodes: "encrypted-fixture", verified: true });
  add("trips", { id: "trip", title: "Migration fixture", status: "planning", currency: "INR", owner_id: "member", cover_color: "#123456", start_date: "2099-01-01", end_date: "2099-01-01", intake: null, version: 7 });
  add("trip_members", { id: "member", trip_id: "trip", user_id: "legacy-user", name: "Traveler", short_name: "Traveler", initials: "T", role: "owner", avatar_bg: "#fff", avatar_fg: "#000", can_invite: true });
  add("trip_days", { trip_id: "trip", number: 1, date: "2099-01-01", city: "Lucknow", color: "#123456" });
  add("stops", { id: "stop", trip_id: "trip", day: 1, name: "Museum", category: "Sight", lat: 26, lng: 80, created_by: "member" });
  add("stop_votes", { stop_id: "stop", member_id: "member" });
  add("stop_comments", { id: "123", stop_id: "stop", author_id: "member", text: "Original comment", time_label: "Yesterday" });
  add("expenses", { id: "expense", trip_id: "trip", description: "Meal", payer_id: "member", amount: "12.34", currency: "INR", category: "Food", allocations: { member: 12.34 } });
  add("expense_participants", { expense_id: "expense", member_id: "member" });
  add("reservations", { id: "reservation", trip_id: "trip", type: "activity", status: "confirmed", title: "Booking", timezone: "Asia/Kolkata", stop_id: "stop", expense_id: "expense", amount_minor: "1234", currency: "INR", created_by: "legacy-user", idempotency_key: "retry" });
  add("trip_invites", { id: "invite", trip_id: "trip", token_hash: "hash", created_by: "legacy-user", access_scope: "restricted_emails", role: "editor", status: "active" });
  add("trip_invite_allowed_emails", { invite_id: "invite", email: "friend@example.test" });
  add("trip_invite_acceptances", { invite_id: "invite", user_id: "legacy-user" });
  add("agent_messages", { id: "message", seq: "42", trip_id: "trip", role: "user", parts: [{ type: "text", text: "Hello" }], source: "chat", actor_user_id: "legacy-user" });
  add("agent_suggestions", { id: "suggestion", trip_id: "trip", message_id: "message", status: "applied", severity: "info", confidence: 0.9, patch: { kind: "rename_trip", title: "Title" }, applied_by: "legacy-user" });
  add("agent_suggestion_dismissals", { suggestion_id: "suggestion", user_id: "legacy-user" });
  add("planning_proposals", { id: "proposal", owner_id: "legacy-user", payload: { fixture: true }, context_trip_id: "trip", base_revision: 6, result_trip_id: "trip" });
  add("user_preferences", { user_id: "legacy-user", planner_sidebar_width: "30.5" });
  add("schema_migrations", { name: "historical" });
  return { version: 1, schemaSha256: createHash("sha256").update(schema).digest("hex"), exportedAt: date, columns, rows, prismaHistory: [{ id: "historical-prisma" }] };
}
let replica: MongoMemoryReplSet;
const connections: MongoDatabase[] = [];
async function fresh() { const db = await connectMongo(replica.getUri(`m4_${crypto.randomUUID().replaceAll("-", "")}`)); connections.push(db); return db; }
beforeAll(async () => { replica = await MongoMemoryReplSet.create({ binary: { version: "8.2.1" }, replSet: { count: 1, ip: "127.0.0.1" } }); }, 90_000);
afterAll(async () => { for (const db of connections) await db.close(); await replica?.stop(); });
describe("M4 offline migration rehearsal", () => {
  it("exports on one read-only snapshot and casts money/bigints to text", async () => {
    const source = fixture(); const queries: string[] = [];
    const client: SqlConnection = { release() {}, async query<T>(sql: string) {
      queries.push(sql);
      let rows: unknown[] = [];
      if (sql.includes("information_schema.tables")) rows = Object.keys(tables).map(table_name => ({ table_name }));
      else if (sql.includes("information_schema.columns")) rows = Object.entries(source.columns).flatMap(([table_name, columns]) => columns.map(column => ({ table_name, column_name: column.name })));
      else if (sql.startsWith("SELECT")) { const table = sql.match(/FROM "(\w+)"/)?.[1] as SourceTable; rows = source.rows[table]; }
      return { rows: rows as T[], rowCount: rows.length };
    } };
    const db: SqlClient = { provider: "postgres", connect: async () => client, query: client.query, end: async () => {} };
    const exported = await exportSql(db, schema);
    expect(exported.rows).toEqual(source.rows);
    expect(queries[0]).toBe("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    expect(queries.at(-1)).toBe("COMMIT");
    expect(queries.some(sql => sql.includes('"amount"::text'))).toBe(true);
    expect(queries.some(sql => sql.includes('"seq"::text'))).toBe(true);
  });
  it("parses decimal strings exactly and refuses precision loss", () => {
    expect(exactMinor("9999999999.99", 100)).toBe(999999999999);
    expect(exactMinor("1200.00", 1)).toBe(1200);
    expect(() => exactMinor("12.345", 100)).toThrow(); expect(() => exactMinor("1.01", 1)).toThrow();
  });
  it("imports every source table, preserves DTOs and login, replays and restores", async () => {
    const db = await fresh(); const source = fixture();
    source.rows.account[0]!.password = await hashPassword("Synthetic-Migration-Password-123!");
    const before = digest(source);
    const report = await importSnapshot(source, db); expect(report.sourceTables).toBe(23);
    expect(await importSnapshot(source, db)).toEqual(report);
    const snapshot = (await new MongoTripRepository(db).findById("trip"))!.toSnapshot();
    expect(snapshot).toMatchObject({ id: "trip", version: 7, title: "Migration fixture", expenses: [{ amount: 12.34, allocations: { member: 12.34 }, participants: ["member"] }], stops: [{ id: "stop", votes: ["member"], comments: [{ text: "Original comment" }] }] });
    const config = loadNodeConfig({ MONGO_URI: replica.getUri("unused"), BASE_URL: "http://localhost:8780", BETTER_AUTH_SECRET: "synthetic-m4-secret-with-at-least-32-characters", STORAGE_BACKEND: "fs", STORAGE_ROOT: "/tmp/m4" });
    const auth = createAuth(config, mongodbAdapter(db.connection.db!, { client: db.connection.getClient() }), { stringIds: true });
    const response = await auth.handler(new Request("http://localhost:8780/api/auth/sign-in/email", { method: "POST", headers: { "content-type": "application/json", origin: "http://localhost:8780" }, body: JSON.stringify({ email: "m4@example.test", password: "Synthetic-Migration-Password-123!" }) }));
    expect(response.status).toBe(200); expect((await response.json() as {user: {id: string}}).user.id).toBe("legacy-user");
    const archived = await restoreSnapshot(db); expect(digest(archived)).toBe(before);
    const restored = await fresh(); await importSnapshot(archived, restored);
    expect((await new MongoTripRepository(restored).findById("trip"))!.toSnapshot()).toEqual(snapshot);
    const message = await new MongoAgentSessionRepository(restored).appendMessage({ id: "new-message", tripId: "trip", role: "user", source: "chat", parts: [], actorUserId: "legacy-user", tripVersion: 7 });
    expect(message.seq).toBe(43);
  });
  it("rejects source drift, unknown fields, orphans and occupied targets before import", async () => {
    const db = await fresh(); const source = fixture(); source.rows.expenses[0]!.amount = "12.345";
    await expect(importSnapshot(source, db)).rejects.toThrow();
    expect(await db.connection.db!.listCollections().toArray()).toHaveLength(0);
    const orphan = fixture(); orphan.rows.reservations[0]!.stop_id = "missing";
    await expect(transformExport(orphan, db)).rejects.toThrow("Orphan reservation stop");
    const unknown = fixture(); unknown.rows.trips[0]!.unmapped = true;
    await expect(transformExport(unknown, db)).rejects.toThrow("column mismatch");
    await db.connection.db!.collection("unrelated").insertOne({ private: true });
    await expect(importSnapshot(fixture(), db)).rejects.toThrow("empty target");
  });
  it("rolls back all imported data on a late unique-index failure and fences the target", async () => {
    const db = await fresh(); const source = fixture();
    source.rows.user.push({ ...source.rows.user[0]!, id: "duplicate-email-user" });
    await expect(importSnapshot(source, db)).rejects.toThrow();
    expect(await db.models.trips.countDocuments()).toBe(0);
    expect(await db.connection.db!.collection("user").countDocuments()).toBe(0);
    await expect(importSnapshot(source, db)).rejects.toThrow("incomplete import");
  });
  it("rejects broken proposal ownership and approval-result links before writing", async () => {
    for (const field of ["owner_id", "context_trip_id", "result_trip_id"]) {
      const db = await fresh(); const source = fixture();
      source.rows.planning_proposals[0]![field] = "missing";
      await expect(importSnapshot(source, db)).rejects.toThrow("Orphan proposal");
      expect(await db.connection.db!.listCollections().toArray()).toHaveLength(0);
    }
  });
  it("detects corruption of the rollback archive even when application records match", async () => {
    const db = await fresh(); const source = fixture(); await importSnapshot(source, db);
    await db.connection.db!.collection("migration_imports").updateOne({}, { $set: { "source.prismaHistory": [] } });
    await expect(reconcile(source, db)).rejects.toThrow("corrupt migration snapshot");
    await expect(importSnapshot(source, db)).rejects.toThrow("corrupt migration snapshot");
    await expect(restoreSnapshot(db)).rejects.toThrow("corrupt migration snapshot");
  });
  it("detects target tampering and refuses to overwrite it on replay", async () => {
    const db = await fresh(); const source = fixture(); await importSnapshot(source, db);
    await db.models.trips.updateOne({ id: "trip" }, { $set: { title: "Changed" } }, { runValidators: true });
    await expect(reconcile(source, db)).rejects.toThrow("Reconciliation mismatch");
    await expect(importSnapshot(source, db)).rejects.toThrow("Reconciliation mismatch");
    expect((await db.models.trips.findOne({ id: "trip" }).lean())!.title).toBe("Changed");
  });
});
