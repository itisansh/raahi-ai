/**
 * Structural gate: every shipped HTTP route in createApp must appear in the
 * root API.md reference. Prevents route ↔ doc drift.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const appPath = resolve(root, "server/src/routes/index.ts");
const apiDocsPath = resolve(root, "API.md");
const dtoPath = resolve(root, "server/src/services/dto.ts");
const opsSchemasPath = resolve(
  root,
  "server/src/services/trip/ops/schemas.ts",
);

/** Extract native Express registrations; auth exposes a delegated GET/POST surface. */
function extractShippedRoutes(source: string): string[] {
  const routes = [...source.matchAll(/router\.(get|post|put|patch|delete)\(\s*["']([^"']+)["']/g)]
    .map(match => `${match[1]!.toUpperCase()} ${match[2]!.replace("/{*splat}", "/*")}`);
  if (routes.includes("GET /api/auth/*") && routes.includes("POST /api/auth/*")) {
    return [...routes.filter(route => !route.endsWith(" /api/auth/*")), "GET,POST /api/auth/*"].sort();
  }
  return routes.sort();
}

const REQUIRED_DOC_PATHS = [
  "/api/auth/*",
  "/api/mobile-auth/oauth/start",
  "/api/mobile-auth/oauth/complete",
  "/api/mobile-auth/oauth/exchange",
  "/api/health",
  "/api/uploads/*",
  "/api/weather",
  "/api/fx/rates",
  "/api/agent/status",
  "/api/trips",
  "POST | `/api/trips`",
  "/api/trips/:id",
  "/api/trips/:id/days",
  "/api/trips/:id/days/:day",
  "/api/trips/:id/days/order",
  "DELETE | `/api/trips/:id/days/:day`",
  "/api/trips/:id/stops",
  "/api/trips/:id/stops/:stopId",
  "/api/trips/:id/stops/:stopId/position",
  "/api/trips/:id/stops/:stopId/vote",
  "/api/trips/:id/stops/:stopId/comments",
  "/api/trips/:id/media",
  "/api/trips/:id/expenses",
  "/api/trips/:id/expenses/:expenseId",
  "/api/trips/:id/reservations",
  "/api/trips/:id/reservations/:reservationId",
  "/api/trips/:id/reservations/:reservationId/cancel",
  "/api/trips/:id/invites",
  "/api/trip-invites/:token",
  "/api/trip-invites/:token/accept",
  "/api/users/preferences",
  "/api/users/preferences/agent-panel",
  "/api/users/avatar",
  "/api/trips/:tripId/agent/messages",
  "/api/trips/:tripId/agent/chat",
  "/api/trips/:tripId/agent/events",
  "/api/trips/:tripId/agent/suggestions/:suggestionId/approve",
  "/api/trips/:tripId/agent/suggestions/:suggestionId/apply",
  "/api/trips/:tripId/agent/suggestions/:suggestionId/dismiss",
] as const;

const REQUIRED_DTO_MARKERS = [
  "TripSummary",
  "TripDto",
  "TripPermissions",
  "Budget",
  "InvitePreview",
  "UserPreferenceDto",
  "WeatherData",
  "FxRatesData",
  "AgentHistoryDto",
  "AgentEventsDto",
  "AgentMessageDto",
  "AgentSuggestionDto",
  "PendingPatch",
  "ReservationDto",
  "StopCategory",
  '"data"',
  '"error"',
  "unauthenticated",
  "credentials",
] as const;

describe("client API documentation coverage", () => {
  const appSource = readFileSync(appPath, "utf8");
  const docs = readFileSync(apiDocsPath, "utf8");
  const dtoSource = readFileSync(dtoPath, "utf8");
  const opsSource = readFileSync(opsSchemasPath, "utf8");

  it("documents every shipped method and path in the root reference", () => {
    for (const route of extractShippedRoutes(appSource)) {
      const [method, path] = route.split(" ");
      const tableMethod = method!.replace(",", ", ");
      expect(docs, `undocumented route: ${route}`).toContain(`${tableMethod} | \`${path}\``);
    }
  });

  it("documents streaming and Node WebSocket contracts", () => {
    expect(docs).toContain("application/x-ndjson");
    expect(docs).toContain('"type":"result"');
    expect(docs).toContain('"type":"error"');
    expect(docs).toContain("/api/trips/:tripId/realtime");
    expect(docs).toContain("NodeRealtime");
    expect(docs).not.toContain("Worker-only");
  });

  it("extracts the known shipped route set from Express registrations", () => {
    const routes = extractShippedRoutes(appSource);

    expect(routes).toContain("DELETE /api/trips/:id/days/:day");
    expect(routes).toContain("PUT /api/trips/:id/stops/:stopId/position");
    expect(routes).toContain("GET /api/health");
    expect(routes).toContain("GET,POST /api/auth/*");
    expect(routes).toContain("POST /api/trips/:tripId/agent/chat");
    expect(routes).toContain("GET /api/weather");
    expect(routes).toContain("GET /api/fx/rates");

    expect(appSource).toContain("Router({ strict: true, caseSensitive: true })");
  });

  it("documents every required path in API.md", () => {
    const missing = REQUIRED_DOC_PATHS.filter((p) => !docs.includes(p));
    expect(missing, `Missing from api docs: ${missing.join(", ")}`).toEqual([]);
  });

  it("documents contract sections clients need", () => {
    for (const marker of REQUIRED_DTO_MARKERS) {
      expect(docs, `api docs should mention ${marker}`).toContain(marker);
    }
    expect(docs).toMatch(/# Conventions|# Authentication and session/);
    expect(docs).toMatch(/# DTO catalog/);
    expect(docs).toMatch(/# Route index/);
  });

  it("documents TripDto fields that exist on the application serializer", () => {
    expect(dtoSource).toContain("export interface TripDto");
    const fieldMatches = [
      ...dtoSource.matchAll(/^\s{2}(\w+)[?:]?:/gm),
    ].map((x) => x[1]!);
    const tripDtoFields = fieldMatches.slice(
      fieldMatches.indexOf("id"),
      fieldMatches.indexOf("budget") + 1,
    );
    for (const field of [
      "id",
      "title",
      "status",
      "currency",
      "startDate",
      "members",
      "permissions",
      "days",
      "stops",
      "expenses",
      "budget",
    ]) {
      expect(tripDtoFields, `TripDto has ${field}`).toContain(field);
      expect(docs, `api docs document TripDto.${field}`).toMatch(
        new RegExp(`\\\`${field}\\\``),
      );
    }
  });

  it("documents edge mutation schemas that ship in trip ops", () => {
    expect(opsSource).toContain("export const insertStopSchema");
    expect(opsSource).toContain("export const moveStopBodySchema");
    expect(opsSource).toContain("export const updateDaySchema");
    expect(opsSource).toContain("export const expenseDraftSchema");
    expect(opsSource).toContain("export const reorderDaysSchema");

    expect(docs).toContain("DELETE /api/trips/:id/days/:day");
    expect(docs).toContain("PUT /api/trips/:id/stops/:stopId/position");
    expect(docs).toMatch(/`color`/);
  });

  it("documents vote/comment as edit (loadEditable) and agent addressed semantics", () => {
    const useCases = readFileSync(
      resolve(root, "server/src/services/use-cases.ts"),
      "utf8",
    );
    const voteBlock = useCases.slice(
      useCases.indexOf("async toggleVote"),
      useCases.indexOf("async addComment"),
    );
    const commentBlock = useCases.slice(
      useCases.indexOf("async addComment"),
      useCases.indexOf("async addExpense"),
    );
    expect(voteBlock).toContain("loadEditable");
    expect(commentBlock).toContain("loadEditable");
    expect(docs).toMatch(/stops\/:stopId\/vote[\s\S]*?session \+ edit/);
    expect(docs).toMatch(
      /stops\/:stopId\/comments[\s\S]*?session \+ \*\*edit\*\*|stops\/:stopId\/comments[\s\S]*?session \+ edit/,
    );

    const agentService = readFileSync(
      resolve(root, "server/src/services/agent/agent-service.ts"),
      "utf8",
    );
    const postMsg = agentService.slice(
      agentService.indexOf("async postMessage"),
      agentService.indexOf("async streamChat"),
    );
    expect(postMsg).toContain("return { addressed: true, message: messageDto }");
    expect(postMsg).toContain(
      "return { addressed: false, message: messageDto }",
    );
    expect(postMsg).toContain("maybeReplyIfAddressed");
    expect(docs).toMatch(
      /addressed[\s\S]*?explicit `@agent`|addressed[\s\S]*?explicit @agent/,
    );
    expect(docs).toMatch(/maybeReplyIfAddressed|non-mention/);
    expect(docs).toMatch(/message:\s*AgentMessageDto|message` — the inserted/);
  });
});
