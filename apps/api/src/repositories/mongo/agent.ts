import type { AgentSessionRepository, NewAgentMessage, NewAgentSuggestion } from "../../domain/agent";
import { DomainError } from "../../domain/shared/errors";
import type { MongoDatabase } from "../../config/db";
export class MongoAgentSessionRepository implements AgentSessionRepository {
  constructor(private db: MongoDatabase) {}
  async listMessages(tripId: string, opts?: { afterSeq?: number; limit?: number }) {
    return (await this.db.models.messages.find({ tripId, seq: { $gt: opts?.afterSeq ?? 0 } }, { _id: 0 }).sort({ seq: -1 }).limit(opts?.limit ?? 200).lean()).reverse();
  }
  async appendMessage(message: NewAgentMessage) {
    return this.db.transaction(async session => {
      if (!await this.db.models.trips.exists({ id: message.tripId }).session(session)) throw new DomainError("trip_not_found", "Trip not found");
      const counter = await this.db.models.counters.findOneAndUpdate({ name: "agent_messages" }, { $inc: { value: 1 } }, { session, returnDocument: "after", runValidators: true }).lean();
      if (!counter) throw new Error("Mongo indexes and counters must be initialized before serving traffic");
      const result = { ...message, seq: counter.value, createdAt: new Date().toISOString() };
      await this.db.models.messages.create([result], { session });
      return result;
    });
  }
  async latestSeq(tripId: string) { return (await this.db.models.messages.findOne({ tripId }).sort({ seq: -1 }).lean())?.seq ?? 0; }
  async createSuggestion(suggestion: NewAgentSuggestion) {
    const now = new Date().toISOString();
    const result = { ...suggestion, status: "pending" as const, appliedBy: null, appliedAt: null, createdAt: now, updatedAt: now };
    await this.db.transaction(async session => {
      if (!await this.db.models.trips.exists({ id: suggestion.tripId }).session(session)) throw new DomainError("trip_not_found", "Trip not found");
      await this.db.models.suggestions.create([result], { session });
    });
    return result;
  }
  async findSuggestion(id: string) { return this.db.models.suggestions.findOne({ id }, { _id: 0 }).lean(); }
  async listActiveSuggestions(tripId: string, userId: string, updatedAfter: string) {
    const dismissed = await this.db.models.dismissals.distinct("suggestionId", { userId });
    return this.db.models.suggestions.find({ tripId, $or: [{ status: "pending", id: { $nin: dismissed }, $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date().toISOString() } }] }, { updatedAt: { $gt: updatedAfter } }] }, { _id: 0 }).sort({ createdAt: 1 }).lean();
  }
  async claimForApply(id: string, userId: string) {
    const now = new Date().toISOString();
    return (await this.db.models.suggestions.updateOne({ id, status: "pending", $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] }, { $set: { status: "applied", appliedBy: userId, appliedAt: now, updatedAt: now } }, { runValidators: true })).modifiedCount > 0;
  }
  async setStatus(id: string, status: "pending" | "stale" | "expired") { await this.db.models.suggestions.updateOne({ id }, { $set: { status, updatedAt: new Date().toISOString() } }, { runValidators: true }); }
  async dismissForUser(id: string, userId: string) {
    if (!await this.db.models.suggestions.exists({ id })) throw new DomainError("suggestion_not_found", "Suggestion not found");
    await this.db.models.dismissals.updateOne({ suggestionId: id, userId }, { $setOnInsert: { dismissedAt: new Date() } }, { upsert: true, runValidators: true }); }
}
