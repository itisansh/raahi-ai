import mongoose, { type ClientSession } from "mongoose";
import { createMongoModels } from "../models/mongo";

/** One owned connection; no global Mongoose state or automatic index deletion. */
export async function connectMongo(uri: string) {
  if (!/^mongodb(?:\+srv)?:\/\//.test(uri)) throw new Error("MONGO_URI must be a MongoDB connection string");
  const connection = mongoose.createConnection(uri, { maxPoolSize: 10, timeoutMS: 30_000, serverSelectionTimeoutMS: 10_000, autoIndex: false, autoCreate: false });
  try {
    await connection.asPromise();
    const hello = await connection.db!.admin().command({ hello: 1 });
    if (!hello.setName && hello.msg !== "isdbgrid") throw new Error("MONGO_URI must connect to a replica set or sharded cluster for transactions");
    const models = createMongoModels(connection);
    return { connection, models, transaction: <T>(work: (session: ClientSession) => Promise<T>) => connection.transaction(work, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" }, readPreference: "primary", maxCommitTimeMS: 10_000 }), close: () => connection.close() };
  } catch (error) { await connection.close(); throw error; }
}
export type MongoDatabase = Awaited<ReturnType<typeof connectMongo>>;
