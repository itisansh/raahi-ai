/** HTTP planning preview contract; approval is a separate explicit action. */
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
  travelPreferences?: string;
}
export interface ProposalPreview {
  status: "preview";
  reply: PlanningReply;
  proposalId: string;
  saved: false;
  costScope?: "additions" | "whole_trip";
  changeMode?: "append_stops" | "create_trip";
  retainedStops?: Array<{ id: string; day: number; name: string; time: string; duration: string }>;
  approvable: boolean;
  title: string;
  guidance?: { response: string; timing: string; questions: string[] } | null;
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
export interface PlanningReply { text: string; language: "en" | "hi" }
export type PlanningResult = ProposalPreview | { status: "clarification"; proposalId: string; reply: PlanningReply; intent: PlanningIntent; missing: string[] };

export function formatPaise(paise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(paise / 100);
}

export function formatMinute(minute: number) {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}
