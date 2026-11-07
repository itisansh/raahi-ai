/** HTTP preview contract. No create/apply action exists in Phase 2. */
export interface PlanningIntent {
  origin: string | null;
  partySize: number | null;
  dayCount: number | null;
  budgetRupees: string | null;
  budgetBasis: "per_person" | "group" | null;
  currency: "INR" | "other" | null;
  destinationHints: string[];
  startDate: string | null;
  language: "en" | "hi" | "hinglish";
}
export interface ProposalPreview {
  status: "preview";
  proposalId: string;
  saved: false;
  approvable: boolean;
  title: string;
  intent: PlanningIntent;
  days: Array<{
    day: number; city: string;
    stops: Array<{
      name: string; startMinute: number; durationMinutes: number;
      evidence: {
        status: "matched" | "unavailable" | "ambiguous"; source: string; checkedAt: string;
        place: { id: string; name: string; label: string; lat: number; lng: number } | null;
      };
      travel: { status: string; minutes: number | null; source: string };
    }>;
  }>;
  budget: {
    groupBudgetPaise: number;
    estimates: Array<{ category: string; minPaise: number | null; maxPaise: number | null }>;
    knownMinPerPersonPaise: number; knownMaxPerPersonPaise: number;
    knownMaxGroupPaise: number;
    status: "over_budget" | "incomplete" | "within_estimate";
  };
  issues: string[];
  returnTravel: { status: string; minutes: number | null; source: string };
}
export type PlanningResult = ProposalPreview | { status: "clarification"; intent: PlanningIntent; missing: string[] };

export function formatPaise(paise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(paise / 100);
}

export function formatMinute(minute: number) {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}
