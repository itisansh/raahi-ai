import type { Trip } from "../../domain/trip";

export interface StoredProposal {
  id: string;
  ownerId: string;
  payload: unknown;
  contextTripId: string | null;
  baseRevision: number | null;
  expiresAt: Date;
}

export interface ProposalStore {
  save(proposal: StoredProposal): Promise<void>;
  /** Lock proposal, create trip and record approval in a single transaction. */
  approve(id: string, ownerId: string, build: (proposal: StoredProposal) => Trip): Promise<string>;
}
