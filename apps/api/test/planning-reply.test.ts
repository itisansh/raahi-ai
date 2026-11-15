import { expect, it, vi } from "vitest";
import { ProposalApprovalService } from "../src/services/planning/approval-service";
import type { StoredProposal } from "../src/services/planning/proposal-store";
import type { Trip } from "../src/domain/trip";

it("rejects clarification IDs at approval instead of attempting a trip write", async () => {
  const stored: StoredProposal = { id: "reply", ownerId: "owner", contextTripId: null, baseRevision: null, expiresAt: new Date(Date.now() + 60_000), payload: { status: "clarification", missing: ["origin"] } };
  const write = vi.fn();
  const service = new ProposalApprovalService({ save: vi.fn(), approve: async (_id: string, _owner: string, build: (value: StoredProposal) => Trip) => {
    const trip = build(stored); write(trip); return trip.toSnapshot().id;
  } });
  await expect(service.approve("reply", { id: "owner", name: "Owner" })).rejects.toMatchObject({ code: "proposal_needs_revision" });
  expect(write).not.toHaveBeenCalled();
});
