import type { ExistingPlan } from "./existing-plan";
import { z } from "zod";

const text = z.string().trim().min(1).max(200);
const money = z.string().regex(/^\d{1,8}(\.\d{1,2})?$/);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
});

export const planningRequestSchema = z.object({
  prompt: z.string().trim().min(1).max(4000),
  tripId: z.string().trim().min(1).max(120).optional(),
}).strict();

/** Null is deliberate: the model must not fill missing user constraints. */
export const tripIntentSchema = z.object({
  origin: text.nullable(),
  partySize: z.number().int().min(1).max(100).nullable(),
  dayCount: z.number().int().min(1).max(14).nullable(),
  budgetRupees: money.nullable(),
  budgetBasis: z.enum(["per_person", "group"]).nullable(),
  currency: z.enum(["INR", "other"]).nullable(),
  destinationHints: z.array(text).max(8),
  startDate: date.nullable(),
  language: z.enum(["en", "hi", "hinglish"]),
  travelPreferences: z.string().trim().min(1).max(1000).optional(),
}).strict();
export type TripIntent = z.infer<typeof tripIntentSchema>;

const estimate = z.object({ minRupees: money, maxRupees: money }).strict().nullable();
export const candidateSchema = z.object({
  title: text,
  guidance: z.object({
    response: z.string().trim().min(1).max(1200),
    timing: z.string().trim().min(1).max(1200),
    questions: z.array(text).max(5),
  }).strict().optional(),
  days: z.array(z.object({
    day: z.number().int().min(1).max(14),
    city: text,
    stops: z.array(z.object({
      name: text,
      startMinute: z.number().int().min(0).max(1439),
      durationMinutes: z.number().int().min(15).max(720),
    }).strict()).max(3),
  }).strict()).min(1).max(14),
  /** Whole-trip, per-person estimates; never quoted fares or availability. */
  costs: z.object({
    transport: estimate, accommodation: estimate, food: estimate,
    activities: estimate, buffer: estimate,
  }).strict(),
}).strict();
export type Candidate = z.infer<typeof candidateSchema>;

export class PlanningError extends Error {
  constructor(public code: "planning_unavailable" | "planning_invalid_output" | "planning_rate_limited" | "planning_primary_rate_limited") {
    super(code);
  }
}

/** Exact decimal conversion, independent of model arithmetic or binary rounding. */
export function rupeesToPaise(value: string): number {
  const parsed = money.parse(value);
  const [whole, fraction = ""] = parsed.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export interface PlanningContext {
  tripId: string;
  revision: number;
  title: string;
  intake: unknown;
  days: unknown;
  existingPlan?: ExistingPlan;
  canEdit?: boolean;
}

export type PlanningStage = "understanding" | "drafting" | "checking";

export interface PlanningProgress {
  onStage?: (stage: PlanningStage) => void;
  onReply: (text: string) => void;
  signal: AbortSignal;
}

export interface PlanningModel {
  extract(prompt: string, context: PlanningContext | null, progress?: PlanningProgress): Promise<unknown>;
  propose(intent: TripIntent, context: PlanningContext | null, progress?: PlanningProgress): Promise<unknown>;
}

export const requiredIntentFields = ["origin", "partySize", "dayCount", "budgetRupees", "budgetBasis", "currency"] as const;
