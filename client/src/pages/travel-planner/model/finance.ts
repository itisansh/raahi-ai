import type { Budget } from "@/lib/models/expense";
export interface Repayment { id: string; from: string; to: string; amountMinor: number; currency: string; createdAt: string; voidedAt?: string; }
export interface FinanceStatus { revision: number; currency: string; repayments: Repayment[]; budget: Budget; caps: Array<{ memberId: string; capMinor: number | null; spentMinor: number; remainingMinor: number | null }> }
export const financeCopy = {
  title: "Repayments and personal budgets", hint: "Record money already paid back between members. This records a transfer; it does not send money or increase trip spending.",
  from: "Paid back by", to: "Paid back to", amount: "Amount repaid", record: "Confirm repayment received", pending: "Saving…", failure: "Could not save. Refresh balances and review the details before retrying.", refresh: "Refresh balances", choose: "Choose a member", empty: "No repayments recorded.", void: "Void repayment", confirmVoid: "Confirm void", cancel: "Keep record", voided: "Voided", cap: "Personal spending cap", capHint: "Optional caps compare each member’s allocated expenses with their limit. Repayments do not reduce travel spending. Future estimates are not included.", saveCap: "Save cap", clearCap: "Remove cap", spent: "Allocated spending", remaining: "Remaining", none: "No cap", capMember: "Member", repayments: "Repayment records", retry: "Retry the same repayment", invalid: "Enter a positive amount and choose two different members.",
};
export function toMinor(text: string, currency: string) {
  if (!(currency === "INR" ? /^\d+(\.\d{1,2})?$/ : /^\d+$/).test(text.trim())) return null;
  const value = Math.round(Number(text) * (currency === "INR" ? 100 : 1));
  return Number.isSafeInteger(value) && value > 0 && value <= 999999999999 ? value : null;
}
