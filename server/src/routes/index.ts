import { Router } from "express";
import type { Container } from "../config/container";
import type { CreateAppOptions } from "../config/http";
import { endpoint, routeContext } from "../middleware/web-context";
import { requireSession, requireAgent } from "../middleware/session";
import { bodyLimit } from "../middleware/body-limit";
import { fail } from "../controllers/response";
import { MAX_AVATAR_REQUEST_BYTES, MAX_TRIP_MEDIA_REQUEST_BYTES } from "../controllers/schemas";
import { createPlatformControllers } from "../controllers/platform";
import { createInvitesControllers } from "../controllers/invites";
import { createTripsControllers } from "../controllers/trips";
import { createPlanningControllers } from "../controllers/planning";
import { createTravelControllers } from "../controllers/travel";
import { createFinanceControllers } from "../controllers/finance";
import { createItineraryControllers } from "../controllers/itinerary";
import { createExpensesControllers } from "../controllers/expenses";
import { createReservationsControllers } from "../controllers/reservations";
import { createUsersControllers } from "../controllers/users";
import { createAgentControllers } from "../controllers/agent";

export function createRoutes(container: Container, options: CreateAppOptions) {
  const router = Router({ strict: true, caseSensitive: true });
  const platform = createPlatformControllers(container);
  const invites = createInvitesControllers(container, options);
  const trips = createTripsControllers(container, options);
  const planning = createPlanningControllers(container);
  const travel = createTravelControllers(container);
  const finance = createFinanceControllers(container);
  const itinerary = createItineraryControllers(container, options);
  const expenses = createExpensesControllers(container, options);
  const reservations = createReservationsControllers(container);
  const users = createUsersControllers(container);
  const agent = createAgentControllers(container, options);
  router.get("/api/auth/capabilities",
    routeContext("/api/auth/capabilities"),
    endpoint(platform.capabilities));
  router.get("/api/auth/{*splat}",
    routeContext("/api/auth/*"),
    endpoint(platform.auth));
  router.post("/api/auth/{*splat}",
    routeContext("/api/auth/*"),
    endpoint(platform.auth));
  router.get("/",
    routeContext("/"),
    endpoint(platform.root));
  router.get("/api/mobile-auth/oauth/start",
    routeContext("/api/mobile-auth/oauth/start"),
    endpoint(platform.startOAuth));
  router.get("/api/mobile-auth/oauth/complete",
    routeContext("/api/mobile-auth/oauth/complete"),
    endpoint(platform.completeOAuth));
  router.post("/api/mobile-auth/oauth/exchange",
    routeContext("/api/mobile-auth/oauth/exchange"),
    endpoint(platform.exchangeOAuth));
  router.get("/api/health",
    routeContext("/api/health"),
    endpoint(platform.getHealth));
  router.get("/api/trip-invites/:token",
    routeContext("/api/trip-invites/:token"),
    endpoint(invites.previewInvite));
  router.get("/api/uploads/{*splat}",
    routeContext("/api/uploads/*"),
    endpoint(platform.readUpload));
  router.get("/api/trips",
    routeContext("/api/trips"),
    requireSession,
    endpoint(trips.listTrips));
  router.post("/api/voice/token",
    routeContext("/api/voice/token"),
    requireSession,
    endpoint(planning.issueVoiceToken));
  router.post("/api/trips/:id/medical",
    routeContext("/api/trips/:id/medical"),
    requireSession,
    bodyLimit({ maxSize: 1500, onError: (c) => fail(c, "request_too_large", "Medical search request too large", 413) }),
    endpoint(travel.searchMedical));
  router.post("/api/trips/:id/travel",
    routeContext("/api/trips/:id/travel"),
    requireSession,
    bodyLimit({ maxSize: 2000, onError: (c) => fail(c, "request_too_large", "Travel request too large", 413) }),
    endpoint(travel.inspectTravel));
  router.get("/api/trips/:id/history",
    routeContext("/api/trips/:id/history"),
    requireSession,
    endpoint(finance.listHistory));
  router.post("/api/trips/:id/history/rollback",
    routeContext("/api/trips/:id/history/rollback"),
    requireSession,
    bodyLimit({ maxSize: 1000, onError: c => fail(c, "request_too_large", "Request too large", 413) }),
    endpoint(finance.rollbackHistory));
  router.get("/api/trips/:id/finance",
    routeContext("/api/trips/:id/finance"),
    requireSession,
    endpoint(finance.getFinance));
  router.post("/api/trips/:id/finance/:action",
    routeContext("/api/trips/:id/finance/:action"),
    requireSession,
    bodyLimit({ maxSize: 2000, onError: c => fail(c, "request_too_large", "Request too large", 413) }),
    endpoint(finance.updateFinance));
  router.get("/api/trips/:id/budget",
    routeContext("/api/trips/:id/budget"),
    requireSession,
    endpoint(finance.getBudget));
  router.post("/api/trips/:id/budget/:action",
    routeContext("/api/trips/:id/budget/:action"),
    requireSession,
    bodyLimit({ maxSize: 12000, onError: (c) => fail(c, "request_too_large", "Budget request too large", 413) }),
    endpoint(finance.updateBudget));
  router.post("/api/trips/:tripId/expenses/preview",
    routeContext("/api/trips/:tripId/expenses/preview"),
    requireSession,
    bodyLimit({ maxSize: 8000, onError: (c) => fail(c, "request_too_large", "Expense request is too large", 413) }),
    endpoint(planning.previewExpense));
  router.post("/api/voice/summary/:action",
    routeContext("/api/voice/summary/:action"),
    requireSession,
    bodyLimit({ maxSize: 1000, onError: (c) => fail(c, "request_too_large", "Speech request is too large", 413) }),
    endpoint(planning.summarizeProposal));
  router.post("/api/planning/preview",
    routeContext("/api/planning/preview"),
    requireSession,
    bodyLimit({ maxSize: 20_000, onError: (c) => fail(c, "request_too_large", "Planning request is too large", 413) }),
    endpoint(planning.previewPlan));
  router.post("/api/planning/proposals/:id/approve",
    routeContext("/api/planning/proposals/:id/approve"),
    requireSession,
    bodyLimit({ maxSize: 1000, onError: (c) => fail(c, "request_too_large", "Approval request is too large", 413) }),
    endpoint(planning.approvePlan));
  router.get("/api/weather",
    routeContext("/api/weather"),
    requireSession,
    endpoint(platform.getWeather));
  router.get("/api/fx/rates",
    routeContext("/api/fx/rates"),
    requireSession,
    endpoint(platform.getFxRates));
  router.post("/api/trips",
    routeContext("/api/trips"),
    requireSession,
    endpoint(trips.createTrip));
  router.get("/api/trips/:id",
    routeContext("/api/trips/:id"),
    requireSession,
    endpoint(trips.getTrip));
  router.get("/api/trips/:tripId/street-view/images",
    routeContext("/api/trips/:tripId/street-view/images"),
    requireSession,
    endpoint(trips.searchStreetView));
  router.get("/api/trips/:tripId/street-view/images/:imageId",
    routeContext("/api/trips/:tripId/street-view/images/:imageId"),
    requireSession,
    endpoint(trips.getStreetViewImage));
  router.get("/api/trips/:tripId/street-view/images/:imageId/preview",
    routeContext("/api/trips/:tripId/street-view/images/:imageId/preview"),
    requireSession,
    endpoint(trips.previewStreetViewImage));
  router.get("/api/trips/:tripId/street-view/viewer-config",
    routeContext("/api/trips/:tripId/street-view/viewer-config"),
    requireSession,
    endpoint(trips.getStreetViewConfig));
  router.patch("/api/trips/:id",
    routeContext("/api/trips/:id"),
    requireSession,
    endpoint(trips.updateTrip));
  router.post("/api/trips/:id/days",
    routeContext("/api/trips/:id/days"),
    requireSession,
    endpoint(itinerary.addDay));
  router.put("/api/trips/:id/days/order",
    routeContext("/api/trips/:id/days/order"),
    requireSession,
    endpoint(itinerary.reorderDays));
  router.delete("/api/trips/:id/days/:day",
    routeContext("/api/trips/:id/days/:day"),
    requireSession,
    endpoint(itinerary.deleteDay));
  router.patch("/api/trips/:id/days/:day",
    routeContext("/api/trips/:id/days/:day"),
    requireSession,
    endpoint(itinerary.updateDay));
  router.post("/api/trips/:id/stops",
    routeContext("/api/trips/:id/stops"),
    requireSession,
    endpoint(itinerary.addStop));
  router.post("/api/trips/:id/media",
    routeContext("/api/trips/:id/media"),
    requireSession,
    bodyLimit({
      maxSize: MAX_TRIP_MEDIA_REQUEST_BYTES,
      onError: (c) => fail(c, "media_too_large", "File request is too large", 413),
    }), endpoint(itinerary.uploadMedia));
  router.patch("/api/trips/:id/stops/:stopId",
    routeContext("/api/trips/:id/stops/:stopId"),
    requireSession,
    endpoint(itinerary.updateStop));
  router.put("/api/trips/:id/stops/:stopId/position",
    routeContext("/api/trips/:id/stops/:stopId/position"),
    requireSession,
    endpoint(itinerary.moveStop));
  router.post("/api/trips/:id/stops/:stopId/vote",
    routeContext("/api/trips/:id/stops/:stopId/vote"),
    requireSession,
    endpoint(itinerary.toggleVote));
  router.post("/api/trips/:id/stops/:stopId/comments",
    routeContext("/api/trips/:id/stops/:stopId/comments"),
    requireSession,
    endpoint(itinerary.addComment));
  router.post("/api/trips/:id/expenses",
    routeContext("/api/trips/:id/expenses"),
    requireSession,
    endpoint(expenses.addExpense));
  router.patch("/api/trips/:id/expenses/:expenseId",
    routeContext("/api/trips/:id/expenses/:expenseId"),
    requireSession,
    endpoint(expenses.updateExpense));
  router.get("/api/trips/:id/reservations",
    routeContext("/api/trips/:id/reservations"),
    requireSession,
    endpoint(reservations.listReservations));
  router.post("/api/trips/:id/reservations",
    routeContext("/api/trips/:id/reservations"),
    requireSession,
    endpoint(reservations.createReservation));
  router.patch("/api/trips/:id/reservations/:reservationId",
    routeContext("/api/trips/:id/reservations/:reservationId"),
    requireSession,
    endpoint(reservations.updateReservation));
  router.post("/api/trips/:id/reservations/:reservationId/cancel",
    routeContext("/api/trips/:id/reservations/:reservationId/cancel"),
    requireSession,
    endpoint(reservations.cancelReservation));
  router.delete("/api/trips/:id/reservations/:reservationId",
    routeContext("/api/trips/:id/reservations/:reservationId"),
    requireSession,
    endpoint(reservations.deleteReservation));
  router.post("/api/trips/:id/invites",
    routeContext("/api/trips/:id/invites"),
    requireSession,
    endpoint(invites.createInvite));
  router.post("/api/trip-invites/:token/accept",
    routeContext("/api/trip-invites/:token/accept"),
    requireSession,
    endpoint(invites.acceptInvite));
  router.post("/api/users/avatar",
    routeContext("/api/users/avatar"),
    requireSession,
    bodyLimit({
      maxSize: MAX_AVATAR_REQUEST_BYTES,
      onError: (c) => fail(c, "avatar_too_large", "Avatar request is too large", 413),
    }), endpoint(users.uploadAvatar));
  router.delete("/api/users/avatar",
    routeContext("/api/users/avatar"),
    requireSession,
    endpoint(users.deleteAvatar));
  router.get("/api/users/preferences",
    routeContext("/api/users/preferences"),
    requireSession,
    endpoint(users.getPreferences));
  router.put("/api/users/preferences",
    routeContext("/api/users/preferences"),
    requireSession,
    endpoint(users.updatePreferences));
  router.put("/api/users/preferences/agent-panel",
    routeContext("/api/users/preferences/agent-panel"),
    requireSession,
    endpoint(users.updateAgentPanel));
  router.get("/api/agent/status",
    routeContext("/api/agent/status"),
    requireSession,
    endpoint(platform.getAgentStatus));
  router.get("/api/trips/:tripId/agent/messages",
    routeContext("/api/trips/:tripId/agent/messages"),
    requireSession,
    requireAgent(container),
    endpoint(agent.getHistory));
  router.post("/api/trips/:tripId/agent/messages",
    routeContext("/api/trips/:tripId/agent/messages"),
    requireSession,
    requireAgent(container),
    endpoint(agent.postMessage));
  router.post("/api/trips/:tripId/agent/chat",
    routeContext("/api/trips/:tripId/agent/chat"),
    requireSession,
    requireAgent(container),
    endpoint(agent.streamChat));
  router.get("/api/trips/:tripId/agent/events",
    routeContext("/api/trips/:tripId/agent/events"),
    requireSession,
    requireAgent(container),
    endpoint(agent.getEvents));
  router.post("/api/trips/:tripId/agent/suggestions/:suggestionId/approve",
    routeContext("/api/trips/:tripId/agent/suggestions/:suggestionId/approve"),
    requireSession,
    requireAgent(container),
    endpoint(agent.approveSuggestion));
  router.post("/api/trips/:tripId/agent/suggestions/:suggestionId/apply",
    routeContext("/api/trips/:tripId/agent/suggestions/:suggestionId/apply"),
    requireSession,
    requireAgent(container),
    endpoint(agent.applySuggestion));
  router.post("/api/trips/:tripId/agent/suggestions/:suggestionId/dismiss",
    routeContext("/api/trips/:tripId/agent/suggestions/:suggestionId/dismiss"),
    requireSession,
    requireAgent(container),
    endpoint(agent.dismissSuggestion));
  return router;
}
