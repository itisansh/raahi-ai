import type { HttpContext } from "./web-context";
import { ZodError } from "zod";
import { WeatherError } from "../services/weather/weather-error";
import { FxError } from "../services/fx/fx-error";
import { GeoError } from "../services/geo/geo-error";
import { DomainError, NotFoundError } from "../services/rules/shared/errors";
import {
  ConflictError,
  ForbiddenError,
  ReservationConflictError,
} from "../services";
import { AvatarError } from "../services/avatar";
import { TripMediaError } from "../services/media";
import { StreetViewError } from "../services/street-view";
import { fail } from "../controllers/response";
import { captureException, logger } from "../integrations/observability";
import type { RuntimeName } from "../services/observability";

function reportServerError(
  err: Error,
  c: HttpContext,
  runtime: RuntimeName,
  status: number,
): void {
  if (status < 500) return;
  const requestId = c.get("requestId") as string | undefined;
  logger.error("http.request_failed", {
    runtime,
    requestId,
    errorCode: "code" in err ? String(err.code) : undefined,
    errorType: err.name,
    status,
    error: err,
  });
  captureException(err, { runtime, requestId, errorType: err.name, status });
}

/** Translate thrown errors into the error envelope. Used by the Express error handler. */
export function handleError(err: Error, c: HttpContext, runtime: RuntimeName = "node") {
  if (err instanceof ZodError) {
    return fail(c, "validation_error", err.issues[0]?.message ?? "Invalid input", 400);
  }
  if (err instanceof ForbiddenError) {
    return fail(c, err.code, err.message, 403);
  }
  if (err instanceof ConflictError) {
    return fail(c, err.code, err.message, 409);
  }
  if (err instanceof ReservationConflictError) {
    return c.json(
      {
        error: {
          code: "reservation_conflict",
          message: err.message,
          current: err.current,
        },
      },
      409,
    );
  }
  if (err instanceof DomainError) {
    if (["travel_rate_limited", "medical_rate_limited"].includes(err.code)) c.header("Retry-After", "60");
    return fail(
      c,
      err.code,
      err.message,
      ["travel_rate_limited", "medical_rate_limited"].includes(err.code) ? 429 : err.code === "budget_forbidden" ? 403 : ["budget_unavailable", "travel_unavailable", "medical_unavailable"].includes(err.code) ? 503 : ["trip_write_conflict", "reservation_conflict", "expense_request_reused", "expense_write_conflict", "budget_stale"].includes(err.code) ? 409 : 400,
    );
  }
  if (err instanceof AvatarError) {
    const status =
      err.code === "avatar_too_large"
        ? 413
        : err.code === "avatar_unsupported_mime"
          ? 400
          : 500;
    reportServerError(err, c, runtime, status);
    return fail(c, err.code, err.message, status);
  }
  if (err instanceof TripMediaError) {
    const status =
      err.code === "media_too_large"
        ? 413
        : err.code === "media_unsupported_mime"
          ? 400
          : 500;
    reportServerError(err, c, runtime, status);
    return fail(c, err.code, err.message, status);
  }
  if (err instanceof WeatherError) {
    const status = err.code === "weather_not_configured" ? 503 : 502;
    reportServerError(err, c, runtime, status);
    return fail(c, err.code, err.message, status);
  }
  if (err instanceof FxError) {
    reportServerError(err, c, runtime, 502);
    return fail(c, err.code, err.message, 502);
  }
  if (err instanceof GeoError) {
    const status =
      err.code === "geo_not_configured"
        ? 503
        : err.code === "geo_timeout"
          ? 504
          : 502;
    reportServerError(err, c, runtime, status);
    return fail(c, err.code, err.message, status);
  }
  if (err instanceof StreetViewError) {
    const status =
      err.code === "street_view_not_configured"
        ? 503
        : err.code === "street_view_provider_auth_error"
          ? 503
          : err.code === "street_view_rate_limited"
            ? 429
            : err.code === "street_view_image_not_found"
              ? 404
              : err.code === "street_view_timeout"
                ? 504
                : err.code === "street_view_preview_too_large"
                  ? 413
                  : err.code === "street_view_invalid_image" ||
                    err.code === "street_view_invalid_query" ||
                    err.code === "street_view_panorama_inspection_forbidden" ||
                    err.code === "street_view_unsupported_preview"
                    ? 400
                    : 502;
    reportServerError(err, c, runtime, status);
    return fail(c, err.code, err.message, status);
  }
  if (err instanceof NotFoundError) {
    return fail(c, err.code, err.message, 404);
  }
  const requestId = c.get("requestId") as string | undefined;
  logger.error("http.unhandled_error", {
    runtime,
    requestId,
    errorType: err.name,
    error: err,
  });
  captureException(err, { runtime, requestId, errorType: err.name });
  return fail(c, "internal_error", "Something went wrong", 500);
}
