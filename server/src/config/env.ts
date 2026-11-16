export interface GoogleOAuthConfig {
    clientId: string;
    clientSecret: string;
}

export type EmailProviderName = "console" | "resend";

/** Transactional email (OTP, etc.). Defaults to `console` for local dev. */
export interface EmailConfig {
    provider: EmailProviderName;
    /** From address, e.g. `Raahi AI <noreply@example.test>`. */
    from: string;
    /** Required when provider is `resend`. */
    resendApiKey: string | undefined;
}

export interface AiConfig {
    fallback?: { apiKey: string; model: string; cooldownMs: number };
    provider: string;
    model: string;
    baseUrl: string | null;
    apiKey: string;
    /** Minimum model confidence in [0, 1] before a proactive toast is created. */
    proactiveThreshold: number;
    /** Upper bound on tool-call steps per chat generation. */
    maxToolSteps: number;
    /** Record full textual model inputs/outputs in the configured telemetry sink. */
    telemetryRecordContent: boolean;
}

export interface ObservabilityConfig {
    /** Sentry is disabled when the DSN is absent. */
    sentryDsn: string | undefined;
    environment: string;
    release: string | undefined;
}

export interface StreetViewConfig {
    provider: "mapillary";
    mapillaryAccessToken: string;
    timeoutMs: number;
}

export type GeoProviderName = "osm" | "google" | "geoapify";

export interface OsmGeoEndpoints {
    nominatimBaseUrl: string;
    overpassBaseUrl: string;
    osrmBaseUrl: string;
    /** Required identifying User-Agent for public OSM endpoints. */
    userAgent: string;
}

export interface GeoConfig {
    provider: GeoProviderName;
    osm: OsmGeoEndpoints;
    /** Required when provider is `google`. */
    googleMapsApiKey: string | undefined;
    geoapifyApiKey?: string;
    timeoutMs: number;
    cacheTtlMs: number;
}

/** Airbnb lodging scrape (openbnb-style in-process tools). */
export interface LodgingConfig {
    /** Bypass Airbnb robots.txt checks (testing only). */
    ignoreRobotsTxt: boolean;
    /** Skip Photon/Nominatim bbox; let Airbnb resolve the location string. */
    disableGeocoding: boolean;
    timeoutMs: number;
    /** Identifying User-Agent for Photon/Nominatim (not the Airbnb browser UA). */
    geocodeUserAgent: string;
}

export interface AppConfig {
    travelWeatherProvider?: "open-meteo";
    /** Server-only credential for single-use Scribe tokens. */
    elevenLabsApiKey?: string;
    elevenLabsVoiceEn?: string;
    elevenLabsVoiceHi?: string;
    betterAuthSecret: string;
    betterAuthUrl: string;
    trustedOrigins: string[];
    storage: StorageConfig;
    googleOAuth: GoogleOAuthConfig | null;
    email: EmailConfig;
    openWeatherMapApiKey: string | undefined;
    geo: GeoConfig;
    lodging: LodgingConfig;
    /** Trip agent model configuration. Null disables the agent entirely. */
    ai: AiConfig | null;
    observability: ObservabilityConfig;
    /** Street-view provider configuration. Null disables the capability. */
    streetView: StreetViewConfig | null;
    /** Unsplash access key for trip cover search. Undefined disables covers. */
    unsplashAccessKey: string | undefined;
}

interface StorageConfigBase {
    publicUrl: string;
}

export interface FileSystemStorageConfig extends StorageConfigBase {
    backend: "fs";
    root: string;
}

export interface S3StorageConfig extends StorageConfigBase {
    backend: "s3";
    root: string;
    bucket: string;
    region: string;
    endpoint: string;
    accessKeyId: string;
    secretAccessKey: string;
    forcePathStyle: boolean;
}

export type StorageConfig = FileSystemStorageConfig | S3StorageConfig;

export interface RawEnv {
    TRAVEL_WEATHER_PROVIDER?: string;
    ELEVENLABS_API_KEY?: string;
    ELEVENLABS_VOICE_ID_EN?: string;
    ELEVENLABS_VOICE_ID_HI?: string;
    BASE_URL?: string;
    BETTER_AUTH_SECRET?: string;
    TRUSTED_ORIGINS?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    GOOGLE_OAUTH_CLIENT_ID?: string;
    GOOGLE_OAUTH_CLIENT_SECRET?: string;
    GOOGLE_AUTH_CLIENT_ID?: string;
    GOOGLE_AUTH_CLIENT_SECRET?: string;
    GOOGLE_ID?: string;
    GOOGLE_SECRET?: string;
    /** Transactional email: `console` (default) | `resend`. */
    EMAIL_PROVIDER?: string;
    /** From address for outbound mail. Required for `resend`. */
    EMAIL_FROM?: string;
    /** Resend API key. Required when EMAIL_PROVIDER=resend. */
    RESEND_API_KEY?: string;
    STORAGE_BACKEND?: string;
    STORAGE_ROOT?: string;
    STORAGE_PUBLIC_URL?: string;
    S3_BUCKET?: string;
    S3_REGION?: string;
    S3_ENDPOINT?: string;
    S3_ACCESS_KEY_ID?: string;
    S3_SECRET_ACCESS_KEY?: string;
    S3_FORCE_PATH_STYLE?: string;
    OPENWEATHERMAP_API_KEY?: string;
    GEO_PROVIDER?: string;
    GEOAPIFY_API_KEY?: string;
    GEO_OSM_NOMINATIM_URL?: string;
    GEO_OSM_OVERPASS_URL?: string;
    GEO_OSM_OSRM_URL?: string;
    GEO_OSM_USER_AGENT?: string;
    GEO_TIMEOUT_MS?: string;
    GEO_CACHE_TTL_MS?: string;
    GOOGLE_MAPS_API_KEY?: string;
    OPENROUTER_API_KEY?: string;
    AI_FALLBACK_MODEL?: string;
    AI_FALLBACK_COOLDOWN_SECONDS?: string;
    AI_PROVIDER?: string;
    AI_MODEL?: string;
    AI_BASE_URL?: string;
    AI_API_KEY?: string;
    AI_PROACTIVE_THRESHOLD?: string;
    AI_MAX_TOOL_STEPS?: string;
    AI_TELEMETRY_RECORD_CONTENT?: string;
    SENTRY_DSN?: string;
    SENTRY_ENVIRONMENT?: string;
    SENTRY_RELEASE?: string;
    STREET_VIEW_PROVIDER?: string;
    MAPILLARY_ACCESS_TOKEN?: string;
    STREET_VIEW_TIMEOUT_MS?: string;
    LODGING_IGNORE_ROBOTS_TXT?: string;
    LODGING_DISABLE_GEOCODING?: string;
    LODGING_TIMEOUT_MS?: string;
    LODGING_GEOCODE_USER_AGENT?: string;
    UNSPLASH_ACCESS_KEY?: string;
}

/** Validate service configuration independently of the database connection. */
export function loadConfig(env: RawEnv): AppConfig {
    if (env.TRAVEL_WEATHER_PROVIDER && env.TRAVEL_WEATHER_PROVIDER !== "open-meteo") throw new Error("TRAVEL_WEATHER_PROVIDER must be empty or open-meteo");
    const betterAuthSecret = env.BETTER_AUTH_SECRET;
    if (!betterAuthSecret || betterAuthSecret.length < 32) {
        throw new Error(
            "BETTER_AUTH_SECRET must be set and at least 32 characters",
        );
    }

    const baseUrl = requireEnv(env.BASE_URL, "BASE_URL");
    const publicUrl =
        env.STORAGE_PUBLIC_URL?.trim() ||
        `${baseUrl.replace(/\/$/, "")}/api/uploads`;

    const googleClientId =
        env.GOOGLE_CLIENT_ID?.trim() ||
        env.GOOGLE_OAUTH_CLIENT_ID?.trim() ||
        env.GOOGLE_AUTH_CLIENT_ID?.trim() ||
        env.GOOGLE_ID?.trim() ||
        process.env.GOOGLE_CLIENT_ID?.trim() ||
        process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() ||
        process.env.GOOGLE_AUTH_CLIENT_ID?.trim() ||
        process.env.GOOGLE_ID?.trim();

    const googleClientSecret =
        env.GOOGLE_CLIENT_SECRET?.trim() ||
        env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() ||
        env.GOOGLE_AUTH_CLIENT_SECRET?.trim() ||
        env.GOOGLE_SECRET?.trim() ||
        process.env.GOOGLE_CLIENT_SECRET?.trim() ||
        process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() ||
        process.env.GOOGLE_AUTH_CLIENT_SECRET?.trim() ||
        process.env.GOOGLE_SECRET?.trim();

    return {
        travelWeatherProvider: env.TRAVEL_WEATHER_PROVIDER === "open-meteo" ? "open-meteo" : undefined,
        elevenLabsApiKey: env.ELEVENLABS_API_KEY?.trim() || undefined,
        elevenLabsVoiceEn: env.ELEVENLABS_VOICE_ID_EN?.trim() || undefined,
        elevenLabsVoiceHi: env.ELEVENLABS_VOICE_ID_HI?.trim() || undefined,
        betterAuthSecret,
        betterAuthUrl: baseUrl,
        trustedOrigins: (env.TRUSTED_ORIGINS ?? `${baseUrl},opentrip://`)
            .split(",")
            .map((origin) => origin.trim())
            .filter(Boolean),
        storage: loadStorageConfig(env, publicUrl),
        googleOAuth:
            googleClientId && googleClientSecret
                ? { clientId: googleClientId, clientSecret: googleClientSecret }
                : null,
        email: parseEmailConfig(env),
        openWeatherMapApiKey:
          env.OPENWEATHERMAP_API_KEY?.trim(),
        geo: parseGeoConfig(env),
        lodging: parseLodgingConfig(env),
        ai: parseAiConfig(env),
        observability: {
            sentryDsn: env.SENTRY_DSN?.trim() || undefined,
            environment: env.SENTRY_ENVIRONMENT?.trim() || "development",
            release: env.SENTRY_RELEASE?.trim() || undefined,
        },
        streetView: parseStreetViewConfig(env),
        unsplashAccessKey: env.UNSPLASH_ACCESS_KEY?.trim() || undefined,
    };
}

const DEFAULT_NOMINATIM_URL = "https://nominatim.openstreetmap.org";
const DEFAULT_OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const DEFAULT_OSRM_URL = "https://router.project-osrm.org";
const DEFAULT_GEO_TIMEOUT_MS = 12_000;
const DEFAULT_GEO_CACHE_TTL_MS = 30 * 60 * 1000;

/** Geo provider selection. Defaults to OSM; Google requires an API key. */
function parseGeoConfig(env: RawEnv): GeoConfig {
    const providerRaw = env.GEO_PROVIDER?.trim().toLowerCase() || "osm";
    if (providerRaw !== "osm" && providerRaw !== "google" && providerRaw !== "geoapify") {
        throw new Error('GEO_PROVIDER must be "osm", "google", or "geoapify"');
    }
    const provider = providerRaw as GeoProviderName;
    const geoapifyApiKey = env.GEOAPIFY_API_KEY?.trim() || undefined;
    if (provider === "geoapify" && !geoapifyApiKey) throw new Error("GEOAPIFY_API_KEY is required when GEO_PROVIDER=geoapify");
    const googleMapsApiKey = env.GOOGLE_MAPS_API_KEY?.trim() || undefined;
    if (provider === "google" && !googleMapsApiKey) {
        throw new Error(
            "GOOGLE_MAPS_API_KEY is required when GEO_PROVIDER=google",
        );
    }

    const userAgent =
        env.GEO_OSM_USER_AGENT?.trim() ||
        "RaahiAI/0.1 (geo-agent)";

    return {
        provider,
        osm: {
            nominatimBaseUrl:
                env.GEO_OSM_NOMINATIM_URL?.trim() || DEFAULT_NOMINATIM_URL,
            overpassBaseUrl:
                env.GEO_OSM_OVERPASS_URL?.trim() || DEFAULT_OVERPASS_URL,
            osrmBaseUrl: env.GEO_OSM_OSRM_URL?.trim() || DEFAULT_OSRM_URL,
            userAgent,
        },
        googleMapsApiKey,
        geoapifyApiKey,
        timeoutMs: parseNumber(
            env.GEO_TIMEOUT_MS,
            "GEO_TIMEOUT_MS",
            DEFAULT_GEO_TIMEOUT_MS,
        ),
        cacheTtlMs: parseNumber(
            env.GEO_CACHE_TTL_MS,
            "GEO_CACHE_TTL_MS",
            DEFAULT_GEO_CACHE_TTL_MS,
        ),
    };
}

const EMAIL_PROVIDERS: EmailProviderName[] = ["console", "resend"];
const DEFAULT_EMAIL_FROM = "Raahi AI <noreply@localhost>";

/** Email provider selection. Defaults to console logging for local/dev. */
function parseEmailConfig(env: RawEnv): EmailConfig {
    const providerRaw = env.EMAIL_PROVIDER?.trim().toLowerCase() || "console";
    if (!EMAIL_PROVIDERS.includes(providerRaw as EmailProviderName)) {
        throw new Error(
            `EMAIL_PROVIDER must be one of ${EMAIL_PROVIDERS.join(", ")}`,
        );
    }
    const provider = providerRaw as EmailProviderName;
    const from = env.EMAIL_FROM?.trim() || DEFAULT_EMAIL_FROM;
    const resendApiKey = env.RESEND_API_KEY?.trim() || undefined;

    if (provider === "resend") {
        if (!env.EMAIL_FROM?.trim()) {
            throw new Error("EMAIL_FROM is required when EMAIL_PROVIDER=resend");
        }
        if (!resendApiKey) {
            throw new Error(
                "RESEND_API_KEY is required when EMAIL_PROVIDER=resend",
            );
        }
    }

    return { provider, from, resendApiKey };
}

const DEFAULT_LODGING_TIMEOUT_MS = 30_000;
const DEFAULT_LODGING_GEOCODE_UA =
    "RaahiAI/0.1 (lodging-geocode)";

/** Airbnb lodging scrape options. Always available; no API key required. */
function parseLodgingConfig(env: RawEnv): LodgingConfig {
    return {
        ignoreRobotsTxt: parseBooleanFlag(env.LODGING_IGNORE_ROBOTS_TXT),
        disableGeocoding: parseBooleanFlag(env.LODGING_DISABLE_GEOCODING),
        timeoutMs: parseNumber(
            env.LODGING_TIMEOUT_MS,
            "LODGING_TIMEOUT_MS",
            DEFAULT_LODGING_TIMEOUT_MS,
        ),
        geocodeUserAgent:
            env.LODGING_GEOCODE_USER_AGENT?.trim() || DEFAULT_LODGING_GEOCODE_UA,
    };
}

function parseBooleanFlag(value: string | undefined): boolean {
    const trimmed = value?.trim().toLowerCase();
    return trimmed === "true" || trimmed === "1" || trimmed === "yes";
}

/** Agent config. Requires AI_MODEL and AI_API_KEY together; absence of either
 * disables the trip agent rather than failing startup. */
function parseAiConfig(env: RawEnv): AiConfig | null {
    const model = env.AI_MODEL?.trim();
    const apiKey = env.AI_API_KEY?.trim();
    if (!model || !apiKey) return null;

    const provider = env.AI_PROVIDER?.trim() || "openai";
    const baseUrlRaw = env.AI_BASE_URL?.trim() || null;
    // MiniMax: default to Anthropic-compatible `…/anthropic/v1` so
    // `@ai-sdk/anthropic` hits `/v1/messages` (thinking → reasoning parts).
    // Matches vercel-minimax-ai-provider; see ai-sdk.dev community MiniMax docs.
    const baseUrl =
        baseUrlRaw ??
        (provider.toLowerCase() === "minimax"
            ? "https://api.minimaxi.com/anthropic/v1"
            : null);

    const fallbackKey = env.OPENROUTER_API_KEY?.trim();
    const fallbackModel = env.AI_FALLBACK_MODEL?.trim() || "openrouter/free";
    const cooldownSeconds = parseNumber(env.AI_FALLBACK_COOLDOWN_SECONDS, "AI_FALLBACK_COOLDOWN_SECONDS", 60);
    if (fallbackKey && fallbackModel !== "openrouter/free" && !fallbackModel.endsWith(":free")) {
        throw new Error("AI_FALLBACK_MODEL must be openrouter/free or a :free model");
    }
    if (fallbackKey && (!Number.isFinite(cooldownSeconds) || cooldownSeconds < 1 || cooldownSeconds > 86400)) {
        throw new Error("AI_FALLBACK_COOLDOWN_SECONDS must be between 1 and 86400");
    }
    if (fallbackKey && (!baseUrl || provider.toLowerCase() === "minimax")) {
        throw new Error("OpenRouter fallback requires an OpenAI-compatible AI_BASE_URL");
    }
    return {
        provider,
        model,
        baseUrl,
        apiKey,
        ...(fallbackKey ? { fallback: { apiKey: fallbackKey, model: fallbackModel, cooldownMs: cooldownSeconds * 1000 } } : {}),
        proactiveThreshold: parseNumber(
            env.AI_PROACTIVE_THRESHOLD,
            "AI_PROACTIVE_THRESHOLD",
            0.7,
        ),
        maxToolSteps: parseNumber(env.AI_MAX_TOOL_STEPS, "AI_MAX_TOOL_STEPS", 16),
        telemetryRecordContent: parseBooleanFlag(
            env.AI_TELEMETRY_RECORD_CONTENT,
        ),
    };
}

function parseStreetViewConfig(env: RawEnv): StreetViewConfig | null {
    const provider = env.STREET_VIEW_PROVIDER?.trim().toLowerCase();
    if (!provider) return null;
    if (provider !== "mapillary") {
        throw new Error('STREET_VIEW_PROVIDER must be "mapillary"');
    }
    const mapillaryAccessToken = requireEnv(
        env.MAPILLARY_ACCESS_TOKEN,
        "MAPILLARY_ACCESS_TOKEN",
    );
    return {
        provider,
        mapillaryAccessToken,
        timeoutMs: parseNumber(
            env.STREET_VIEW_TIMEOUT_MS,
            "STREET_VIEW_TIMEOUT_MS",
            12_000,
        ),
    };
}

function parseNumber(
    value: string | undefined,
    name: string,
    fallback: number,
): number {
    const trimmed = value?.trim();
    if (!trimmed) return fallback;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) throw new Error(`${name} must be a number`);
    return parsed;
}

function loadStorageConfig(env: RawEnv, publicUrl: string): StorageConfig {
    const backend = requireEnv(env.STORAGE_BACKEND, "STORAGE_BACKEND");
    if (backend === "fs") {
        return {
            backend,
            root: requireEnv(env.STORAGE_ROOT, "STORAGE_ROOT"),
            publicUrl,
        };
    }
    if (backend === "s3") {
        return {
            backend,
            root: env.STORAGE_ROOT?.trim().replace(/^\/+|\/+$/g, "") ?? "",
            publicUrl,
            bucket: requireEnv(env.S3_BUCKET, "S3_BUCKET"),
            region: requireEnv(env.S3_REGION, "S3_REGION"),
            endpoint: requireEnv(env.S3_ENDPOINT, "S3_ENDPOINT"),
            accessKeyId: requireEnv(env.S3_ACCESS_KEY_ID, "S3_ACCESS_KEY_ID"),
            secretAccessKey: requireEnv(
                env.S3_SECRET_ACCESS_KEY,
                "S3_SECRET_ACCESS_KEY",
            ),
            forcePathStyle: parseBoolean(
                env.S3_FORCE_PATH_STYLE,
                "S3_FORCE_PATH_STYLE",
            ),
        };
    }
    throw new Error('STORAGE_BACKEND must be "fs" or "s3"');
}

function requireEnv(value: string | undefined, name: string): string {
    const trimmed = value?.trim();
    if (!trimmed) throw new Error(`${name} is required`);
    return trimmed;
}

function parseBoolean(value: string | undefined, name: string): boolean {
    if (value === undefined || value.trim() === "") return false;
    if (value === "true") return true;
    if (value === "false") return false;
    throw new Error(`${name} must be either "true" or "false"`);
}

/** Validate Mongo configuration before starting the Node API. */
export function loadNodeConfig(env: RawEnv & { MONGO_URI?: string }): AppConfig & { mongoUri: string } {
    const mongoUri = env.MONGO_URI?.trim();
    if (!mongoUri) throw new Error("MONGO_URI is required for the Node API");
    return { ...loadConfig(env), mongoUri };
}
