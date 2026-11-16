import type { RequestHandler } from "express";
import type { Container } from "../config/container";
import { contextFor, sendResponse } from "./web-context";
import { fail } from "../controllers/response";

export function resolveSession(container: Container): RequestHandler {
  return async (_req, res, next) => {
    const context = contextFor(res);
    // Better Auth handles its own session and cookies without a redundant lookup.
    const session = context.req.path.startsWith("/api/auth/") ? null
      : await container.auth.api.getSession({ headers: context.req.raw.headers });
    context.set("user", session?.user ?? null);
    context.set("session", session?.session ?? null);
    next();
  };
}

export const requireSession: RequestHandler = async (_req, res, next) => {
  const context = contextFor(res);
  if (!context.get("session")) {
    await sendResponse(context, fail(context, "unauthenticated", "Sign in required", 401), res);
    return;
  }
  next();
};

export function requireAgent(container: Container): RequestHandler {
  return async (_req, res, next) => {
    if (!container.agentService) {
      const context = contextFor(res);
      await sendResponse(context, fail(context, "agent_disabled", "Agent is not enabled", 404), res);
      return;
    }
    next();
  };
}
