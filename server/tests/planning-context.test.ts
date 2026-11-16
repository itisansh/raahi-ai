import { expect, it } from "vitest";
import { withTripContext } from "../src/services/planning/context-intent";
import { clarificationReply } from "../src/services/planning/reply";
import type { PlanningContext, TripIntent } from "../src/services/planning/contracts";
const empty: TripIntent = { origin: null, partySize: null, dayCount: null, budgetRupees: null, budgetBasis: null, currency: null, destinationHints: ["Haridwar"], startDate: null, language: "en" };
const context: PlanningContext = { tripId: "trip", revision: 1, title: "India", days: [], intake: { origin: "Lucknow", partySize: 5, budgetPaise: 700000, budgetBasis: "per_person" }, existingPlan: { currency: "INR", startDate: "2027-04-12", days: Array.from({ length: 6 }, (_, i) => ({ number: i + 1, date: "2027-04-12", dateLabel: "", city: "Haridwar", color: "blue" })), stops: [] } };
it("recovers saved constraints even when extraction forgets every core field", () => {
  expect(withTripContext(empty, context)).toMatchObject({ origin: "Lucknow", partySize: 5, dayCount: 6, budgetRupees: "7000.00", budgetBasis: "per_person", currency: "INR", startDate: "2027-04-12" });
});
it("keeps explicit budget and party changes while preserving the saved schedule", () => {
  expect(withTripContext({ ...empty, budgetRupees: "9000", budgetBasis: "group", partySize: 3, dayCount: 2 }, context)).toMatchObject({ budgetRupees: "9000", budgetBasis: "group", partySize: 3, dayCount: 6 });
});
it("uses saved group forecasts without guessing legacy basis or member count", () => {
  expect(withTripContext(empty, { ...context, intake: { budgetForecast: { groupBudgetPaise: 3500000 } } })).toMatchObject({ budgetRupees: "35000.00", budgetBasis: "group", partySize: null });
  expect(withTripContext(empty, { ...context, intake: { budgetAmount: 7000 } })).toMatchObject({ budgetRupees: "7000.00", budgetBasis: null, partySize: null });
});
it("acknowledges the itinerary when only truly missing details need clarification", () => {
  const resolved = withTripContext(empty, { ...context, intake: null });
  const reply = clarificationReply(resolved, ["partySize", "budgetRupees"], true);
  expect(reply.text).toContain("6-day itinerary starting 2027-04-12");
  expect(reply.text).not.toContain("How many days");
});
it("does not borrow context for new trips or turn foreign budgets into INR", () => {
  expect(withTripContext(empty, null)).toEqual(empty);
  expect(withTripContext(empty, { ...context, existingPlan: { ...context.existingPlan!, currency: "USD" } })).toMatchObject({ currency: "other", budgetRupees: null });
});
