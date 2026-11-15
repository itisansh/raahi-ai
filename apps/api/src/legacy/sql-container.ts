import { createDatabaseHandles, type Pool } from "../repositories/pool";
import { SqlTripRepository } from "../repositories/trip-repository.db";
import { SqlTripInviteRepository } from "../repositories/invite-repository.db";
import { SqlUserPreferenceRepository } from "../repositories/user-preference-repository.db";
import { SqlAgentSessionRepository } from "../repositories/agent-repository.db";
import { SqlReservationRepository } from "../repositories/reservation-repository.db";
import { SqlBudgetStore } from "../repositories/budget-store.db";
import { SqlProposalStore } from "../repositories/proposal-store.db";
import { assembleContainer, type Container, type CreateContainerOptions } from "../config/container";
import type { AppConfig } from "../config/env";
import type { FileStorage } from "../services/storage";

/** Wire the runtime-neutral object graph around a selected storage adapter. */
export function createContainer(
  config: AppConfig,
  fileStorage: FileStorage,
  options?: CreateContainerOptions,
): Container {
  const poolMax = options?.poolMax ?? 5;
  const poolMaxFresh = options?.poolMaxFresh ?? 2;
  const freshUrl = options?.freshDatabaseUrl?.trim();
  const sharePool =
    !freshUrl || freshUrl === config.databaseUrl.trim();

  const cached = createDatabaseHandles(config, { max: poolMax });
  const poolCached = cached.pool;

  let poolFresh: Pool;
  let authDriver: unknown;
  let endAuthSide: () => Promise<void>;
  let endCachedSide: () => Promise<void>;

  if (sharePool) {
    poolFresh = poolCached;
    authDriver = cached.authDatabase.driver;
    endAuthSide = cached.authDatabase.end;
    endCachedSide = async () => {};
  } else {
    const freshConfig: AppConfig = { ...config, databaseUrl: freshUrl };
    const fresh = createDatabaseHandles(freshConfig, { max: poolMaxFresh });
    poolFresh = fresh.pool;
    authDriver = fresh.authDatabase.driver;
    endAuthSide = fresh.authDatabase.end;
    endCachedSide = cached.authDatabase.end;
  }

  const dispose = async () => {
    await Promise.allSettled([poolCached.end(), endAuthSide(), ...(sharePool ? [] : [poolFresh.end(), endCachedSide()])]);
  };
  return assembleContainer(config, fileStorage, {
    trips: new SqlTripRepository(poolFresh),
    invites: new SqlTripInviteRepository(poolFresh),
    reservations: new SqlReservationRepository(poolFresh),
    preferences: new SqlUserPreferenceRepository(poolFresh),
    agent: new SqlAgentSessionRepository(poolFresh),
    proposals: config.databaseProvider === "postgres" ? new SqlProposalStore(poolFresh) : undefined,
    budget: config.databaseProvider === "postgres" ? new SqlBudgetStore(poolFresh, options?.tripChangePublisher) : undefined,
    authDatabase: authDriver, pool: poolCached, poolFresh, dispose,
  }, options);
}

