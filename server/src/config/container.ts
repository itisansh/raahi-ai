import { HistoryService, type HistoryStore } from "../services/history/history-service";
import { FinanceService, type FinanceStore } from "../services/finance/finance-service";
import type { AuthRateLimitStorage } from "../integrations/auth/auth-rate-limit";
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
import {
  createAuth,
  type Auth,
} from "../integrations/auth/auth";
import { createSampleTripTemplateLoader } from "../db/sample-trip-template";
import { CachedWeatherClient } from "../integrations/weather/cached-weather-client";
import { OpenWeatherMapClient } from "../integrations/weather/openweather-client";
import { CachedFxClient } from "../integrations/fx/cached-fx-client";
import { FrankfurterClient } from "../integrations/fx/frankfurter-client";
import { createGeoProvider } from "../integrations/geo/create-geo-provider";
import { AirbnbLodgingProvider } from "../integrations/lodging/airbnb-provider";
import { AiSdkAgentModel } from "../integrations/ai/agent-model.ai-sdk";
import { UnsplashCoverProvider } from "../integrations/cover/unsplash-cover-provider";
import type { AppConfig } from "./env";
import type { TripChangePublisher } from "../services/rules/realtime";
import { MapillaryStreetViewProvider } from "../integrations/street-view/mapillary/mapillary-provider";
import { MemoryStreetViewCache } from "../integrations/street-view/memory-street-view-cache";
import type { StreetViewCache } from "../services/street-view";
import { observability } from "../integrations/observability";
import { VoiceTokenService } from "../services/voice/voice-token-service";
import { MedicalService } from "../services/medical/medical-service";
import { IndiaTravelService } from "../services/travel/india-travel-service";
import { OpenMeteoTravelProvider } from "../integrations/travel/open-meteo-provider";
import { BudgetService } from "../services/budget/budget-service";
import { AiSdkBudgetModel } from "../integrations/ai/budget-model.ai-sdk";
import { VoiceExpenseService } from "../services/expenses/voice-expense";
import { AiSdkExpenseModel } from "../integrations/ai/expense-model.ai-sdk";
import { SpokenSummaryService } from "../services/voice/spoken-summary";
import { ElevenLabsSpeechProvider } from "../integrations/voice/elevenlabs-speech-provider";
import { ElevenLabsTokenProvider } from "../integrations/voice/elevenlabs-token-provider";
import { createVoiceTokenLimiter } from "../integrations/voice/voice-token-limiter";
import { PlanningService } from "../services/planning/planning-service";
import { AiSdkPlanningModel } from "../integrations/ai/planning-model.ai-sdk";
import { ProposalApprovalService } from "../services/planning/approval-service";

import type { TripRepository } from "../services/rules/trip";
import type { TripInviteRepository } from "../services/rules/invite";
import type { ReservationRepository } from "../services/rules/reservation";
import type { AgentSessionRepository } from "../services/rules/agent";
import type { UserPreferenceRepository } from "../services/rules/preferences/ports";
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
  finance?: FinanceStore;
  history?: HistoryStore;
  authDatabase: unknown;
  stringAuthIds?: boolean;
  dispose: () => Promise<void>;
}

export interface CreateContainerOptions {
  /** Shared runtime cache for provider metadata and preview bytes. */
  streetViewCache?: StreetViewCache;
  /** Publisher supplied by the selected runtime. */
  tripChangePublisher?: TripChangePublisher;
  /** Atomic rate-limit storage supplied by the selected runtime. */
  authRateLimitStorage?: AuthRateLimitStorage;
  /** Trusted client-IP headers used to partition authentication limits. */
  authIpAddressHeaders?: string[];
}

export interface Container {
  historyService?: HistoryService;
  financeService?: FinanceService;
  medicalService?: MedicalService;
  indiaTravelService?: IndiaTravelService;
  budgetService?: BudgetService;
  voiceExpenseService?: VoiceExpenseService;
  spokenSummaryService?: SpokenSummaryService;
  proposalApprovalService: ProposalApprovalService | null;
  planningService: PlanningService;
  voiceTokenService: VoiceTokenService;
  config: AppConfig;
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
  /** Register work that must finish before the database connection closes. */
  trackDeferred: (task: Promise<unknown>) => void;
  /** Drain deferred tasks, then close persistence during graceful shutdown. */
  disposeAfterDeferred: () => Promise<void>;
  /** Close persistence immediately. */
  dispose: () => Promise<void>;
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
    historyService: persistence.history ? new HistoryService(persistence.history) : undefined,
    financeService: persistence.finance ? new FinanceService(persistence.finance) : undefined,
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
