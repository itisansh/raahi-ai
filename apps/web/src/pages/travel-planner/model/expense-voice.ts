export const expenseVoiceCopy = {
  invalidSplit: "Enter a positive share for every selected participant. Shares must add up exactly to the expense amount.",
  saveFailed: "Expense could not be saved. Retry the same details. If you change details after a failed save, close and reopen the form first.",
  repayments: "Net repayments sent minus received",
  cancel: "Cancel interpretation",
  request: "Expense request", placeholder: "I paid 600 rupees for lunch for four people.",
  interpret: "Fill expense draft", busy: "Interpreting expense…", failed: "Could not interpret this expense. You can still fill the form manually.",
  review: "Review the amount, currency and payer, then select the exact people before saving. Speech never saves an expense automatically.",
  wholeOnly: "Use a positive amount with up to two decimal places for INR. Other currencies require whole amounts.",
  custom: "Custom shares", equal: "Split equally", share: "Share for", mixed: "Other-currency expenses are listed but excluded from this trip’s balance. Settle each currency separately.",
  participants: "Select the exact people included. Selected:",
};
export interface ExpenseVoiceDraft {
  description: string | null; amountRupees: string | null; currency: "INR" | "other" | null;
  payerName: string | null; payerIsSelf: boolean; participantNames: string[]; participantCount: number | null;
}
/** Resolve only unique exact names; never infer beneficiaries from a count. */
export function resolveExpenseMembers(draft: ExpenseVoiceDraft, members: Array<{ id: string; name: string; isCurrentUser?: boolean }>) {
  const match = (name: string) => {
    const hits = members.filter(m => m.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase());
    return hits.length === 1 ? hits[0]!.id : "";
  };
  return {
    payer: draft.payerIsSelf ? members.find(m => m.isCurrentUser)?.id ?? "" : draft.payerName ? match(draft.payerName) : "",
    participants: [...new Set(draft.participantNames.map(match).filter(Boolean))],
  };
}
