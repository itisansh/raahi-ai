import type { Trip } from "@/lib/models/trip";
import type { TripMember } from "@/lib/models/member";

/** Literal token the backend matches (`/@agent\b/`) to stream an agent reply. */
export const AGENT_TOKEN = "agent";

export interface MentionCandidate {
  key: string;
  /** Text inserted after `@`. */
  token: string;
  label: string;
  kind: "agent" | "member";
  member?: TripMember;
}

export function buildMentionCandidates(
  trip: Trip,
  agentLabel: string,
  options?: { includeAgent?: boolean },
): MentionCandidate[] {
  const includeAgent = options?.includeAgent ?? true;
  const members = trip.members
    .filter((m) => !m.isCurrentUser)
    .map<MentionCandidate>((m) => ({
      key: m.id,
      token: m.name,
      label: m.name,
      kind: "member",
      member: m,
    }));

  if (!includeAgent) return members;

  return [
    {
      key: "agent",
      token: AGENT_TOKEN,
      label: agentLabel,
      kind: "agent",
    },
    ...members,
  ];
}

export function filterMentionCandidates(
  candidates: MentionCandidate[],
  query: string,
): MentionCandidate[] {
  const q = query.toLowerCase();
  if (!q) return candidates;
  return candidates.filter(
    (c) =>
      c.label.toLowerCase().includes(q) ||
      c.token.toLowerCase().includes(q) ||
      (c.kind === "agent" && AGENT_TOKEN.includes(q)),
  );
}
