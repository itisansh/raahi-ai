import { z } from "zod";
export interface HistoryStore {
  list(tripId: string, actor: string): Promise<Array<{ id: string; kind: string; approvedAt: string; appliedRevision: number | null; rolledBackAt: string | null; canRollback: boolean; beforeStops: Array<{ name: string; day: number }>; afterStops: Array<{ name: string; day: number }> }>>;
  rollback(tripId: string, actor: string, proposalId: string, revision: number): Promise<void>;
}
export class HistoryService {
  constructor(private store: HistoryStore) {}
  list(id: string, actor: string) { return this.store.list(id, actor); }
  async rollback(id: string, actor: string, raw: unknown) {
    const input = z.object({ proposalId: z.string().uuid(), revision: z.number().int().nonnegative(), confirm: z.literal(true) }).strict().parse(raw);
    await this.store.rollback(id, actor, input.proposalId, input.revision);
    return this.store.list(id, actor);
  }
}
