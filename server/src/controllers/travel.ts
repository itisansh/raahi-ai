import { z } from "zod";
import type { Container } from "../config/container";
import { ok, fail } from "../controllers/response";
import type { Controller } from "../middleware/web-context";

export function createTravelControllers(container: Container) {
  const { config } = container;
  return {
    searchMedical: async (c) => {
      if (!config.trustedOrigins.includes(c.req.header("origin") ?? "")) return fail(c, "forbidden_origin", "Origin is not allowed", 403);
      if (!container.medicalService) return fail(c, "medical_unavailable", "Medical place search unavailable", 503);
      return ok(c, await container.medicalService.search(c.req.param("id"), c.get("user")!.id, await c.req.json().catch(() => null)));
    },

    inspectTravel: async (c) => {
      if (!config.trustedOrigins.includes(c.req.header("origin") ?? "")) return fail(c, "forbidden_origin", "Origin is not allowed", 403);
      const { stopIds } = z.object({ stopIds: z.array(z.string().min(1).max(150)).min(1).max(6) }).strict().parse(await c.req.json().catch(() => null));
      if (!container.indiaTravelService) return fail(c, "travel_unavailable", "Travel services unavailable", 503);
      return ok(c, await container.indiaTravelService.inspect(c.req.param("id"), c.get("user")!.id, stopIds));
    }
  } satisfies Record<string, Controller>;
}

