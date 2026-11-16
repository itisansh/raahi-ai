import type { UserPreferenceRepository } from "../../services/rules/preferences/ports";
import { DomainError } from "../../services/rules/shared/errors";
import type { MongoDatabase } from "../connection";

export class MongoUserPreferenceRepository implements UserPreferenceRepository {
  constructor(private db: MongoDatabase) {}
  async findByUserId(userId: string) {
    const row = await this.db.models.preferences.findOne({ userId }).lean();
    return { userId, plannerSidebar: { width: row?.width ?? 30, collapsed: row?.collapsed ?? false }, agentPanelCollapsed: row?.agentPanelCollapsed ?? true, updatedAt: row?.updatedAt ?? new Date() };
  }
  private async update(userId: string, fields: { width?: number; collapsed?: boolean; agentPanelCollapsed?: boolean }) {
    const user = await this.db.connection.db!.collection<{ _id: string }>("user").findOne({ _id: userId }, { projection: { _id: 1 } });
    if (!user) throw new DomainError("user_not_found", "User not found");
    // Only the fields being changed are written: simultaneous panel changes survive.
    const row = await this.db.models.preferences.findOneAndUpdate({ userId }, { $set: { ...fields, updatedAt: new Date() } }, { upsert: true, returnDocument: "after", runValidators: true }).lean();
    return { userId, plannerSidebar: { width: row!.width, collapsed: row!.collapsed }, agentPanelCollapsed: row!.agentPanelCollapsed, updatedAt: row!.updatedAt };
  }
  async updatePlannerSidebar(userId: string, width: number, collapsed: boolean) { return this.update(userId, { width, collapsed }); }
  async updateAgentPanel(userId: string, collapsed: boolean) { return this.update(userId, { agentPanelCollapsed: collapsed }); }
}
