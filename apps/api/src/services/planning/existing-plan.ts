import type { TripSnapshot } from "../../domain/trip";

export function scheduleMinute(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}
export function durationMinutes(value: string): number | null {
  const match = /^(?:(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours))?\s*(?:(\d+)\s*(?:m|min|mins|minute|minutes))?$/i.exec(value.trim());
  if (!match || (!match[1] && !match[2])) return null;
  const minutes = Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0);
  return minutes > 0 && Number.isInteger(minutes) ? minutes : null;
}
export type ExistingPlan = Pick<TripSnapshot, "days" | "stops" | "startDate" | "currency">;
