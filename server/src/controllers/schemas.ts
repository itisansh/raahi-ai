import { z } from "zod";
import { MAX_AVATAR_BYTES } from "../services/avatar";
import { MAX_TRIP_MEDIA_BYTES } from "../services/media";
import { dayNumberParamSchema, expenseDraftSchema, moveStopBodySchema, updateStopChangesSchema } from "../services/trip/ops";

export const moveStopSchema = moveStopBodySchema;

export const updateStopSchema = updateStopChangesSchema;

export const expenseSchema = expenseDraftSchema;

export const dayNumberSchema = dayNumberParamSchema;

export const commentSchema = z.object({ text: z.string().min(1) });

export const reservationTypeSchema = z.enum([
  "flight",
  "accommodation",
  "restaurant",
  "rail",
  "ground_transport",
  "activity",
  "other",
]);

export const reservationStatusSchema = z.enum([
  "tentative",
  "confirmed",
  "cancelled",
  "completed",
]);

export const reservationDraftSchema = z.object({
  type: reservationTypeSchema,
  status: reservationStatusSchema.optional(),
  title: z.string().trim().min(1).max(160),
  provider: z.string().max(160).optional(),
  confirmationNumber: z.string().max(160).optional(),
  startAt: z.string().datetime({ offset: true }),
  endAt: z.string().datetime({ offset: true }).nullable().optional(),
  timezone: z.string().trim().min(1).max(100),
  locationName: z.string().max(200).optional(),
  address: z.string().max(500).optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  dayNumber: z.number().int().min(1).nullable().optional(),
  stopId: z.string().max(120).nullable().optional(),
  expenseId: z.string().max(120).nullable().optional(),
  amountMinor: z.number().int().min(0).nullable().optional(),
  currency: z.string().trim().length(3).nullable().optional(),
  notes: z.string().max(10_000).optional(),
});

export const updateReservationSchema = reservationDraftSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one reservation field is required",
  });

export const mobileOAuthStartQuerySchema = z.object({
  provider: z.literal("google"),
});

export const mobileOAuthExchangeSchema = z.object({
  code: z.string().min(16).max(512),
});

export const createTripSchema = z.object({
  title: z.string().trim().min(1).max(120),
  currency: z.string().trim().min(1).max(8).optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dayCount: z.number().int().min(1).max(60).optional(),
  destination: z.string().trim().min(1).max(120).optional(),
  budgetAmount: z.number().positive().max(1_000_000_000).optional(),
  partySize: z.number().int().min(1).max(100).optional(),
});

export const patchTripSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    clearAgentSeedPending: z.literal(true).optional(),
  })
  .refine((v) => v.title != null || v.clearAgentSeedPending === true, {
    message: "title or clearAgentSeedPending is required",
  });

export const createInviteSchema = z
  .object({
    accessScope: z.enum(["anyone", "restricted_emails"]),
    allowedEmails: z.array(z.string().trim().email()).max(50).optional().default([]),
    role: z.enum(["editor", "viewer"]),
    canInvite: z.boolean().optional().default(false),
    expiresAt: z.string().datetime().nullable().optional().default(null),
    /** When present, the link with this token is revoked once the new one is issued. */
    previousToken: z.string().min(1).optional(),
  })
  .refine(
    (v) => v.accessScope !== "restricted_emails" || v.allowedEmails.length > 0,
    { message: "At least one email is required for a restricted invite" },
  );

export const MAX_MULTIPART_OVERHEAD_BYTES = 64 * 1024;

export const MAX_AVATAR_REQUEST_BYTES = MAX_AVATAR_BYTES + MAX_MULTIPART_OVERHEAD_BYTES;

export const MAX_TRIP_MEDIA_REQUEST_BYTES =
  MAX_TRIP_MEDIA_BYTES + MAX_MULTIPART_OVERHEAD_BYTES;

export const preferenceSchema = z.object({
  plannerSidebarWidth: z.number().min(0).max(100),
  plannerSidebarCollapsed: z.boolean(),
});

export const agentPanelPreferenceSchema = z.object({
  collapsed: z.boolean(),
});

export const agentFilePartSchema = z.object({
  type: z.literal("file"),
  mediaType: z.string().min(1).max(100),
  url: z.string().min(1).max(2_000),
  filename: z.string().max(255).optional(),
});

export const agentPostMessageSchema = z
  .object({
    text: z.string().trim().max(4_000).optional(),
    files: z.array(agentFilePartSchema).max(8).optional(),
  })
  .refine(
    (v) => Boolean(v.text?.trim()) || (v.files?.length ?? 0) > 0,
    { message: "Message text or attachment is required" },
  );

export const agentUiMessageSchema = z.object({
  id: z.string().optional(),
  role: z.string(),
  parts: z.array(
    z.object({ type: z.string(), text: z.string().optional() }).passthrough(),
  ),
});

export const agentChatSchema = z.object({
  /**
   * Full UI message list for the current turn (AI SDK useChat). Required for
   * tool-approval continuation; also used to extract the latest user text.
   */
  messages: z.array(agentUiMessageSchema).optional(),
  /** Legacy single-message body; still accepted for simple text turns. */
  message: agentUiMessageSchema.nullable().optional(),
});

export const agentApprovalSchema = z.object({
  id: z.string().min(1).optional(),
  approved: z.boolean(),
  reason: z.string().max(500).optional(),
});

export const agentEventsQuerySchema = z.coerce.number().int().min(0).default(0);

export const streetViewSearchQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusMeters: z.coerce.number().int().min(1).max(1_000).optional(),
  limit: z.coerce.number().int().min(1).max(10).optional(),
});

export const streetViewImageIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,160}$/);
