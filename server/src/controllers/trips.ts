import type { Container } from "../config/container";
import { ok, fail } from "../controllers/response";
import type { Controller } from "../middleware/web-context";
import type { CreateAppOptions } from "../config/http";
import { createTripSchema, patchTripSchema, streetViewSearchQuerySchema, streetViewImageIdSchema } from "./schemas";

export function createTripsControllers(container: Container, options: CreateAppOptions) {
  const { tripService, streetViewService } = container;
  return {
    listTrips: async (c) =>
      ok(c, await tripService.listTrips(c.get("user")!.id)),

    createTrip: async (c) => {
      const user = c.get("user")!;
      const input = createTripSchema.parse(await c.req.json());
      const dto = await tripService.createTrip(input, {
        id: user.id,
        name: user.name || user.email,
        image: user.image ?? null,
      });
      return ok(c, dto, 201);
    },

    getTrip: async (c) =>
      ok(c, await tripService.getTrip(c.req.param("id"), c.get("user")!.id)),

    searchStreetView: async (c) => {
      if (!streetViewService) {
        return fail(c, "street_view_not_configured", "Street view is not configured", 404);
      }
      const tripId = c.req.param("tripId");
      await tripService.assertReadable(tripId, c.get("user")!.id);
      const query = streetViewSearchQuerySchema.parse(c.req.query());
      return ok(
        c,
        await streetViewService.searchNearby({
          tripId,
          ...query,
          observability: {
            requestId: c.get("requestId"),
            runtime: options.runtime,
          },
        }),
      );
    },

    getStreetViewImage: async (c) => {
      if (!streetViewService) {
        return fail(c, "street_view_not_configured", "Street view is not configured", 404);
      }
      const tripId = c.req.param("tripId");
      await tripService.assertReadable(tripId, c.get("user")!.id);
      const imageId = streetViewImageIdSchema.parse(c.req.param("imageId"));
      return ok(
        c,
        await streetViewService.getImage(tripId, imageId, {
          requestId: c.get("requestId"),
          runtime: options.runtime,
        }),
      );
    },

    previewStreetViewImage: async (c) => {
      if (!streetViewService) {
        return fail(c, "street_view_not_configured", "Street view is not configured", 404);
      }
      const tripId = c.req.param("tripId");
      await tripService.assertReadable(tripId, c.get("user")!.id);
      const imageId = streetViewImageIdSchema.parse(c.req.param("imageId"));
      const preview = await streetViewService.readPreview(imageId, {
        requestId: c.get("requestId"),
        runtime: options.runtime,
      });
      return new Response(preview.bytes, {
        headers: {
          "Content-Type": preview.mediaType,
          "Cache-Control": "private, max-age=900",
          "X-Content-Type-Options": "nosniff",
        },
      });
    },

    getStreetViewConfig: async (c) => {
      if (!streetViewService) {
        return fail(c, "street_view_not_configured", "Street view is not configured", 404);
      }
      await tripService.assertReadable(c.req.param("tripId"), c.get("user")!.id);
      return ok(c, streetViewService.getViewerConfig());
    },

    updateTrip: async (c) => {
      const body = patchTripSchema.parse(await c.req.json());
      const userId = c.get("user")!.id;
      const tripId = c.req.param("id");
      if (body.clearAgentSeedPending) {
        return ok(c, await tripService.clearAgentSeedPending(tripId, userId));
      }
      return ok(c, await tripService.renameTrip(tripId, body.title!, userId));
    }
  } satisfies Record<string, Controller>;
}

