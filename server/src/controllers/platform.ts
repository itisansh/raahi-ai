import { isManagedUploadPath } from "../services/storage";
import type { Container } from "../config/container";
import { ok, fail } from "../controllers/response";
import type { Controller } from "../middleware/web-context";
import { mobileOAuthStartQuerySchema, mobileOAuthExchangeSchema } from "./schemas";

export function createPlatformControllers(container: Container) {
  const { auth, fileStorage, config, weatherService, fxService, agentService } = container;
  return {
    capabilities: (c) => {
      c.header("Cache-Control", "no-store");
      return ok(c, {
        socialProviders: [
          ...(config.googleOAuth ? ["google"] : []),
        ],
        emailDelivery: config.email.provider === "console" ? "console" : "email",
      });
    },

    auth: async (c) => {
      try {
        return await auth.handler(c.req.raw);
      } catch (err) {
        console.error("Better Auth handler error:", err);
        throw err instanceof Error ? err : new Error(String(err));
      }
    },

    root: (c) => {
      const webOrigin =
        config.trustedOrigins.find(
          (origin) =>
            origin.startsWith("https://") &&
            origin !== config.betterAuthUrl &&
            !origin.includes("pages.dev"),
        ) ??
        config.trustedOrigins.find((origin) => origin.startsWith("https://"));
      if (webOrigin) return c.redirect(webOrigin.endsWith("/") ? webOrigin : `${webOrigin}/`);
      return c.text("Raahi AI API", 200);
    },

    startOAuth: async (c) => {
      const { provider } = mobileOAuthStartQuerySchema.parse(c.req.query());
      if (!config.googleOAuth) {
        return c.redirect("opentrip://auth/callback?error=oauth_unavailable");
      }
      const callbackURL = new URL(
        "/api/mobile-auth/oauth/complete",
        config.betterAuthUrl,
      ).toString();
      const { headers, response } = await auth.api.signInSocial({
        headers: c.req.raw.headers,
        body: { provider, callbackURL, disableRedirect: true },
        returnHeaders: true,
      });
      if (!response.url) {
        return fail(c, "oauth_start_failed", "Unable to start Google sign-in", 502);
      }
      const redirect = c.redirect(response.url);
      for (const cookie of headers.getSetCookie()) {
        redirect.headers.append("Set-Cookie", cookie);
      }
      return redirect;
    },

    completeOAuth: async (c) => {
      try {
        const { token } = await auth.api.generateOneTimeToken({
          headers: c.req.raw.headers,
        });
        const callback = new URL("opentrip://auth/callback");
        callback.searchParams.set("code", token);
        return c.redirect(callback.toString());
      } catch {
        return c.redirect("opentrip://auth/callback?error=oauth_session_missing");
      }
    },

    exchangeOAuth: async (c) => {
      const { code } = mobileOAuthExchangeSchema.parse(await c.req.json());
      const session = await auth.api.verifyOneTimeToken({ body: { token: code } });
      return c.json({ token: session.session.token, session });
    },

    getHealth: (c) => ok(c, { status: "ok" }),

    readUpload: async (c) => {
      const encodedPath = c.req.path.replace(/^\/api\/uploads\//, "");
      const storagePath = decodeStoragePath(encodedPath);
      if (!storagePath || !isManagedUploadPath(storagePath)) {
        return fail(c, "invalid_path", "Invalid path", 400);
      }
      const file = await fileStorage.read(storagePath);
      if (!file) return fail(c, "not_found", "File not found", 404);
      return new Response(file.content, {
        headers: {
          "Content-Type": file.contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
          "X-Content-Type-Options": "nosniff",
        },
      });
    },

    getWeather: async (c) => {
      const lat = Number(c.req.query("lat"));
      const lon = Number(c.req.query("lon"));
      const date = c.req.query("date")?.trim();
      const time = c.req.query("time")?.trim();
      const lang = c.req.query("lang")?.trim() || "en";
      if (Number.isNaN(lat) || Number.isNaN(lon)) {
        return fail(c, "invalid_coordinates", "lat and lon are required", 400);
      }
      return ok(c, await weatherService.getWeather(lat, lon, date, time, lang));
    },

    getFxRates: async (c) => {
      const base = c.req.query("base")?.trim() ?? "";
      const quotesRaw = c.req.query("quotes")?.trim() ?? "";
      const date = c.req.query("date")?.trim();
      const quotes = quotesRaw
        ? quotesRaw.split(",").map((q) => q.trim()).filter(Boolean)
        : undefined;
      return ok(c, await fxService.getRates(base, quotes, date));
    },

    getAgentStatus: (c) => ok(c, { enabled: agentService !== null })
  } satisfies Record<string, Controller>;
}

function decodeStoragePath(path: string): string | null {
  try {
    return decodeURIComponent(path);
  } catch {
    return null;
  }
}