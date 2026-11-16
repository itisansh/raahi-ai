import type { ErrorRequestHandler } from "express";
import type { CreateAppOptions } from "../config/http";
import { fail } from "../controllers/response";
import { handleError } from "./errors";
import { contextFor, sendResponse } from "./web-context";

export function errorHandler(options: CreateAppOptions): ErrorRequestHandler {
  return async (error: unknown, _req, res, _next) => {
    void _next; // Four arguments identify Express error middleware.
    const context = contextFor(res);
    if (res.destroyed || context?.req.raw.signal.aborted) return;
    const failure = error instanceof Error ? error : new Error(String(error));
    if (res.headersSent) { res.destroy(failure); return; }
    if (!context) {
      res.status(500).json({ error: { code: "internal_error", message: "Something went wrong" } });
      return;
    }
    try {
      const response = failure instanceof URIError && "status" in failure && failure.status === 400
        ? fail(context, "validation_error", "Invalid path encoding", 400)
        : handleError(failure, context, options.runtime);
      await sendResponse(context, response, res);
    }
    catch { res.destroy(failure); }
  };
}
