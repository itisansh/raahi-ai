import { NotFoundError, DomainError } from "../domain/shared/errors";
import type { ProposalStore, StoredProposal } from "../services/planning/proposal-store";
import type { Trip } from "../domain/trip";
import type { SqlClient } from "./sql";
import { SqlTripRepository } from "./trip-repository.db";

export class SqlProposalStore implements ProposalStore {
  constructor(private db: SqlClient) {}
  async read(id: string, ownerId: string): Promise<StoredProposal | null> {
    const { rows } = await this.db.query<{ payload: unknown; context_trip_id: string | null; base_revision: number | null; expires_at: Date }>(`SELECT payload, context_trip_id, base_revision, expires_at FROM planning_proposals WHERE id=$1 AND owner_id=$2`, [id, ownerId]);
    const row = rows[0];
    return row ? { id, ownerId, payload: typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload, contextTripId: row.context_trip_id, baseRevision: row.base_revision, expiresAt: new Date(row.expires_at) } : null;
  }
  async save(p: StoredProposal) {
    await this.db.query(`INSERT INTO planning_proposals (id, owner_id, payload, context_trip_id, base_revision, expires_at) VALUES ($1,$2,$3,$4,$5,$6)`, [p.id, p.ownerId, JSON.stringify(p.payload), p.contextTripId, p.baseRevision, p.expiresAt]);
  }
  async approve(id: string, ownerId: string, build: (proposal: StoredProposal) => Trip) {
    const client = await this.db.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query<{ id: string; owner_id: string; payload: unknown; context_trip_id: string | null; base_revision: number | null; expires_at: Date; result_trip_id: string | null }>(`SELECT * FROM planning_proposals WHERE id=$1 AND owner_id=$2 FOR UPDATE`, [id, ownerId]);
      const row = rows[0];
      if (!row) throw new NotFoundError("proposal_not_found", "Proposal not found");
      // A completed approval is idempotent even after its original expiry.
      if (row.result_trip_id) { await client.query("COMMIT"); return row.result_trip_id; }
      if (new Date(row.expires_at).getTime() <= Date.now()) throw new DomainError("proposal_expired", "Generate a fresh proposal before saving");
      const trip = build({ id, ownerId, payload: typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload, contextTripId: row.context_trip_id, baseRevision: row.base_revision, expiresAt: row.expires_at });
      await new SqlTripRepository(this.db).create(trip, client);
      const tripId = trip.toSnapshot().id;
      await client.query(`UPDATE planning_proposals SET result_trip_id=$1, approved_at=CURRENT_TIMESTAMP WHERE id=$2`, [tripId, id]);
      await client.query("COMMIT");
      return tripId;
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }
}
