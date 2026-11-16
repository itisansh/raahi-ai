import type { RequestHandler } from "express";
import type { CreateAppOptions } from "../config/http";
import { getTraceIds, logger, setActiveSpanAttributes } from "../integrations/observability";
import { contextFor } from "./web-context";

export function requestMetadata(options: CreateAppOptions): RequestHandler {
  return (req, res, next) => {
    const context = contextFor(res);
    const incoming = req.get("x-request-id")?.trim();
    const requestId = incoming && /^[A-Za-z0-9._:-]{8,128}$/.test(incoming) ? incoming : crypto.randomUUID();
    const startedAt = Date.now();
    context.set("requestId", requestId);
    context.header("x-request-id", requestId);
    res.setHeader("x-request-id", requestId);
    // Public file responses explicitly replace this default.
    res.setHeader("Cache-Control", "private, no-store");
    setActiveSpanAttributes({ requestId, runtime: options.runtime });
    options.setRequestContext?.({ requestId });
    res.once("finish", () => {
      const fields = {
        runtime: options.runtime, requestId, method: req.method,
        route: context.req.routePath, status: res.statusCode
      };
      logger.info("http.request.completed", {
        ...fields, durationMs: Date.now() - startedAt,
        ...context.get("agentContext"), ...getTraceIds()
      });
      if (res.statusCode >= 400 && res.statusCode < 500) logger.warn("http.request.rejected", fields);
    });
    next();
  };
}
