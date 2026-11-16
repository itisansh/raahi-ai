export const budgetCopy = {
  title: "Budget and replanning", loading: "Loading budget…", failure: "Could not complete this budget request. Check estimates and try again; if the trip changed, generate a new proposal.",
  forecast: "Confirm remaining group estimates", other: "Other remaining group costs: meals, lodging and transport (INR)", budget: "Total group budget (INR)", buffer: "Remaining safety buffer (INR)",
  estimates: "Enter remaining group costs for unbooked activities today and later. Include only costs not already recorded as expenses or bookings. Zero means no additional cost. These are your estimates, not live prices.",
  save: "Confirm forecast", propose: "Suggest affordable changes", approve: "Approve these removals", reject: "Keep current itinerary", busy: "Working…", readonly: "A trip editor must confirm forecasts and approve changes.",
  spent: "Recorded group spending", committed: "Bookings not linked to spending", future: "Remaining group estimates", projected: "Projected total including buffer", remaining: "Budget minus projected spending", perPerson: "Remaining per planned traveller (average)", warning: "Replanning needs complete INR costs and dated future activities. Check unknown dates, foreign-currency expenses, missing estimates or unknown booking costs.",
  comparison: "Proposed optional activity removals", savings: "Estimated savings", after: "Projected total after approval", stale: "Approval uses the stored proposal and rejects changes if the trip has changed. Removing activities does not verify new routes or timetables. Review the resulting travel gaps.",
};
export interface BudgetStatus {
  revision: number; groupBudgetPaise: number | null; spentPaise: number; committedPaise: number; estimatedPaise: number;
  bufferPaise: number; projectedPaise: number; remainingPaise: number | null; remainingPerPersonPaise: number | null; issues: string[];
  forecast: { groupBudgetPaise: number; otherFuturePaise: number; bufferPaise: number; costs: Record<string, number> } | null;
  future: Array<{ id: string; name: string; day: number; optional: boolean; estimatePaise: number | null }>;
}
export interface BudgetProposal { proposalId: string; reason: string; stopIds: string[]; removedStops: Array<{ id: string; name: string }>; before: BudgetStatus; savingsPaise: number; afterProjectedPaise: number; }
export function inputPaise(raw: string) {
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(raw.trim())) throw new Error("Invalid amount");
  const [whole, fraction = ""] = raw.trim().split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
export const showPaise = (value: number | null) => value == null ? "—" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(value / 100);
