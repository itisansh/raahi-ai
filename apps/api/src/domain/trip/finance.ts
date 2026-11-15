import { DomainError } from "../shared/errors";
import type { TripSnapshot } from "./types";
import { computeBudget } from "./settlement";
export interface Repayment { id: string; requestId: string; from: string; to: string; amountMinor: number; currency: string; createdBy: string; createdAt: string; voidedAt?: string; voidedBy?: string; }
export interface TripFinance { repayments: Repayment[]; caps: Record<string, number>; }
export function recordRepayment(trip: TripSnapshot, actor: string, input: { requestId: string; from: string; to: string; amountMinor: number; currency: string }, now: string): boolean {
  const finance = trip.finance ?? { repayments: [], caps: {} };
  const prior = finance.repayments.find(row => row.requestId === input.requestId && row.createdBy === actor);
  if (prior) {
    if (prior.from !== input.from || prior.to !== input.to || prior.amountMinor !== input.amountMinor || prior.currency !== input.currency) throw new DomainError("repayment_conflict", "This request was already used for different repayment details");
    return false;
  }
  if (input.currency !== trip.currency || input.from === input.to || ![input.from, input.to].every(id => trip.members.some(m => m.id === id)) || !Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) throw new DomainError("repayment_invalid", "Choose two trip members and a positive amount in the trip currency");
  const scale = trip.currency === "INR" ? 100 : 1;
  const balances = computeBudget(trip.members, trip.expenses, trip.currency, finance.repayments).balances;
  const owed = Math.round(-(balances.find(b => b.memberId === input.from)?.net ?? 0) * scale);
  const due = Math.round((balances.find(b => b.memberId === input.to)?.net ?? 0) * scale);
  if (input.amountMinor > Math.min(owed, due)) throw new DomainError("repayment_exceeds_balance", "Repayment exceeds the current outstanding balance");
  finance.repayments.push({ requestId: input.requestId, from: input.from, to: input.to, amountMinor: input.amountMinor, currency: input.currency, id: crypto.randomUUID(), createdBy: actor, createdAt: now });
  trip.finance = finance;
  return true;
}
