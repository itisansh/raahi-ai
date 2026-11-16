import { z } from "zod";
import { tripIntentSchema, type PlanningContext, type TripIntent } from "./contracts";

const intakeSchema = z.object({
  origin: z.string().optional(), partySize: z.number().optional(),
  dayCount: z.number().optional(), startDate: z.string().optional(),
  budgetPaise: z.number().int().positive().optional(),
  budgetAmount: z.number().positive().optional(), budgetCurrency: z.string().optional(),
  budgetBasis: z.enum(["per_person", "group"]).optional(),
  budgetForecast: z.object({ groupBudgetPaise: z.number().int().positive() }).optional(),
});

/** Saved facts survive an extractor returning null. Explicit conversation values win,
 * except dates/duration: adding stops cannot resize the saved itinerary. */
export function withTripContext(intent: TripIntent, context: PlanningContext | null): TripIntent {
  if (!context) return intent;
  const intake = intakeSchema.safeParse(context.intake);
  const saved = intake.success ? intake.data : {};
  const plan = context.existingPlan;
  const amount = saved.budgetForecast?.groupBudgetPaise ?? saved.budgetPaise;
  const currency = plan?.currency ?? saved.budgetCurrency;
  const budget = currency === "INR"
    ? amount != null ? (amount / 100).toFixed(2) : saved.budgetAmount?.toFixed(2)
    : undefined;
  const defaults = {
    origin: saved.origin, partySize: saved.partySize,
    dayCount: plan?.days.length || saved.dayCount,
    startDate: plan?.startDate ?? saved.startDate,
    budgetRupees: budget,
    budgetBasis: saved.budgetForecast ? "group" : saved.budgetBasis,
    currency: currency === "INR" ? "INR" : currency ? "other" : undefined,
  };
  const result = { ...intent };
  for (const key of Object.keys(defaults) as Array<keyof typeof defaults>) {
    const value = defaults[key];
    if (value == null || (result[key] != null && key !== "dayCount" && key !== "startDate")) continue;
    const checked = tripIntentSchema.shape[key].safeParse(value);
    if (checked.success) Object.assign(result, { [key]: checked.data });
  }
  return result;
}
