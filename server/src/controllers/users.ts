import { BetterAuthCurrentUserProfile } from "../integrations/auth/current-user-profile";
import type { Container } from "../config/container";
import { ok, fail } from "../controllers/response";
import type { Controller } from "../middleware/web-context";
import { preferenceSchema, agentPanelPreferenceSchema } from "./schemas";

export function createUsersControllers(container: Container) {
  const { auth, preferenceService, avatarService } = container;
  return {
    uploadAvatar: async (c) => {
      const user = c.get("user")!;
      const body = await c.req.parseBody();
      const file = body.avatar;
      if (!(file instanceof File)) {
        return fail(c, "avatar_missing", "Avatar file is required", 400);
      }
      const profile = new BetterAuthCurrentUserProfile(auth, c.req.raw.headers);
      const url = await avatarService.replace(
        user.id,
        user.image ?? null,
        {
          content: new Uint8Array(await file.arrayBuffer()),
          claimedMimeType: file.type,
        },
        profile,
      );
      return ok(c, { url }, 201);
    },

    deleteAvatar: async (c) => {
      const user = c.get("user")!;
      const profile = new BetterAuthCurrentUserProfile(auth, c.req.raw.headers);
      await avatarService.remove(user.image ?? null, profile);
      return ok(c, { image: null });
    },

    getPreferences: async (c) =>
      ok(c, await preferenceService.getPreferences(c.get("user")!.id)),

    updatePreferences: async (c) => {
      const user = c.get("user")!;
      const input = preferenceSchema.parse(await c.req.json());
      return ok(
        c,
        await preferenceService.updatePlannerSidebar(
          user.id,
          input.plannerSidebarWidth,
          input.plannerSidebarCollapsed,
        ),
      );
    },

    updateAgentPanel: async (c) => {
      const user = c.get("user")!;
      const input = agentPanelPreferenceSchema.parse(await c.req.json());
      return ok(c, await preferenceService.updateAgentPanel(user.id, input.collapsed));
    }
  } satisfies Record<string, Controller>;
}

