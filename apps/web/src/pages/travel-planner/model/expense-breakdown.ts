import type { Balance, Expense } from "@/entities/expense";
import type { StopCategory } from "@/entities/stop";

export interface ExpenseLine {
  id: string;
  description: string;
  category: StopCategory;
  amount: number;
}

export interface MemberBreakdown {
  /** Expenses the member joined, with their per-head portion. */
  shareItems: ExpenseLine[];
  /** Expenses the member fronted, with the full amount. */
  paidItems: ExpenseLine[];
  transferNet: number;
  shareSum: number;
  paidSum: number;
}

/** Split a member's trip expenses into what they owe a share of and what they
 * fronted, so the settle-up card can show where every number comes from.
 * Uses server allocations and the same minor-unit rules for legacy expenses. */
export function memberBreakdown(
  expenses: readonly Expense[],
  memberId: string,
  currency: string,
  repayments: ReadonlyArray<{ from: string; to: string; amountMinor: number; currency: string; voidedAt?: string }> = [],
): MemberBreakdown {
  const shareItems: ExpenseLine[] = [];
  const paidItems: ExpenseLine[] = [];
  let shareSum = 0;
  let paidSum = 0;
  const scale = currency === "INR" ? 100 : 1;
  for (const e of expenses) {
    if ((e.currency || currency) !== currency) continue;
    if (e.participants.includes(memberId) && e.participants.length > 0) {
      const ids = [...new Set(e.participants)].sort();
      const total = Math.round(e.amount * scale);
      const index = ids.indexOf(memberId);
      const portion = e.shares?.[memberId] ?? e.allocations?.[memberId]
        ?? (Math.floor(total / ids.length) + (index < total % ids.length ? 1 : 0)) / scale;
      shareSum += Math.round(portion * scale);
      shareItems.push({
        id: e.id,
        description: e.description,
        category: e.category,
        amount: portion,
      });
    }
    if (e.payer === memberId) {
      paidSum += Math.round(e.amount * scale);
      paidItems.push({
        id: e.id,
        description: e.description,
        category: e.category,
        amount: e.amount,
      });
    }
  }
  const transferNet = repayments.filter(r => !r.voidedAt && r.currency === currency).reduce((sum, r) => sum + (r.from === memberId ? r.amountMinor : 0) - (r.to === memberId ? r.amountMinor : 0), 0) / scale;
  return { shareItems, paidItems, transferNet, shareSum: shareSum / scale, paidSum: paidSum / scale };
}

/** Provenance behind a single settle-up transfer: who owes/is owed how much,
 * and the open amounts that produced the transfer at this step. */
export interface SettlementTrace {
  from: string;
  to: string;
  amount: number;
  /** Debtor's total shortfall across the whole trip (share − paid). */
  debtorOwed: number;
  /** Creditor's total surplus across the whole trip (paid − share). */
  creditorDue: number;
  /** Debtor's still-open amount right before this transfer. */
  debtorRemaining: number;
  /** Creditor's still-open amount right before this transfer. */
  creditorRemaining: number;
}

/** Re-runs the greedy debtor↔creditor match (mirrors the server budget) to
 * recover, for each transfer, the numbers that explain its exact amount. The
 * algorithm is deterministic, so a `from→to` pair appears at most once. */
export function traceSettlements(balances: readonly Balance[], currency: string): Map<string, SettlementTrace> {
  const scale = currency === "INR" ? 100 : 1;
  const owedByMember = new Map<string, number>();
  const dueByMember = new Map<string, number>();
  for (const b of balances) {
    if (b.net < 0) owedByMember.set(b.memberId, Math.round(-b.net * scale));
    else if (b.net > 0) dueByMember.set(b.memberId, Math.round(b.net * scale));
  }

  const debtors = [...owedByMember.entries()]
    .map(([id, v]) => ({ id, v }))
    .sort((a, b) => b.v - a.v);
  const creditors = [...dueByMember.entries()]
    .map(([id, v]) => ({ id, v }))
    .sort((a, b) => b.v - a.v);

  const traces = new Map<string, SettlementTrace>();
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i]!;
    const creditor = creditors[j]!;
    const x = Math.min(debtor.v, creditor.v);
    if (x > 0.5) {
      traces.set(`${debtor.id}\u0000${creditor.id}`, {
        from: debtor.id,
        to: creditor.id,
        amount: x / scale,
        debtorOwed: (owedByMember.get(debtor.id) ?? 0) / scale,
        creditorDue: (dueByMember.get(creditor.id) ?? 0) / scale,
        debtorRemaining: debtor.v / scale,
        creditorRemaining: creditor.v / scale,
      });
    }
    debtor.v -= x;
    creditor.v -= x;
    if (debtor.v < 1) i++;
    if (creditor.v < 1) j++;
  }
  return traces;
}

