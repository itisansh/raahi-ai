import type { ClientSession } from "mongoose";
import { Trip, memberInitials, memberShortName, type TripRepository, type TripSummary, type TripSnapshot, type MemberSnapshot, type DaySnapshot, type TripIntake } from "../../domain/trip";
import { DomainError } from "../../domain/shared/errors";
import { expenseMinor, expenseScale, expenseAllocations } from "../../domain/trip/expense-money";
import type { MongoDatabase } from "../../config/db";
import type { MemberProfileUpdate, SyncedMemberTrip } from "../../services/user/profile-projection-service";

export const conflict = () => new DomainError("trip_write_conflict", "Trip changed. Reload it before saving again.");
/** All compound reads use one snapshot; all compound writes contend on the trip revision. */
export class MongoTripRepository implements TripRepository {
  constructor(readonly db: MongoDatabase, readonly session?: ClientSession) {}
  private transaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
    return this.session ? work(this.session) : this.db.transaction(work);
  }
  async bump(id: string, session: ClientSession, expectedVersion?: number) {
    const row = await this.db.models.trips.findOneAndUpdate({ id, ...(expectedVersion === undefined ? {} : { version: expectedVersion }) }, { $inc: { version: 1 } }, { session, returnDocument: "after", runValidators: true }).lean();
    if (!row) throw conflict();
    return row.version;
  }
  async findById(id: string): Promise<Trip | null> {
    return this.transaction(async session => {
      const m = this.db.models;
      const base = await m.trips.findOne({ id }).session(session).lean();
      if (!base) return null;
      const members = await m.members.find({ tripId: id }, { _id: 0, tripId: 0, order: 0 }).sort({ order: 1 }).session(session).lean();
      const days = await m.days.find({ tripId: id }, { _id: 0, tripId: 0 }).sort({ number: 1 }).session(session).lean();
      const stops = await m.stops.find({ tripId: id }, { _id: 0, tripId: 0 }).sort({ order: 1 }).session(session).lean();
      const votes = await m.votes.find({ tripId: id }).session(session).lean();
      const comments = await m.comments.find({ tripId: id }).sort({ order: 1 }).session(session).lean();
      const expenses = await m.expenses.find({ tripId: id }).sort({ createdOrder: 1 }).session(session).lean();
      return Trip.fromSnapshot({ id: base.id, title: base.title, status: base.status, currency: base.currency, version: base.version, startDate: base.startDate, endDate: base.endDate, ownerId: base.ownerId, coverUrl: base.coverUrl, intake: base.intake, agentSeedPending: base.agentSeedPending, members, days,
        stops: stops.map(s => ({ ...s, votes: votes.filter(v => v.stopId === s.id).map(v => v.memberId), comments: comments.filter(c => c.stopId === s.id).map(c => ({ author: c.author, timeLabel: c.timeLabel, text: c.text })) })),
        expenses: expenses.map(e => ({ id: e.id, description: e.description, payer: e.payer, amount: e.amountMinor / e.scale, currency: e.currency, category: e.category, participants: e.participants, whenLabel: e.whenLabel, createdOrder: e.createdOrder, ...(e.allocations ? { allocations: Object.fromEntries(Object.entries(e.allocations).map(([id, value]) => [id, value / e.scale])) } : {}) })),
      });
    });
  }
  async findSummaries(userId: string): Promise<TripSummary[]> {
    return this.transaction(async session => {
      const m = this.db.models;
      const real = await m.members.find({ userId: { $type: "string" } }).session(session).lean();
      const own = real.filter(member => member.userId === userId).map(member => member.tripId);
      const rows = await m.trips.find({ $or: [{ id: { $in: own } }, { id: { $nin: real.map(member => member.tripId) } }] }).sort({ createdAt: -1 }).session(session).lean();
      const summaries: TripSummary[] = [];
      for (const row of rows) {
        const s = (await new MongoTripRepository(this.db, session).findById(row.id))!.toSnapshot();
        const members = [...s.members].sort((a, b) => Number(b.id === s.ownerId) - Number(a.id === s.ownerId));
        const located = s.stops.find(stop => !stop.transit);
        summaries.push({ id: s.id, title: s.title, startLabel: s.startDate, endLabel: s.endDate, status: s.status, currency: s.currency, coverColor: row.coverColor, coverUrl: s.coverUrl, memberCount: members.length, stopCount: s.stops.length, createdAt: row.createdAt.toISOString(), creatorName: members[0]?.name ?? "", members: members.map(({ id, name, initials, avatarBg, avatarFg, image, isCurrentUser }) => ({ id, name, initials, avatarBg, avatarFg, image, isCurrentUser })), location: located ? { lat: located.lat, lng: located.lng } : null });
      }
      return summaries;
    });
  }
  async create(trip: Trip): Promise<void> {
    await this.transaction(async session => {
      const { members, days, stops, expenses, ...base } = trip.toSnapshot();
      const m = this.db.models;
      await m.trips.create([{ ...base, coverColor: days[0]?.color ?? "#3f6fc9" }], { session });
      for (const [order, member] of members.entries()) await m.members.create([{ ...member, tripId: base.id, order }], { session });
      for (const day of days) await m.days.create([{ ...day, tripId: base.id }], { session });
      await this.writeStops({ ...base, members, days, stops, expenses }, session);
      await this.writeExpenses({ ...base, members, days, stops, expenses }, session);
    });
  }
  async addMember(tripId: string, member: MemberSnapshot) {
    await this.transaction(async session => {
      await this.bump(tripId, session);
      const m = this.db.models.members;
      if (member.userId && await m.exists({ tripId, userId: member.userId }).session(session)) return;
      const last = await m.findOne({ tripId }).sort({ order: -1 }).session(session).lean();
      await m.create([{ ...member, tripId, order: (last?.order ?? -1) + 1 }], { session });
    });
  }
  async syncMemberProfile(userId: string, profile: MemberProfileUpdate): Promise<SyncedMemberTrip[]> {
    if (profile.name === undefined && profile.image === undefined) return [];
    return this.transaction(async session => {
      const tripIds = await this.db.models.members.distinct("tripId", { userId }).session(session);
      const result: SyncedMemberTrip[] = [];
      for (const tripId of tripIds.sort()) {
        const revision = await this.bump(tripId, session);
        await this.db.models.members.updateMany({ tripId, userId }, { $set: { ...(profile.name === undefined ? {} : { name: profile.name, shortName: memberShortName(profile.name), initials: memberInitials(profile.name) }), ...(profile.image === undefined ? {} : { image: profile.image }) } }, { session, runValidators: true });
        result.push({ tripId, revision });
      }
      return result;
    });
  }
  async rename(id: string, title: string) { await this.updateBase(id, { title }); }
  async clearAgentSeedPending(id: string) { await this.updateBase(id, { agentSeedPending: false }); }
  async updateIntake(id: string, intake: TripIntake | null) { await this.updateBase(id, { intake }); }
  private async updateBase(id: string, fields: Partial<Pick<TripSnapshot, "title" | "intake" | "agentSeedPending">>) {
    const result = await this.db.models.trips.updateOne({ id }, { $set: fields, $inc: { version: 1 } }, { session: this.session, runValidators: true });
    if (!result.matchedCount) throw conflict();
  }
  async addDay(tripId: string, day: DaySnapshot) {
    await this.transaction(async session => {
      await this.bump(tripId, session);
      await this.db.models.days.updateOne({ tripId, number: day.number }, { $setOnInsert: day }, { session, upsert: true, runValidators: true });
    });
  }
  async updateDay(tripId: string, day: DaySnapshot) {
    await this.transaction(async session => {
      await this.bump(tripId, session);
      await this.db.models.days.updateOne({ tripId, number: day.number }, { $set: day }, { session, runValidators: true });
    });
  }
  async reorderDays(trip: Trip, expectedVersion: number) {
    await this.transaction(async session => {
      const s = trip.toSnapshot();
      await this.bump(s.id, session, expectedVersion);
      await this.db.models.days.deleteMany({ tripId: s.id }, { session });
      for (const day of s.days) await this.db.models.days.create([{ ...day, tripId: s.id }], { session });
      await this.writeStops(s, session);
    });
  }
  async deleteDay(trip: Trip, expectedVersion: number) { await this.reorderDays(trip, expectedVersion); }
  async save(trip: Trip, expectedVersion: number) {
    await this.transaction(async session => {
      const s = trip.toSnapshot();
      await this.bump(s.id, session, expectedVersion);
      await this.writeStops(s, session);
      await this.writeExpenses(s, session);
    });
  }
  async mutateExpense(tripId: string, mutate: (trip: Trip) => void): Promise<Trip> {
    return this.transaction(async session => {
      const trip = await new MongoTripRepository(this.db, session).findById(tripId);
      if (!trip) throw new DomainError("trip_not_found", "Trip not found");
      const version = trip.toSnapshot().version;
      mutate(trip);
      if (trip.toSnapshot().version !== version) {
        await this.bump(tripId, session, version);
        await this.writeExpenses(trip.toSnapshot(), session);
      }
      return trip;
    });
  }
  async removeStops(tripId: string, ids: string[], session: ClientSession) {
    const m = this.db.models;
    await m.reservations.updateMany({ tripId, stopId: { $in: ids } }, { $set: { stopId: null } }, { session, runValidators: true });
    await m.votes.deleteMany({ tripId, stopId: { $in: ids } }, { session });
    await m.comments.deleteMany({ tripId, stopId: { $in: ids } }, { session });
    await m.stops.deleteMany({ tripId, id: { $in: ids } }, { session });
  }
  private async writeStops(s: TripSnapshot, session: ClientSession) {
    const m = this.db.models;
    const removed = await m.stops.find({ tripId: s.id, id: { $nin: s.stops.map(stop => stop.id) } }).session(session).lean();
    await this.removeStops(s.id, removed.map(stop => stop.id), session);
    for (const { votes, comments, ...stop } of s.stops) {
      if (!s.days.some(day => day.number === stop.day)) throw new DomainError("invalid_day", "Stop day does not exist");
      await m.stops.updateOne({ id: stop.id, tripId: s.id }, { $set: stop }, { session, upsert: true, runValidators: true });
      await m.votes.deleteMany({ tripId: s.id, stopId: stop.id }, { session });
      await m.comments.deleteMany({ tripId: s.id, stopId: stop.id }, { session });
      for (const memberId of votes) await m.votes.create([{ tripId: s.id, stopId: stop.id, memberId }], { session });
      for (const [order, comment] of comments.entries()) await m.comments.create([{ ...comment, tripId: s.id, stopId: stop.id, order }], { session });
    }
  }
  private async writeExpenses(s: TripSnapshot, session: ClientSession) {
    for (const { amount, ...expense } of s.expenses) {
      if (![expense.payer, ...expense.participants].every(id => s.members.some(m => m.id === id))) throw new DomainError("invalid_participants", "Expense member does not exist");
      const currency = expense.currency || s.currency;
      const amountMinor = expenseMinor(amount, currency);
      const allocations = expense.allocations ? expenseAllocations(amount, currency, expense.participants, expense.allocations) : undefined;
      await this.db.models.expenses.updateOne({ id: expense.id, tripId: s.id }, {
        $set: { ...expense, allocations, amountMinor, scale: expenseScale(currency) },
        ...(allocations === undefined ? { $unset: { allocations: 1 } } : {}),
      }, { session, upsert: true, runValidators: true });
    }
  }
}
