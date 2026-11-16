import { MongoHistoryStore } from "../db/repositories/history";
import { MongoFinanceStore } from "../db/repositories/finance";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { connectMongo } from "../db/connection";
import { initializeMongo } from "../db/migrations/001-mongo-indexes";
import { assembleContainer, type CreateContainerOptions } from "./container";
import type { AppConfig } from "./env";
import type { FileStorage } from "../services/storage";
import { MongoTripRepository } from "../db/repositories/trip";
import { MongoTripInviteRepository } from "../db/repositories/invite";
import { MongoReservationRepository } from "../db/repositories/reservation";
import { MongoUserPreferenceRepository } from "../db/repositories/preferences";
import { MongoAgentSessionRepository } from "../db/repositories/agent";
import { MongoProposalStore } from "../db/repositories/proposal";
import { MongoBudgetStore } from "../db/repositories/budget";

export async function createMongoContainer(config: AppConfig & { mongoUri: string }, storage: FileStorage, options?: CreateContainerOptions) {
  const db = await connectMongo(config.mongoUri);
  try {
    await initializeMongo(db);
    return assembleContainer(config, storage, {
      trips: new MongoTripRepository(db), invites: new MongoTripInviteRepository(db),
      reservations: new MongoReservationRepository(db), preferences: new MongoUserPreferenceRepository(db),
      agent: new MongoAgentSessionRepository(db), proposals: new MongoProposalStore(db, options?.tripChangePublisher),
      history: new MongoHistoryStore(db, options?.tripChangePublisher),
      finance: new MongoFinanceStore(db, options?.tripChangePublisher),
      budget: new MongoBudgetStore(db, options?.tripChangePublisher),
      authDatabase: mongodbAdapter(db.connection.db!, { client: db.connection.getClient() }),
      stringAuthIds: true, dispose: db.close,
    }, options);
  } catch (error) { await db.close(); throw error; }
}
