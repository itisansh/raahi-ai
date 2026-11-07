import { sourceSchemaHash, sourceSchemaColumns } from "./source-schema";
import { createHash } from "node:crypto";
import type { MongoDatabase } from "../../config/db";
import { expenseScale } from "../../domain/trip/expense-money";
import { authTables, camel, tables, type MigrationExport, type Row, type SourceTable } from "./manifest";

export function canonical(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  return JSON.stringify(value);
}
export const digest = (value: unknown) => createHash("sha256").update(canonical(value)).digest("hex");
/** Decimal parsing without binary floating-point multiplication or rounding. */
export function exactMinor(value: unknown, scale: number): number {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(String(value));
  if (!match) throw new Error("Invalid source money");
  const precision = scale === 100 ? 2 : 0;
  const fraction = match[2] ?? "";
  if (fraction.slice(precision).replace(/0/g, "")) throw new Error("Source money exceeds currency precision");
  const result = BigInt(match[1]!) * BigInt(scale) + BigInt(fraction.slice(0, precision).padEnd(precision, "0") || "0");
  if (result <= 0n || result > 999999999999n) throw new Error("Source money exceeds supported bounds");
  return Number(result);
}
const json = (value: unknown): unknown => typeof value === "string" ? JSON.parse(value) : value;
const safeInteger = (value: unknown) => {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw new Error("Unsafe source integer");
  return result;
};
export async function transformExport(source: MigrationExport, db: MongoDatabase): Promise<Record<string, Row[]>> {
  if (source.version !== 1 || canonical(Object.keys(source.rows).sort()) !== canonical(Object.keys(tables).sort())) throw new Error("Incomplete or unsupported source table manifest");
  if (source.schemaSha256 !== sourceSchemaHash || canonical(source.columns) !== canonical(sourceSchemaColumns)) throw new Error("Source schema mismatch");
  for (const table of Object.keys(tables) as SourceTable[]) for (const row of source.rows[table]) {
    if (canonical(Object.keys(row).sort()) !== canonical(source.columns[table].map(c => c.name).sort())) throw new Error(`Source column mismatch: ${table}`);
  }
  const target: Record<string, Row[]> = {};
  const tripForStop = new Map(source.rows.stops.map(r => [r.id, r.trip_id]));
  const currencyForTrip = new Map(source.rows.trips.map(r => [r.id, r.currency]));
  const commentOrder = new Map<unknown, number>();
  for (const row of [...source.rows.stop_comments].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)) || (BigInt(String(a.id)) < BigInt(String(b.id)) ? -1 : 1))) commentOrder.set(row.id, commentOrder.size);
  for (const [name, collection] of Object.entries(tables) as [SourceTable, string | null][]) {
    if (!collection) continue;
    target[collection] = await Promise.all(source.rows[name].map(async row => {
      const output: Row = {};
      const columns = source.columns[name];
      if (!columns || canonical(Object.keys(row).sort()) !== canonical(columns.map(c => c.name).sort())) throw new Error(`Source column mismatch: ${name}`);
      for (const column of columns) {
        let value = row[column.name];
        if (value == null && !column.nullable) throw new Error(`Unexpected source null: ${name}.${column.name}`);
        if (value != null) {
          if (column.type === "DateTime") { value = new Date(String(value)); if (Number.isNaN((value as Date).getTime())) throw new Error(`Invalid date: ${name}.${column.name}`); }
          if (column.type === "Json") value = json(value);
          if ((column.type === "BigInt" || column.type === "Int") && !(name === "stop_comments" && column.name === "id")) value = safeInteger(value);
          if (column.type === "Float") { value = Number(value); if (!Number.isFinite(value)) throw new Error("Invalid source number"); }
        }
        output[authTables.has(name) ? column.name : camel(column.name)] = value;
      }
      const identity = row.id ?? (name === "trip_days" ? [row.trip_id, row.number] : name === "stop_votes" ? [row.stop_id, row.member_id] : name === "trip_invite_acceptances" ? [row.invite_id, row.user_id] : name === "agent_suggestion_dismissals" ? [row.suggestion_id, row.user_id] : row.user_id);
      if (identity == null) throw new Error(`Missing source identity: ${name}`);
      output._id = typeof identity === "string" || typeof identity === "number" ? String(identity) : canonical(identity);
      if (authTables.has(name)) { delete output.id; return output; }
      if (name === "trip_members" || name === "stops") { output.order = output.sortOrder; delete output.sortOrder; }
      if (name === "stop_votes" || name === "stop_comments") {
        output.tripId = tripForStop.get(row.stop_id);
        if (!output.tripId) throw new Error("Orphan stop child");
      }
      if (name === "stop_comments") {
        output.author = output.authorId; delete output.authorId; delete output.id; delete output.createdAt;
        output.order = commentOrder.get(row.id);
      }
      if (name === "expenses") {
        const scale = expenseScale(String(row.currency || currencyForTrip.get(row.trip_id)));
        output.amountMinor = exactMinor(row.amount, scale); output.scale = scale; delete output.amount;
        output.payer = row.payer_id; delete output.payerId;
        output.createdOrder = row.sort_order; delete output.sortOrder;
        output.participants = source.rows.expense_participants.filter(p => p.expense_id === row.id).map(p => p.member_id).sort();
        if (output.allocations == null) delete output.allocations;
        else {
          const allocations = output.allocations as Row;
          output.allocations = Object.fromEntries(Object.entries(allocations).map(([key, amount]) => [key, exactMinor(amount, scale)]));
          const shares = output.allocations as Record<string, number>;
          if (canonical(Object.keys(shares).sort()) !== canonical(output.participants) || Object.values(shares).reduce((a, b) => a + b, 0) !== output.amountMinor) throw new Error("Invalid source expense shares");
        }
      }
      if (name === "trip_invites") output.allowedEmails = source.rows.trip_invite_allowed_emails.filter(e => e.invite_id === row.id).map(e => e.email).sort();
      if (name === "user_preferences") { output.width = Number(output.plannerSidebarWidth); output.collapsed = output.plannerSidebarCollapsed; delete output.plannerSidebarWidth; delete output.plannerSidebarCollapsed; }
      const model = Object.values(db.models).find(model => model.collection.name === collection);
      if (!model) throw new Error(`Missing target model: ${collection}`);
      const doc = new model(output);
      await doc.validate();
      return doc.toObject({ flattenMaps: true }) as Row;
    }));
    if (new Set(target[collection]!.map(row => row._id)).size !== target[collection]!.length) throw new Error(`Duplicate source identity: ${name}`);
  }
  validateReferences(source);
  return target;
}
function validateReferences(source: MigrationExport) {
  const ids = (table: SourceTable) => new Set(source.rows[table].map(row => row.id));
  const users = ids("user"), trips = ids("trips"), stops = ids("stops"), expenses = ids("expenses"), invites = ids("trip_invites"), suggestions = ids("agent_suggestions");
  for (const table of ["account", "session", "twoFactor", "user_preferences"] as const) for (const row of source.rows[table]) if (!users.has(row.userId ?? row.user_id)) throw new Error(`Orphan user reference: ${table}`);
  for (const table of ["trip_members", "trip_days", "stops", "expenses", "reservations", "trip_invites", "agent_messages", "agent_suggestions"] as const) for (const row of source.rows[table]) if (!trips.has(row.trip_id)) throw new Error(`Orphan trip reference: ${table}`);
  for (const row of source.rows.trip_members) if (row.user_id != null && !users.has(row.user_id)) throw new Error("Orphan membership user");
  for (const row of source.rows.expense_participants) if (!expenses.has(row.expense_id)) throw new Error("Orphan expense participant");
  for (const row of source.rows.trip_invite_allowed_emails) if (!invites.has(row.invite_id)) throw new Error("Orphan invite email");
  for (const row of source.rows.trip_invite_acceptances) if (!invites.has(row.invite_id)) throw new Error("Orphan invite acceptance");
  for (const row of source.rows.agent_suggestion_dismissals) if (!suggestions.has(row.suggestion_id)) throw new Error("Orphan suggestion dismissal");
  for (const row of source.rows.planning_proposals) {
    if (!users.has(row.owner_id)) throw new Error("Orphan proposal owner");
    if (row.context_trip_id != null && !trips.has(row.context_trip_id)) throw new Error("Orphan proposal context trip");
    if (row.result_trip_id != null && !trips.has(row.result_trip_id)) throw new Error("Orphan proposal result trip");
  }
  for (const row of source.rows.reservations) {
    if (row.stop_id != null && (!stops.has(row.stop_id) || !source.rows.stops.some(s => s.id === row.stop_id && s.trip_id === row.trip_id))) throw new Error("Orphan reservation stop");
    if (row.expense_id != null && (!expenses.has(row.expense_id) || !source.rows.expenses.some(e => e.id === row.expense_id && e.trip_id === row.trip_id))) throw new Error("Orphan reservation expense");
  }
  for (const row of source.rows.expenses) {
    const members = source.rows.trip_members.filter(m => m.trip_id === row.trip_id).map(m => m.id);
    const participants = source.rows.expense_participants.filter(p => p.expense_id === row.id).map(p => p.member_id);
    if (!members.includes(row.payer_id) || !participants.length || new Set(participants).size !== participants.length || participants.some(p => !members.includes(p))) throw new Error("Invalid source expense membership");
  }
}
