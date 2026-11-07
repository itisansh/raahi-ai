import { expenseAllocations, expenseMinor, expenseScale } from "./expense-money";
import type {
  Balance,
  Budget,
  ExpenseSnapshot,
  MemberSnapshot,
  Settlement,
} from "./types";

/** Compute per-member balances and a minimal settlement plan.
 * Mirrors the prototype: net = paid − fairShare, then greedily match the
 * largest debtor to the largest creditor until cleared. */
export function computeBudget(
  members: readonly MemberSnapshot[],
  expenses: readonly ExpenseSnapshot[],
  currency = "INR",
): Budget {
  const excludedCurrencies = [...new Set(expenses.filter(e => (e.currency || currency) !== currency).map(e => e.currency))];
  expenses = expenses.filter(e => (e.currency || currency) === currency);
  const scale = expenseScale(currency);
  const paid = new Map<string, number>();
  const share = new Map<string, number>();
  for (const m of members) {
    paid.set(m.id, 0);
    share.set(m.id, 0);
  }

  for (const e of expenses) {
    paid.set(e.payer, (paid.get(e.payer) ?? 0) + expenseMinor(e.amount, currency));
    for (const [id, value] of Object.entries(expenseAllocations(e.amount, currency, e.participants, e.allocations))) share.set(id, (share.get(id) ?? 0) + value);
  }

  const balances: Balance[] = members.map((m) => {
    const p = paid.get(m.id) ?? 0;
    const s = share.get(m.id) ?? 0;
    return { memberId: m.id, paid: p, share: Math.round(s), net: Math.round(p - s) };
  });

  const debtors = balances
    .filter((b) => b.net < 0)
    .map((b) => ({ id: b.memberId, v: -b.net }))
    .sort((a, b) => b.v - a.v);
  const creditors = balances
    .filter((b) => b.net > 0)
    .map((b) => ({ id: b.memberId, v: b.net }))
    .sort((a, b) => b.v - a.v);

  const settlements: Settlement[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i]!;
    const creditor = creditors[j]!;
    const x = Math.min(debtor.v, creditor.v);
    if (x > 0.5) {
      settlements.push({ from: debtor.id, to: creditor.id, amount: Math.round(x) });
    }
    debtor.v -= x;
    creditor.v -= x;
    if (debtor.v < 1) i++;
    if (creditor.v < 1) j++;
  }

  const total = expenses.reduce((sum, e) => sum + expenseMinor(e.amount, currency), 0);
  const perPerson = members.length ? Math.round(total / members.length) : 0;

  return { total: total / scale, perPerson: perPerson / scale, balances: balances.map(b => ({ ...b, paid: b.paid / scale, share: b.share / scale, net: b.net / scale })), settlements: settlements.map(s => ({ ...s, amount: s.amount / scale })), excludedCurrencies };
}
