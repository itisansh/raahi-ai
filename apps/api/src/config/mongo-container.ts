import { MongoHistoryStore } from "../repositories/mongo/history";
import { MongoFinanceStore } from "../repositories/mongo/finance";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { connectMongo } from "./db";
import { initializeMongo } from "./migrations/001-mongo-indexes";
import { assembleContainer, type CreateContainerOptions } from "./container";
import type { AppConfig } from "./env";
import type { FileStorage } from "../services/storage";
import { MongoTripRepository } from "../repositories/mongo/trip";
import { MongoTripInviteRepository } from "../repositories/mongo/invite";
import { MongoReservationRepository } from "../repositories/mongo/reservation";
import { MongoUserPreferenceRepository } from "../repositories/mongo/preferences";
import { MongoAgentSessionRepository } from "../repositories/mongo/agent";
import { MongoProposalStore } from "../repositories/mongo/proposal";
import { MongoBudgetStore } from "../repositories/mongo/budget";

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
