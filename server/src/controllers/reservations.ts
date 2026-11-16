import type { Container } from "../config/container";
import { ok, fail } from "../controllers/response";
import type { Controller } from "../middleware/web-context";
import { reservationDraftSchema, updateReservationSchema } from "./schemas";

export function createReservationsControllers(container: Container) {
  const { reservationService } = container;
  return {
    listReservations: async (c) =>
      ok(
        c,
        await reservationService.list(
          c.req.param("id"),
          c.get("user")!.id,
        ),
      ),

    createReservation: async (c) => {
      const idempotencyKey = c.req.header("Idempotency-Key") ?? "";
      if (!idempotencyKey.trim()) {
        return fail(
          c,
          "idempotency_key_required",
          "Idempotency-Key header is required",
          400,
        );
      }
      const input = reservationDraftSchema.parse(await c.req.json());
      return ok(
        c,
        await reservationService.create(
          c.req.param("id"),
          c.get("user")!.id,
          input,
          idempotencyKey,
        ),
        201,
      );
    },

    updateReservation: async (c) => {
      const revision = parseRevisionHeader(c.req.header("If-Match"));
      if (revision == null) {
        return fail(c, "revision_required", "A numeric If-Match header is required", 428);
      }
      const input = updateReservationSchema.parse(await c.req.json());
      return ok(
        c,
        await reservationService.update(
          c.req.param("id"),
          c.req.param("reservationId"),
          c.get("user")!.id,
          revision,
          input,
        ),
      );
    },

    cancelReservation: async (c) => {
      const revision = parseRevisionHeader(c.req.header("If-Match"));
      if (revision == null) {
        return fail(c, "revision_required", "A numeric If-Match header is required", 428);
      }
      return ok(
        c,
        await reservationService.cancel(
          c.req.param("id"),
          c.req.param("reservationId"),
          c.get("user")!.id,
          revision,
        ),
      );
    },

    deleteReservation: async (c) => {
      const revision = parseRevisionHeader(c.req.header("If-Match"));
      if (revision == null) {
        return fail(c, "revision_required", "A numeric If-Match header is required", 428);
      }
      await reservationService.delete(
        c.req.param("id"),
        c.req.param("reservationId"),
        c.get("user")!.id,
        revision,
      );
      return ok(c, { deleted: true });
    }
  } satisfies Record<string, Controller>;
}

function parseRevisionHeader(value: string | undefined): number | null {
  if (!value) return null;
  const normalized = value.trim().replace(/^W\//, "").replace(/^"|"$/g, "");
  if (!/^\d+$/.test(normalized)) return null;
  const revision = Number(normalized);
  return Number.isSafeInteger(revision) ? revision : null;
}