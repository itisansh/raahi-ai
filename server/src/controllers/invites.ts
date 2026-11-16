import type { Container } from "../config/container";
import { ok } from "../controllers/response";
import type { Controller } from "../middleware/web-context";
import type { CreateAppOptions } from "../config/http";
import { createControllerHelpers } from "./helpers";
import { createInviteSchema } from "./schemas";

export function createInvitesControllers(container: Container, options: CreateAppOptions) {
  const { tripInviteService, config } = container;
  const { inviteActor } = createControllerHelpers(container, options);
  return {
    previewInvite: async (c) => {
      const user = c.get("user");
      return ok(
        c,
        await tripInviteService.previewInvite(
          c.req.param("token"),
          user ? inviteActor(user) : null,
        ),
      );
    },

    createInvite: async (c) => {
      const user = c.get("user")!;
      const { previousToken, ...input } = createInviteSchema.parse(
        await c.req.json(),
      );
      const tripId = c.req.param("id");
      const created = previousToken
        ? await tripInviteService.regenerateInvite(
          tripId,
          inviteActor(user),
          previousToken,
          input,
        )
        : await tripInviteService.createInvite(tripId, inviteActor(user), input);
      const origin = c.req.header("origin") ?? config.trustedOrigins[0] ?? "";
      const url = `${origin.replace(/\/$/, "")}/invite/${created.token}`;
      return ok(c, { url, token: created.token, expiresAt: created.expiresAt }, 201);
    },

    acceptInvite: async (c) => {
      const user = c.get("user")!;
      const result = await tripInviteService.acceptInvite(
        c.req.param("token"),
        inviteActor(user),
      );
      return ok(c, result);
    }
  } satisfies Record<string, Controller>;
}

