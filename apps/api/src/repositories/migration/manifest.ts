/** Versioned source coverage. Every scalar column is checked against the snapshot. */
export const tables = {
  account: "account", agent_messages: "agent_messages", agent_suggestion_dismissals: "agent_suggestion_dismissals",
  agent_suggestions: "agent_suggestions", expense_participants: null, expenses: "expenses", reservations: "reservations",
  schema_migrations: null, session: "session", stop_comments: "stop_comments", stop_votes: "stop_votes", stops: "stops",
  trip_days: "trip_days", trip_invite_acceptances: "trip_invite_acceptances", trip_invite_allowed_emails: null,
  trip_invites: "trip_invites", trip_members: "trip_members", trips: "trips", twoFactor: "twoFactor", user: "user",
  user_preferences: "user_preferences", verification: "verification", planning_proposals: "planning_proposals",
} as const;
export type SourceTable = keyof typeof tables;
export type Row = Record<string, unknown>;
export interface SourceColumn { name: string; type: string; nullable: boolean }
export interface MigrationExport {
  version: 1;
  schemaSha256: string;
  exportedAt: string;
  columns: Record<SourceTable, SourceColumn[]>;
  rows: Record<SourceTable, Row[]>;
  prismaHistory: Row[];
}
export const authTables = new Set(["user", "account", "session", "verification", "twoFactor"]);
export const camel = (value: string) => value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
