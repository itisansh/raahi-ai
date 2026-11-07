import type { MongoDatabase } from "../../config/db";
import { initializeMongo } from "../../config/migrations/001-mongo-indexes";
import type { MigrationExport, Row } from "./manifest";
import { canonical, digest, transformExport } from "./transform";

export async function reconcile(source: MigrationExport, db: MongoDatabase) {
  const archived = await restoreSnapshot(db);
  if (digest(archived) !== digest(source)) throw new Error("Source archive reconciliation mismatch");
  const expected = await transformExport(source, db);
  const counts: Record<string, number> = {};
  for (const [name, documents] of Object.entries(expected)) {
    const actual = await db.connection.db!.collection(name).find({}).toArray();
    const ordered = (rows: unknown[]) => rows.map(canonical).sort();
    if (canonical(ordered(actual)) !== canonical(ordered(documents))) throw new Error(`Reconciliation mismatch: ${name}`);
    counts[name] = documents.length;
  }
  const counter = await db.models.counters.findOne({ name: "agent_messages" }).lean();
  const lastSeq = Math.max(0, ...source.rows.agent_messages.map(row => Number(row.seq)));
  if (counter?.value !== lastSeq) throw new Error("Agent sequence reconciliation mismatch");
  return { sourceDigest: digest(source), sourceTables: Object.keys(source.rows).length, counts };
}
/** Offline rehearsal importer; target must be new and writes must remain frozen. */
export async function importSnapshot(source: MigrationExport, db: MongoDatabase) {
  if (Buffer.byteLength(JSON.stringify(source)) > 8 * 1024 * 1024) throw new Error("Snapshot exceeds the 8 MiB rehearsal limit; a batched importer is required");
  const transformed = await transformExport(source, db); // Validate everything before any target writes.
  const native = db.connection.db!;
  const fingerprint = digest(source);
  const journal = native.collection<{ _id: string; digest: string; complete: boolean; source?: MigrationExport }>("migration_imports");
  const previous = await journal.findOne({ _id: "m4-v1" });
  if (previous) {
    if (previous.digest !== fingerprint || !previous.complete) throw new Error("Target belongs to another import or has an incomplete import");
    return reconcile(source, db);
  }
  const collections = await native.listCollections().toArray();
  for (const collection of collections) if (await native.collection(collection.name).estimatedDocumentCount()) throw new Error("Import requires an empty target database");
  // Claim ownership before initialization. An interrupted initializer stays fenced,
  // and must be inspected/restored into a fresh database rather than overwritten.
  await journal.insertOne({ _id: "m4-v1", digest: fingerprint, complete: false });
  await initializeMongo(db);
  await db.transaction(async session => {
    for (const [name, rows] of Object.entries(transformed)) for (const row of rows) {
      await native.collection<Row & { _id: string }>(name).insertOne(row as Row & { _id: string }, { session });
    }
    await db.models.counters.updateOne({ name: "agent_messages" }, { $set: { value: Math.max(0, ...source.rows.agent_messages.map(row => Number(row.seq))) } }, { session, runValidators: true });
    await journal.updateOne({ _id: "m4-v1", digest: fingerprint }, { $set: { complete: true, source } }, { session });
  });
  return reconcile(source, db);
}
export async function restoreSnapshot(db: MongoDatabase): Promise<MigrationExport> {
  const row = await db.connection.db!.collection<{ _id: string; source?: MigrationExport; complete: boolean; digest: string }>("migration_imports").findOne({ _id: "m4-v1" });
  if (!row?.complete || !row.source || digest(row.source) !== row.digest) throw new Error("Missing or corrupt migration snapshot");
  return row.source;
}
