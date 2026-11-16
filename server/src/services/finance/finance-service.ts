import { computeBudget } from "../rules/trip/settlement";
import { z } from "zod";
import type { TripSnapshot } from "../rules/trip";
import { recordRepayment } from "../rules/trip/finance";
import { DomainError } from "../rules/shared/errors";
export interface FinanceStore {
  read(id: string, actor: string): Promise<TripSnapshot>;
  mutate(id: string, actor: string, mutate: (trip: TripSnapshot) => boolean): Promise<void>;
}
const revision = z.number().int().nonnegative();
const amount = z.number().int().positive().max(999999999999);
const repaymentSchema = z.object({ requestId: z.string().uuid(), from: z.string().min(1), to: z.string().min(1), amountMinor: amount, currency: z.string().length(3), revision, confirm: z.literal(true) }).strict();
export class FinanceService {
  constructor(private store: FinanceStore) {}
  async status(id: string, actor: string) {
    const trip = await this.store.read(id, actor);
    const budget = computeBudget(trip.members, trip.expenses, trip.currency, trip.finance?.repayments);
    const scale = trip.currency === "INR" ? 100 : 1;
    return { revision: trip.version, currency: trip.currency, repayments: trip.finance?.repayments ?? [], budget,
      caps: trip.members.map(m => { const capMinor = trip.finance?.caps[m.id] ?? null; const spentMinor = Math.round((budget.balances.find(b => b.memberId === m.id)?.share ?? 0) * scale); return { memberId: m.id, capMinor, spentMinor, remainingMinor: capMinor == null ? null : capMinor - spentMinor }; }) };
  }
  async repay(id: string, actor: string, raw: unknown) {
    const input = repaymentSchema.parse(raw);
    await this.store.mutate(id, actor, trip => {
      const changed = recordRepayment(trip, actor, input, new Date().toISOString());
      if (changed && trip.version !== input.revision) throw new DomainError("trip_write_conflict", "Trip changed; review balances again");
      return changed;
    });
    return this.status(id, actor);
  }
  async void(id: string, actor: string, raw: unknown) {
    const input = z.object({ repaymentId: z.string().uuid(), revision, confirm: z.literal(true) }).strict().parse(raw);
    await this.store.mutate(id, actor, trip => {
      const row = trip.finance?.repayments.find(r => r.id === input.repaymentId);
      if (!row) throw new DomainError("repayment_not_found", "Repayment not found");
      if (row.voidedAt) return false;
      if (trip.version !== input.revision) throw new DomainError("trip_write_conflict", "Trip changed; review balances again");
      row.voidedAt = new Date().toISOString(); row.voidedBy = actor; return true;
    });
    return this.status(id, actor);
  }
  async cap(id: string, actor: string, raw: unknown) {
    const input = z.object({ memberId: z.string().min(1), capMinor: amount.nullable(), revision }).strict().parse(raw);
    await this.store.mutate(id, actor, trip => {
      if (trip.version !== input.revision) throw new DomainError("trip_write_conflict", "Trip changed; review budgets again");
      if (!trip.members.some(m => m.id === input.memberId)) throw new DomainError("invalid_member", "Member not found");
      trip.finance ??= { repayments: [], caps: {} };
      if (input.capMinor === null) delete trip.finance.caps[input.memberId]; else trip.finance.caps[input.memberId] = input.capMinor;
      return true;
    });
    return this.status(id, actor);
  }
}
