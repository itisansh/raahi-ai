import type { MongoDatabase } from "../db";

/** Additive and repeatable. Never syncIndexes(): existing indexes are not dropped. */
export async function initializeMongo(database: MongoDatabase) {
  for (const model of Object.values(database.models)) {
    await model.createCollection();
    await model.createIndexes();
  }
  const db = database.connection.db!;
  for (const name of ["user", "account", "session", "verification", "twoFactor", "mongo_migrations"]) {
    if (!(await db.listCollections({ name }).hasNext())) await db.createCollection(name);
  }
  await db.collection("user").createIndex({ email: 1 }, { unique: true });
  await db.collection("account").createIndex({ providerId: 1, accountId: 1 }, { unique: true });
  await db.collection("account").createIndex({ userId: 1 });
  await db.collection("session").createIndex({ token: 1 }, { unique: true });
  await db.collection("session").createIndex({ userId: 1 });
  await db.collection("verification").createIndex({ identifier: 1 });
  await db.collection("twoFactor").createIndex({ userId: 1 });
  await db.collection("twoFactor").createIndex({ secret: 1 });
  await database.models.counters.updateOne({ name: "agent_messages" }, { $setOnInsert: { value: 0 } }, { upsert: true, runValidators: true });
  await db.collection("mongo_migrations").createIndex({ name: 1 }, { unique: true });
  await db.collection("mongo_migrations").updateOne({ name: "001-mongo-indexes" }, { $setOnInsert: { appliedAt: new Date() } }, { upsert: true });
}
