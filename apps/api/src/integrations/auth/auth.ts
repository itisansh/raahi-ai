import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import {
  bearer,
  emailOTP,
  oneTimeToken,
  twoFactor,
} from "better-auth/plugins";
import { provisionSampleTripForUser } from "../../services/user/provision-sample-trip";
import {
  normalizeDisplayName,
  UserProfileValidationError,
  type UserProfileProjectionService,
} from "../../services/user/profile-projection-service";
import {
  generateUserAvatar,
  resolveInitialAvatar,
} from "../../services/user/user-initializer";
import type { Trip, TripRepository } from "../../domain/trip";
import { createEmailSender } from "../email/create-email-sender";
import { buildLinkEmail } from "../email/link-email";
import { buildOtpEmail } from "../email/otp-email";
import {
  localeFromAuthContext,
  localeFromRequest,
} from "../email/email-locale";
import type { AppConfig } from "../../config/env";
import type { AuthRateLimitStorage } from "./auth-rate-limit";
import { mapGoogleProfileToDto } from "./oauth-profile-mapper";

export interface CreateAuthOptions {
  /** Preserve imported string IDs with the Mongo adapter. */
  stringIds?: boolean;
  /** When set, each new user receives a personal copy of the sample trip. */
  tripRepository?: TripRepository;
  loadSampleTripTemplate?: () => Promise<Trip>;
  /** Atomic storage supplied by the runtime. */
  rateLimitStorage?: AuthRateLimitStorage;
  /** Synchronizes Better Auth profile changes into trip member projections. */
  profileProjection?: UserProfileProjectionService;
  /** Trusted client-IP headers for the active runtime. */
  ipAddressHeaders?: string[];
}

/** OTP lifetime in seconds (Better Auth emailOTP default is 300). */
const OTP_EXPIRES_IN_SECONDS = 300;


/** Build Better Auth over the selected database adapter. Email + password (OTP-verified
 * sign-up) plus optional Google OAuth, change-email / password reset mail,
 * and TOTP two-factor authentication.
 *
 * Email registration requires OTP verification before a session is issued
 * (`requireEmailVerification` + `emailOTP` with
 * `overrideDefaultEmailVerification`). The outbound mail adapter is selected
 * via `EMAIL_PROVIDER` (`console` | `resend`).
 *
 * `defaultCurrency` is a user preference surfaced on every session; the planner
 * uses it as the default currency when composing a stop cost.
 *
 * OAuth sign-ups keep the provider's profile picture. Users without one get a
 * deterministic vercel-style gradient avatar (github.com/vercel/avatar) baked
 * into a static data URI and stored on `user.image`, so the UI always renders a
 * fixed image. The shared {@link OAuthProfileDto} keeps the mapping
 * provider-agnostic.
 *
 * After user creation, a personal clone of the sample Indian trip is provisioned
 * when trip dependencies are wired (see {@link CreateAuthOptions}). */
export function createAuth(
  config: AppConfig,
  /** Mongo adapter on Node; driver pools only in legacy SQL tooling. */
  database: unknown,
  options: CreateAuthOptions = {},
) {
    const { tripRepository, loadSampleTripTemplate } = options;
    const emailSender = createEmailSender(config.email);

    return betterAuth({
        // Better Auth auto-detects pg vs mysql2 pools via Kysely dialects.
        database: database as never,
        appName: "Raahi AI",
        secret: config.betterAuthSecret,
        baseURL: config.betterAuthUrl,
        basePath: "/api/auth",
        trustedOrigins: config.trustedOrigins,
        rateLimit: options.rateLimitStorage
            ? { customStorage: options.rateLimitStorage }
            : undefined,
        advanced: {
            ...(options.stringIds ? { database: { generateId: () => crypto.randomUUID() } } : {}),
            ...(options.ipAddressHeaders ? { ipAddress: { ipAddressHeaders: options.ipAddressHeaders } } : {}),
        },
        emailAndPassword: {
            enabled: true,
            requireEmailVerification: true,
            sendResetPassword: async ({ user, url }, request) => {
                const message = buildLinkEmail({
                    to: user.email,
                    type: "reset-password",
                    url,
                    locale: localeFromRequest(request),
                });
                try {
                    await emailSender.send(message);
                } catch (err) {
                    console.error("Failed to send password reset email:", err);
                    throw err;
                }
            },
        },
        emailVerification: {
            // With emailOTP.overrideDefaultEmailVerification, this sends an OTP
            // instead of a magic link. sendOnSignIn covers unverified password
            // sign-in attempts so the client can show the OTP step.
            sendOnSignUp: true,
            sendOnSignIn: true,
            autoSignInAfterVerification: true,
        },
        socialProviders:
            config.googleOAuth
            ? {
                  ...(config.googleOAuth
                      ? {
                            google: {
                                clientId: config.googleOAuth.clientId,
                                clientSecret: config.googleOAuth.clientSecret,
                                mapProfileToUser: (profile) => {
                                    const dto = mapGoogleProfileToDto(profile);
                                    const seed =
                                        dto.email ??
                                        dto.name ??
                                        crypto.randomUUID();
                                    return {
                                        name: dto.name ?? undefined,
                                        email: dto.email ?? undefined,
                                        image: resolveInitialAvatar(dto, seed),
                                    };
                                },
                            },
                        }
                      : {}),
              }
            : undefined,
        user: {
            changeEmail: {
                enabled: true,
                sendChangeEmailConfirmation: async ({ user, newEmail, url }, request) => {
                    const message = buildLinkEmail({
                        to: user.email,
                        type: "change-email-confirmation",
                        url,
                        detail: newEmail,
                        locale: localeFromRequest(request),
                    });
                    try {
                        await emailSender.send(message);
                    } catch (err) {
                        console.error(
                            "Failed to send change-email confirmation:",
                            err,
                        );
                        throw err;
                    }
                },
            },
            additionalFields: {
                defaultCurrency: {
                    type: "string",
                    required: false,
                    defaultValue: "INR",
                    input: true,
                },
            },
        },
        databaseHooks: {
            user: {
                create: {
                    before: async (user) => {
                        if (user.image) return;
                        const seed = user.id ?? user.email ?? crypto.randomUUID();
                        return { data: { ...user, image: generateUserAvatar(seed) } };
                    },
                    after: async (user) => {
                        if (!tripRepository || !loadSampleTripTemplate) return;
                        await provisionSampleTripForUser(
                            tripRepository,
                            {
                                id: user.id,
                                name: user.name,
                                image: user.image ?? null,
                            },
                            loadSampleTripTemplate,
                        );
                    },
                },
                update: {
                    before: async (data) => {
                        if (data.name === undefined) return;
                        try {
                            return {
                                data: {
                                    ...data,
                                    name: normalizeDisplayName(data.name),
                                },
                            };
                        } catch (error) {
                            if (!(error instanceof UserProfileValidationError)) {
                                throw error;
                            }
                            throw new APIError("BAD_REQUEST", {
                                code: "INVALID_DISPLAY_NAME",
                                message: error.message,
                            });
                        }
                    },
                    after: async (user, ctx) => {
                        if (!options.profileProjection) return;
                        const fields = profileFieldsFromBody(ctx?.body);
                        if (!fields) return;
                        await options.profileProjection.synchronize(user.id, {
                            ...(fields.name ? { name: user.name } : {}),
                            ...(fields.image ? { image: user.image ?? null } : {}),
                        });
                    },
                },
            },
        },
        plugins: [
            bearer(),
            oneTimeToken({
                expiresIn: 3,
                disableClientRequest: true,
                storeToken: "hashed",
            }),
            emailOTP({
                otpLength: 6,
                expiresIn: OTP_EXPIRES_IN_SECONDS,
                storeOTP: "hashed",
                overrideDefaultEmailVerification: true,
                changeEmail: {
                    enabled: true,
                    verifyCurrentEmail: true,
                },
                async sendVerificationOTP({ email, otp, type }, ctx) {
                    const message = buildOtpEmail({
                        to: email,
                        otp,
                        type,
                        expiresInSeconds: OTP_EXPIRES_IN_SECONDS,
                        locale: localeFromAuthContext(ctx),
                    });
                    // Await so Workers waitUntil / Node keep the request alive
                    // until the provider accepts the message. Better Auth already
                    // runs this via runInBackgroundOrAwait when overriding
                    // default verification.
                    try {
                        await emailSender.send(message);
                    } catch (err) {
                        console.error("Failed to send OTP email:", err);
                        throw err;
                    }
                },
            }),
            twoFactor({
                issuer: "Raahi AI",
                // Google-only accounts can enroll after setting a password, or
                // without one when they have no credential account yet.
                allowPasswordless: true,
            }),
        ],
    });
}

export type Auth = ReturnType<typeof createAuth>;

function profileFieldsFromBody(
  body: unknown,
): { name: boolean; image: boolean } | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  const name = Object.prototype.hasOwnProperty.call(record, "name");
  const image = Object.prototype.hasOwnProperty.call(record, "image");
  return name || image ? { name, image } : null;
}
