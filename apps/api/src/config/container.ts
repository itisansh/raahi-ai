import {
  TripService,
  TripInviteService,
  PreferenceService,
  WeatherService,
  FxService,
  GeoService,
  LodgingService,
  AgentService,
  StreetViewGroundingService,
  TripMediaService,
  StreetViewService,
  ReservationService,
  UserProfileProjectionService,
} from "../services";
import { AvatarService } from "../services/avatar";
import type { FileStorage } from "../services/storage";
import { createDatabaseHandles, type Pool } from "../repositories/pool";
import { SqlTripRepository } from "../repositories/trip-repository.db";
import { SqlTripInviteRepository } from "../repositories/invite-repository.db";
import { SqlUserPreferenceRepository } from "../repositories/user-preference-repository.db";
import { SqlAgentSessionRepository } from "../repositories/agent-repository.db";
import { SqlReservationRepository } from "../repositories/reservation-repository.db";
import {
  createAuth,
  type Auth,
  type AuthRateLimitStorage,
} from "../integrations/auth";
import { createSampleTripTemplateLoader } from "../repositories/sample-trip-template";
import { CachedWeatherClient } from "../integrations/weather/cached-weather-client";
import { OpenWeatherMapClient } from "../integrations/weather/openweather-client";
import { CachedFxClient } from "../integrations/fx/cached-fx-client";
import { FrankfurterClient } from "../integrations/fx/frankfurter-client";
import { createGeoProvider } from "../integrations/geo/create-geo-provider";
import { AirbnbLodgingProvider } from "../integrations/lodging/airbnb-provider";
import { AiSdkAgentModel } from "../integrations/ai/agent-model.ai-sdk";
import { UnsplashCoverProvider } from "../integrations/cover/unsplash-cover-provider";
import type { AppConfig } from "./env";
import type { TripChangePublisher } from "../domain/realtime";
import { MapillaryStreetViewProvider } from "../integrations/street-view/mapillary/mapillary-provider";
import { MemoryStreetViewCache } from "../integrations/street-view/memory-street-view-cache";
import type { StreetViewCache } from "../services/street-view";
import { observability } from "../integrations/observability";
import { VoiceTokenService } from "../services/voice/voice-token-service";
import { MedicalService } from "../services/medical/medical-service";
import { IndiaTravelService } from "../services/travel/india-travel-service";
import { OpenMeteoTravelProvider } from "../integrations/travel/open-meteo-provider";
import { BudgetService } from "../services/budget/budget-service";
import { SqlBudgetStore } from "../repositories/budget-store.db";
import { AiSdkBudgetModel } from "../integrations/ai/budget-model.ai-sdk";
import { VoiceExpenseService } from "../services/expenses/voice-expense";
import { AiSdkExpenseModel } from "../integrations/ai/expense-model.ai-sdk";
import { SpokenSummaryService } from "../services/voice/spoken-summary";
import { ElevenLabsSpeechProvider } from "../integrations/voice/elevenlabs-speech-provider";
import { ElevenLabsTokenProvider } from "../integrations/voice/elevenlabs-token-provider";
import { createVoiceTokenLimiter } from "../integrations/voice/voice-token-limiter";
import { PlanningService } from "../services/planning/planning-service";
import { AiSdkPlanningModel } from "../integrations/ai/planning-model.ai-sdk";
import { SqlProposalStore } from "../repositories/proposal-store.db";
import { ProposalApprovalService } from "../services/planning/approval-service";

import type { TripRepository } from "../domain/trip";
import type { TripInviteRepository } from "../domain/invite";
import type { ReservationRepository } from "../domain/reservation";
import type { AgentSessionRepository } from "../domain/agent";
import type { UserPreferenceRepository } from "../domain/preferences/ports";
import type { MemberProfileProjection } from "../services/user/profile-projection-service";
import type { ProposalStore, StoredProposal } from "../services/planning/proposal-store";
import type { BudgetStore } from "../services/budget/budget-service";

export interface Persistence {
  trips: TripRepository & MemberProfileProjection;
  invites: TripInviteRepository;
  reservations: ReservationRepository;
  preferences: UserPreferenceRepository;
  agent: AgentSessionRepository;
  proposals?: ProposalStore & { read(id: string, ownerId: string): Promise<StoredProposal | null> };
  budget?: BudgetStore;
  authDatabase: unknown;
  stringAuthIds?: boolean;
  pool?: Pool;
  poolFresh?: Pool;
  dispose: () => Promise<void>;
}

export interface CreateContainerOptions {
  /** Shared runtime cache for provider metadata and preview bytes. */
  streetViewCache?: StreetViewCache;
  /**
   * Max connections for the cache-enabled pool. This pool is reserved for
   * explicitly stale-tolerant read models.
   */
  poolMax?: number;
  /**
   * Max connections for the cache-disabled consistency pool.
   * Ignored when `freshDatabaseUrl` is omitted or equals `config.databaseUrl`
   * (single shared pool).
   */
  poolMaxFresh?: number;
  /**
   * Connection string for business state, authorization, and commands that
   * must not hit Hyperdrive query cache. When omitted or identical to
   * `config.databaseUrl`, a single shared pool is used (Node/direct DB).
   */
  freshDatabaseUrl?: string;
  /** Cloudflare Durable Object publisher. Omitted outside the Worker runtime. */
  tripChangePublisher?: TripChangePublisher;
  /** Cloudflare-global Better Auth limiter. Omitted outside Workers. */
  authRateLimitStorage?: AuthRateLimitStorage;
  /** Trusted client-IP headers used to partition authentication limits. */
  authIpAddressHeaders?: string[];
}

export interface Container {
  medicalService?: MedicalService;
  indiaTravelService?: IndiaTravelService;
  budgetService?: BudgetService;
  voiceExpenseService?: VoiceExpenseService;
  spokenSummaryService?: SpokenSummaryService;
  proposalApprovalService: ProposalApprovalService | null;
  planningService: PlanningService;
  voiceTokenService: VoiceTokenService;
  config: AppConfig;
  /** Cache-enabled (or sole) SQL client for explicitly stale-tolerant reads. */
  pool?: Pool;
  /**
   * Cache-disabled SQL client for all consistency-critical repositories. Same
   * object as `pool` when no separate fresh URL is configured.
   */
  poolFresh?: Pool;
  auth: Auth;
  tripService: TripService;
  tripInviteService: TripInviteService;
  reservationService: ReservationService;
  preferenceService: PreferenceService;
  weatherService: WeatherService;
  fxService: FxService;
  geoService: GeoService;
  lodgingService: LodgingService;
  streetViewService: StreetViewService | null;
  fileStorage: FileStorage;
  avatarService: AvatarService;
  tripMediaService: TripMediaService;
  /** Null when AI is not configured; agent routes then respond 404. */
  agentService: AgentService | null;
  /**
   * Register a promise that must finish before pools are closed (Workers
   * `waitUntil` ambient agent work).
   */
  trackDeferred: (task: Promise<unknown>) => void;
  /**
   * Wait for tracked deferred tasks, then close SQL + auth driver pools.
   * Prefer this over `dispose` on Workers so ambient work is not racing
   * `pool.end()`.
   */
  disposeAfterDeferred: () => Promise<void>;
  /** Close SQL + auth driver pools immediately (Node shutdown / tests). */
  dispose: () => Promise<void>;
}

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

/** Shared service composition; database adapters are selected by the entry point. */
export function assembleContainer(config: AppConfig, fileStorage: FileStorage, persistence: Persistence, options?: CreateContainerOptions): Container {
  const tripRepository = persistence.trips;
  const profileProjection = new UserProfileProjectionService(
    tripRepository,
    options?.tripChangePublisher ?? null,
  );
  const auth = createAuth(config, persistence.authDatabase, {
    tripRepository,
    stringIds: persistence.stringAuthIds,
    profileProjection,
    loadSampleTripTemplate: createSampleTripTemplateLoader(tripRepository),
    rateLimitStorage: options?.authRateLimitStorage,
    ipAddressHeaders: options?.authIpAddressHeaders,
  });
  const coverImages = new UnsplashCoverProvider(config.unsplashAccessKey);
  const geoService = new GeoService(createGeoProvider(config.geo));
  const tripService = new TripService(
    tripRepository,
    coverImages,
    geoService,
    options?.tripChangePublisher ?? null,
  );
  const tripInviteService = new TripInviteService(
    persistence.invites,
    tripRepository,
    options?.tripChangePublisher ?? null,
  );
  const reservationService = new ReservationService(
    tripRepository,
    persistence.reservations,
    options?.tripChangePublisher ?? null,
  );
  const preferenceService = new PreferenceService(
    persistence.preferences,
  );
  const avatarService = new AvatarService(fileStorage);
  const tripMediaService = new TripMediaService(fileStorage, tripService);
  const openWeatherClient = new OpenWeatherMapClient(config.openWeatherMapApiKey);
  const cachedWeatherClient = new CachedWeatherClient(openWeatherClient);
  const weatherService = new WeatherService(cachedWeatherClient);
  const frankfurterClient = new FrankfurterClient();
  const cachedFxClient = new CachedFxClient(frankfurterClient);
  const fxService = new FxService(cachedFxClient);
  const lodgingService = new LodgingService(
    new AirbnbLodgingProvider(config.lodging),
  );
  const streetViewService = config.streetView
      ? new StreetViewService(
        new MapillaryStreetViewProvider(
          config.streetView.mapillaryAccessToken,
          config.streetView.timeoutMs,
        ),
        options?.streetViewCache ?? new MemoryStreetViewCache(),
        observability,
      )
    : null;
  const agentService = config.ai
    ? new AgentService(
        tripRepository,
        persistence.agent,
        new AiSdkAgentModel(
          config.ai,
          weatherService,
          geoService,
          lodgingService,
          fileStorage,
        ),
        new StreetViewGroundingService(
          geoService,
          streetViewService,
          observability,
        ),
        {
          proactiveThreshold: config.ai.proactiveThreshold,
        },
        options?.tripChangePublisher ?? null,
        observability,
      )
    : null;

  const deferred: Promise<unknown>[] = [];

  const disposePools = persistence.dispose;
  const proposalStore = persistence.proposals;
  const speechProvider = config.elevenLabsApiKey && config.elevenLabsVoiceEn && config.elevenLabsVoiceHi
    ? new ElevenLabsSpeechProvider(config.elevenLabsApiKey, { en: config.elevenLabsVoiceEn, hi: config.elevenLabsVoiceHi }) : null;
  return {
    config,
    medicalService: new MedicalService(async (id, actor) => {
      await tripService.assertReadable(id, actor);
      return (await tripRepository.findById(id))!.toSnapshot();
    }, geoService, config.geo.provider, createVoiceTokenLimiter(options?.authRateLimitStorage, Date.now, "medical-places")),
    indiaTravelService: new IndiaTravelService(async (id, actor) => {
      await tripService.assertReadable(id, actor);
      return (await tripRepository.findById(id))!.toSnapshot();
    }, geoService, config.geo.provider, config.travelWeatherProvider ? new OpenMeteoTravelProvider() : null, createVoiceTokenLimiter(options?.authRateLimitStorage, Date.now, "india-travel")),
    budgetService: persistence.budget ? new BudgetService(persistence.budget, config.ai ? new AiSdkBudgetModel(config.ai) : null, createVoiceTokenLimiter(options?.authRateLimitStorage, Date.now, "budget-replan")) : undefined,
    proposalApprovalService: proposalStore ? new ProposalApprovalService(proposalStore) : null,
    voiceExpenseService: new VoiceExpenseService(config.ai ? new AiSdkExpenseModel(config.ai) : null, (id, userId) => tripService.assertEditable(id, userId), createVoiceTokenLimiter(options?.authRateLimitStorage, Date.now, "expense-voice")),
    spokenSummaryService: proposalStore ? new SpokenSummaryService((id, ownerId) => proposalStore.read(id, ownerId), speechProvider, createVoiceTokenLimiter(options?.authRateLimitStorage, Date.now, "speech")) : undefined,
    planningService: new PlanningService(
      config.ai ? new AiSdkPlanningModel(config.ai) : null,
      geoService,
      config.geo.provider,
      (tripId, userId) => tripService.getPlanningContext(tripId, userId),
      createVoiceTokenLimiter(options?.authRateLimitStorage, Date.now, "planning-preview"),
      proposalStore,
    ),
    voiceTokenService: new VoiceTokenService(
      config.elevenLabsApiKey ? new ElevenLabsTokenProvider(config.elevenLabsApiKey) : null,
      createVoiceTokenLimiter(options?.authRateLimitStorage),
    ),
    pool: persistence.pool,
    poolFresh: persistence.poolFresh,
    auth,
    tripService,
    tripInviteService,
    reservationService,
    preferenceService,
    weatherService,
    fxService,
    geoService,
    lodgingService,
    streetViewService,
    fileStorage,
    avatarService,
    tripMediaService,
    agentService,
    trackDeferred: (task) => {
      deferred.push(task);
    },
    disposeAfterDeferred: async () => {
      if (deferred.length > 0) {
        await Promise.allSettled(deferred);
      }
      await disposePools();
    },
    dispose: disposePools,
  };
}
