import { insertStopSchema, reorderDaysSchema, updateDaySchema } from "../services/trip/ops";
import type { Container } from "../config/container";
import { ok, fail } from "../controllers/response";
import type { Controller } from "../middleware/web-context";
import type { CreateAppOptions } from "../config/http";
import { createControllerHelpers } from "./helpers";
import { moveStopSchema, updateStopSchema, dayNumberSchema, commentSchema } from "./schemas";

export function createItineraryControllers(container: Container, options: CreateAppOptions) {
  const { tripService, tripMediaService, agentService } = container;
  const { deferOf, notifyAgent } = createControllerHelpers(container, options);
  return {
    addDay: async (c) =>
      ok(c, await tripService.addDay(c.req.param("id"), c.get("user")!.id), 201),

    reorderDays: async (c) => {
      const { order } = reorderDaysSchema.parse(await c.req.json());
      const dto = await tripService.reorderDays(
        c.req.param("id"),
        order,
        c.get("user")!.id,
      );
      notifyAgent(c, {
        tripId: dto.id,
        operation: "reorder_days",
        summary: `reordered the itinerary days to [${order.join(", ")}]`,
        details: { order },
      });
      return ok(c, dto);
    },

    deleteDay: async (c) => {
      const dayNumber = dayNumberSchema.parse(c.req.param("day"));
      const dto = await tripService.deleteDay(
        c.req.param("id"),
        dayNumber,
        c.get("user")!.id,
      );
      notifyAgent(c, {
        tripId: dto.id,
        operation: "delete_day",
        summary: `deleted day ${dayNumber}`,
        details: { dayNumber },
      });
      return ok(c, dto);
    },

    updateDay: async (c) => {
      const dayNumber = dayNumberSchema.parse(c.req.param("day"));
      const input = updateDaySchema.parse(await c.req.json());
      const dto = await tripService.updateDay(
        c.req.param("id"),
        dayNumber,
        input,
        c.get("user")!.id,
      );
      notifyAgent(c, {
        tripId: dto.id,
        operation: "update_day",
        summary: `updated day ${dayNumber}`,
        details: { dayNumber, changes: input },
      });
      return ok(c, dto);
    },

    addStop: async (c) => {
      const input = insertStopSchema.parse(await c.req.json());
      const dto = await tripService.insertStop(
        c.req.param("id"),
        input,
        c.get("user")!.id,
      );
      notifyAgent(c, {
        tripId: dto.id,
        operation: "insert_stop",
        summary: `added stop "${input.name}" to day ${input.day}`,
        details: { input },
      });
      return ok(c, dto);
    },

    uploadMedia: async (c) => {
      const body = await c.req.parseBody();
      const file = body.file;
      if (!(file instanceof File)) {
        return fail(c, "media_missing", "File is required", 400);
      }
      const url = await tripMediaService.upload(
        c.req.param("id"),
        c.get("user")!.id,
        {
          content: new Uint8Array(await file.arrayBuffer()),
          claimedMimeType: file.type,
          filename: file.name,
        },
      );
      return ok(c, { url }, 201);
    },

    updateStop: async (c) => {
      const input = updateStopSchema.parse(await c.req.json());
      const stopId = c.req.param("stopId");
      const dto = await tripService.updateStop(
        c.req.param("id"),
        stopId,
        input,
        c.get("user")!.id,
      );
      const stopName = dto.stops.find((s) => s.id === stopId)?.name ?? stopId;
      notifyAgent(c, {
        tripId: dto.id,
        operation: "update_stop",
        summary: `updated stop "${stopName}"`,
        details: { stopId, changes: input },
      });
      return ok(c, dto);
    },

    moveStop: async (c) => {
      const input = moveStopSchema.parse(await c.req.json());
      const stopId = c.req.param("stopId");
      const dto = await tripService.moveStop(
        c.req.param("id"),
        { stopId, ...input },
        c.get("user")!.id,
      );
      const stopName = dto.stops.find((s) => s.id === stopId)?.name ?? stopId;
      notifyAgent(c, {
        tripId: dto.id,
        operation: "move_stop",
        summary: `moved stop "${stopName}" to day ${input.day}`,
        details: { stopId, ...input },
      });
      return ok(c, dto);
    },

    toggleVote: async (c) =>
      ok(
        c,
        await tripService.toggleVote(
          c.req.param("id"),
          c.req.param("stopId"),
          c.get("user")!.id,
        ),
      ),

    addComment: async (c) => {
      const { text } = commentSchema.parse(await c.req.json());
      const user = c.get("user")!;
      const stopId = c.req.param("stopId");
      const dto = await tripService.addComment(
        c.req.param("id"),
        stopId,
        text,
        user.id,
      );
      // Mirror @member / @agent mentions into the shared agent session so the
      // existing mention-toast poll path fires. Ambient reply only for @agent.
      if (agentService) {
        const stopName = dto.stops.find((s) => s.id === stopId)?.name ?? stopId;
        const defer = deferOf(c);
        defer(
          agentService.recordStopComment(
            dto.id,
            user.id,
            `(commenting on stop "${stopName}") ${text}`,
            stopId,
            defer,
            { requestId: c.get("requestId"), runtime: options.runtime },
          ),
        );
      }
      return ok(c, dto);
    }
  } satisfies Record<string, Controller>;
}

