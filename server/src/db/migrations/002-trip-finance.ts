import type { MongoDatabase } from "../connection";
/** Optional embedded finance records. Old trips remain valid without backfilling. */
export async function initializeTripFinance(database: MongoDatabase) {
  await database.connection.db!.collection("mongo_migrations").updateOne(
    { name: "002-trip-finance" },
    { $setOnInsert: { appliedAt: new Date(), description: "Optional repayments and member caps; no historical money reinterpretation" } },
    { upsert: true },
  );
}
