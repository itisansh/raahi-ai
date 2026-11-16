import { describe, expect, it } from "vitest";
import { loadConfig, type RawEnv } from "../src/config/env";

const BASE_ENV: RawEnv = {
  BETTER_AUTH_SECRET: "a-secure-test-secret-with-32-characters",
  BASE_URL: "https://api.example.test",
};

describe("loadConfig storage", () => {
  it("trusts the native callback origin by default", () => {
    const config = loadConfig({
      ...BASE_ENV,
      STORAGE_BACKEND: "fs",
      STORAGE_ROOT: "/data/uploads",
    });

    expect(config.trustedOrigins).toEqual([
      "https://api.example.test",
      "opentrip://",
    ]);
  });

  it("requires an explicit storage backend", () => {
    expect(() => loadConfig(BASE_ENV)).toThrow("STORAGE_BACKEND is required");
  });

  it("loads filesystem storage from env", () => {
    const config = loadConfig({
      ...BASE_ENV,
      STORAGE_BACKEND: "fs",
      STORAGE_ROOT: "/data/uploads",
    });

    expect(config.storage).toEqual({
      backend: "fs",
      root: "/data/uploads",
      publicUrl: "https://api.example.test/api/uploads",
    });
  });

  it("loads S3-compatible storage from env", () => {
    const config = loadConfig({
      ...BASE_ENV,
      STORAGE_BACKEND: "s3",
      STORAGE_ROOT: "/avatars/",
      STORAGE_PUBLIC_URL: "https://cdn.example.test/files/",
      S3_BUCKET: "raahi",
      S3_REGION: "auto",
      S3_ENDPOINT: "https://storage.example.test",
      S3_ACCESS_KEY_ID: "access-key",
      S3_SECRET_ACCESS_KEY: "secret-key",
      S3_FORCE_PATH_STYLE: "true",
    });

    expect(config.storage).toMatchObject({
      backend: "s3",
      root: "avatars",
      publicUrl: "https://cdn.example.test/files/",
      bucket: "raahi",
      region: "auto",
      forcePathStyle: true,
    });
  });

  it("rejects unknown backends and invalid booleans", () => {
    expect(() => loadConfig({ ...BASE_ENV, STORAGE_BACKEND: "unknown" })).toThrow(
      'STORAGE_BACKEND must be "fs" or "s3"',
    );
    expect(() =>
      loadConfig({
        ...BASE_ENV,
        STORAGE_BACKEND: "s3",
        S3_BUCKET: "raahi",
        S3_REGION: "auto",
        S3_ENDPOINT: "https://example.test",
        S3_ACCESS_KEY_ID: "key",
        S3_SECRET_ACCESS_KEY: "secret",
        S3_FORCE_PATH_STYLE: "yes",
      }),
    ).toThrow('S3_FORCE_PATH_STYLE must be either "true" or "false"');
  });
});

describe("loadConfig email", () => {
  it("defaults to console provider", () => {
    const config = loadConfig({
      ...BASE_ENV,
      STORAGE_BACKEND: "fs",
      STORAGE_ROOT: "/data",
    });
    expect(config.email).toEqual({
      provider: "console",
      from: "Raahi AI <noreply@localhost>",
      resendApiKey: undefined,
    });
  });

  it("loads resend when key and from are set", () => {
    const config = loadConfig({
      ...BASE_ENV,
      STORAGE_BACKEND: "fs",
      STORAGE_ROOT: "/data",
      EMAIL_PROVIDER: "resend",
      EMAIL_FROM: "Raahi AI <noreply@example.test>",
      RESEND_API_KEY: "re_test",
    });
    expect(config.email).toEqual({
      provider: "resend",
      from: "Raahi AI <noreply@example.test>",
      resendApiKey: "re_test",
    });
  });

  it("rejects resend without API key or from", () => {
    expect(() =>
      loadConfig({
        ...BASE_ENV,
        STORAGE_BACKEND: "fs",
        STORAGE_ROOT: "/data",
        EMAIL_PROVIDER: "resend",
        EMAIL_FROM: "Raahi AI <noreply@example.test>",
      }),
    ).toThrow("RESEND_API_KEY is required when EMAIL_PROVIDER=resend");

    expect(() =>
      loadConfig({
        ...BASE_ENV,
        STORAGE_BACKEND: "fs",
        STORAGE_ROOT: "/data",
        EMAIL_PROVIDER: "resend",
        RESEND_API_KEY: "re_test",
      }),
    ).toThrow("EMAIL_FROM is required when EMAIL_PROVIDER=resend");
  });
});

describe("loadConfig street view", () => {
  it("keeps street view disabled unless a provider is selected", () => {
    const config = loadConfig({
      ...BASE_ENV,
      STORAGE_BACKEND: "fs",
      STORAGE_ROOT: "/data",
    });
    expect(config.streetView).toBeNull();
  });

  it("requires a Mapillary token", () => {
    const config = loadConfig({
      ...BASE_ENV,
      STORAGE_BACKEND: "fs",
      STORAGE_ROOT: "/data",
      STREET_VIEW_PROVIDER: "mapillary",
      MAPILLARY_ACCESS_TOKEN: "test-token",
      AI_MODEL: "vision-model",
      AI_API_KEY: "ai-key",
    });
    expect(config.streetView).toEqual({
      provider: "mapillary",
      mapillaryAccessToken: "test-token",
      timeoutMs: 12_000,
    });
    expect(() =>
      loadConfig({
        ...BASE_ENV,
        STORAGE_BACKEND: "fs",
        STORAGE_ROOT: "/data",
        STREET_VIEW_PROVIDER: "mapillary",
      }),
    ).toThrow("MAPILLARY_ACCESS_TOKEN is required");
  });
});

describe("loadConfig observability", () => {
  it("keeps Sentry optional and parses the AI content switch", () => {
    const disabled = loadConfig({
      ...BASE_ENV,
      STORAGE_BACKEND: "fs",
      STORAGE_ROOT: "/data",
    });
    expect(disabled.observability).toEqual({
      sentryDsn: undefined,
      environment: "development",
      release: undefined,
    });

    const enabled = loadConfig({
      ...BASE_ENV,
      STORAGE_BACKEND: "fs",
      STORAGE_ROOT: "/data",
      AI_MODEL: "test-model",
      AI_API_KEY: "test-key",
      AI_TELEMETRY_RECORD_CONTENT: "true",
      SENTRY_DSN: "https://public@example.ingest.sentry.io/1",
      SENTRY_ENVIRONMENT: "staging",
      SENTRY_RELEASE: "abc123",
    });
    expect(enabled.ai?.telemetryRecordContent).toBe(true);
    expect(enabled.observability).toEqual({
      sentryDsn: "https://public@example.ingest.sentry.io/1",
      environment: "staging",
      release: "abc123",
    });
  });
});
