import { DomainError } from "./rules/shared/errors";
import { NotFoundError } from "./rules/shared/errors";
import type { CoverImageProvider } from "./rules/cover";
import {
  Trip,
  type AddExpenseDraft,
  type CreateTripDraft,
  type InsertStopDraft,
  type MoveStopDraft,
  type TripOwner,
  type TripRepository,
  type TripSummary,
  type UpdateDayDraft,
  type UpdateStopDraft,
} from "./rules/trip";
import { toTripDto, type TripDto } from "./dto";
import type { GeoService } from "./geo/geo-service";
import {
  createTripChange,
  type TripChangePublisher,
  type TripChangeScope,
} from "./rules/realtime";

/** Thrown when a user tries to act on a trip they cannot access or mutate. */
export class ForbiddenError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Read-side and command use cases for the Trip aggregate. Every method takes
 * the acting user id so access and mutation permissions can be enforced. */
export class TripService {
  constructor(
    private repo: TripRepository,
    private coverImages: CoverImageProvider | null = null,
    private geo: GeoService | null = null,
    private changes: TripChangePublisher | null = null,
  ) {}

  /** Realtime is an invalidation hint after a committed write. A transport
   * outage must not turn an already-committed mutation into an HTTP failure. */
  private async publishChange(
    trip: Trip,
    actorId: string,
    scopes: readonly TripChangeScope[],
  ): Promise<void> {
    if (!this.changes) return;
    const snapshot = trip.toSnapshot();
    try {
      await this.changes.publish(
        createTripChange({
          eventId: crypto.randomUUID(),
          tripId: snapshot.id,
          revision: snapshot.version,
          actorId,
          occurredAt: new Date().toISOString(),
          scopes,
        }),
      );
    } catch (error) {
      console.error("Failed to publish realtime trip change", {
        tripId: snapshot.id,
        revision: snapshot.version,
        error,
      });
    }
  }

  private async load(tripId: string): Promise<Trip> {
    const trip = await this.repo.findById(tripId);
    if (!trip) {
      throw new NotFoundError("trip_not_found", `Trip ${tripId} not found`);
    }
    return trip;
  }

  /** Load a trip the user is allowed to read, else 404 (do not leak existence). */
  private async loadReadable(tripId: string, userId: string): Promise<Trip> {
    const trip = await this.load(tripId);
    if (!trip.permissionsFor(userId).isMember) {
      throw new NotFoundError("trip_not_found", `Trip ${tripId} not found`);
    }
    return trip;
  }

  /** Load a trip the user may mutate, else 403 for read-only members. */
  private async loadEditable(tripId: string, userId: string): Promise<Trip> {
    const trip = await this.load(tripId);
    const perms = trip.permissionsFor(userId);
    if (!perms.isMember) {
      throw new NotFoundError("trip_not_found", `Trip ${tripId} not found`);
    }
    if (!perms.canEdit) {
      throw new ForbiddenError(
        "insufficient_permissions",
        "You do not have permission to edit this trip",
      );
    }
    return trip;
  }

  /** Assert the user may mutate the trip (used by media uploads and similar). */
  async assertEditable(tripId: string, userId: string): Promise<void> {
    await this.loadEditable(tripId, userId);
  }

  /** Assert trip membership without returning or mutating trip data. */
  async assertReadable(tripId: string, userId: string): Promise<void> {
    await this.loadReadable(tripId, userId);
  }

  listTrips(userId: string): Promise<TripSummary[]> {
    return this.repo.findSummaries(userId);
  }

  async createTrip(draft: CreateTripDraft, owner: TripOwner): Promise<TripDto> {
    const destination = draft.destination?.trim();
    const coverUrl =
      destination && this.coverImages
        ? await this.coverImages.searchLandscape(destination)
        : null;

    let destinationLat: number | undefined;
    let destinationLng: number | undefined;
    if (destination && this.geo && destination.length >= 2) {
      try {
        const places = await this.geo.placeSearch({
          query: destination,
          limit: 1,
        });
        const first = places[0];
        if (first) {
          destinationLat = first.lat;
          destinationLng = first.lng;
        }
      } catch {
        // Geo is best-effort; trip create must not fail when search is down.
      }
    }

    const trip = Trip.create(
      { ...draft, coverUrl, destinationLat, destinationLng },
      owner,
    );
    await this.repo.create(trip);
    return toTripDto(trip, owner.id);
  }

  async renameTrip(
    tripId: string,
    title: string,
    userId: string,
  ): Promise<TripDto> {
    const trip = await this.loadEditable(tripId, userId);
    trip.rename(title);
    await this.repo.rename(tripId, trip.toSnapshot().title);
    await this.publishChange(trip, userId, ["trip"]);
    return toTripDto(trip, userId);
  }

  /** Clear the one-shot agent seed flag after the member sends the suggested prompt. */
  async clearAgentSeedPending(
    tripId: string,
    userId: string,
  ): Promise<TripDto> {
    const trip = await this.loadEditable(tripId, userId);
    if (trip.toSnapshot().agentSeedPending) {
      trip.clearAgentSeedPending();
      await this.repo.clearAgentSeedPending(tripId);
      await this.publishChange(trip, userId, ["trip"]);
    }
    return toTripDto(trip, userId);
  }

  async addDay(tripId: string, userId: string): Promise<TripDto> {
    const trip = await this.loadEditable(tripId, userId);
    const day = trip.addDay();
    await this.repo.addDay(tripId, day);
    await this.publishChange(trip, userId, ["days"]);
    return toTripDto(trip, userId);
  }

  async updateDay(
    tripId: string,
    dayNumber: number,
    draft: UpdateDayDraft,
    userId: string,
  ): Promise<TripDto> {
    const trip = await this.loadEditable(tripId, userId);
    const day = trip.updateDay(dayNumber, draft);
    await this.repo.updateDay(tripId, day);
    await this.publishChange(trip, userId, ["days"]);
    return toTripDto(trip, userId);
  }

  async reorderDays(
    tripId: string,
    order: number[],
    userId: string,
  ): Promise<TripDto> {
    const trip = await this.loadEditable(tripId, userId);
    const expectedVersion = trip.toSnapshot().version;
    trip.reorderDays(order);
    await this.repo.reorderDays(trip, expectedVersion);
    await this.publishChange(trip, userId, ["days", "stops"]);
    return toTripDto(trip, userId);
  }

  async deleteDay(
    tripId: string,
    dayNumber: number,
    userId: string,
  ): Promise<TripDto> {
    const trip = await this.loadEditable(tripId, userId);
    const expectedVersion = trip.toSnapshot().version;
    trip.deleteDay(dayNumber);
    await this.repo.deleteDay(trip, expectedVersion);
    await this.publishChange(trip, userId, ["days", "stops"]);
    return toTripDto(trip, userId);
  }

  async getTrip(tripId: string, userId: string): Promise<TripDto> {
    const trip = await this.loadReadable(tripId, userId);
    await this.ensureDestinationCenter(trip);
    return toTripDto(trip, userId);
  }

  /** Read-only planning context; unlike getTrip, never backfills coordinates. */
  async getPlanningContext(tripId: string, userId: string) {
    const trip = await this.loadReadable(tripId, userId);
    const snapshot = trip.toSnapshot();
    return { tripId, revision: snapshot.version, title: snapshot.title, intake: snapshot.intake, days: snapshot.days, canEdit: trip.permissionsFor(userId).canEdit, existingPlan: { days: snapshot.days, stops: snapshot.stops, startDate: snapshot.startDate, currency: snapshot.currency } };
  }

  /** Backfill intake.destinationLat/Lng for older trips that only stored a label. */
  private async ensureDestinationCenter(trip: Trip): Promise<void> {
    if (!this.geo) return;
    const intake = trip.toSnapshot().intake;
    const destination = intake?.destination?.trim();
    if (!destination || destination.length < 2) return;
    if (
      typeof intake?.destinationLat === "number" &&
      typeof intake?.destinationLng === "number"
    ) {
      return;
    }
    try {
      const places = await this.geo.placeSearch({
        query: destination,
        limit: 1,
      });
      const first = places[0];
      if (!first) return;
      if (!trip.setDestinationCenter(first.lat, first.lng)) return;
      await this.repo.updateIntake(trip.toSnapshot().id, trip.toSnapshot().intake);
    } catch {
      // Best-effort; map can still Photon-geocode on the client.
    }
  }

  async insertStop(
    tripId: string,
    draft: InsertStopDraft,
    userId: string,
  ): Promise<TripDto> {
    const trip = await this.loadEditable(tripId, userId);
    const expectedVersion = trip.toSnapshot().version;
    trip.insertStop(draft, trip.actingMemberId(userId));
    await this.repo.save(trip, expectedVersion);
    await this.publishChange(trip, userId, ["stops"]);
    return toTripDto(trip, userId);
  }

  async updateStop(
    tripId: string,
    stopId: string,
    draft: UpdateStopDraft,
    userId: string,
  ): Promise<TripDto> {
    const trip = await this.loadEditable(tripId, userId);
    const expectedVersion = trip.toSnapshot().version;
    trip.updateStop(stopId, draft);
    await this.repo.save(trip, expectedVersion);
    await this.publishChange(trip, userId, ["stops"]);
    return toTripDto(trip, userId);
  }

  async moveStop(
    tripId: string,
    draft: MoveStopDraft,
    userId: string,
  ): Promise<TripDto> {
    const trip = await this.loadEditable(tripId, userId);
    const expectedVersion = trip.toSnapshot().version;
    trip.moveStop(draft);
    await this.repo.save(trip, expectedVersion);
    await this.publishChange(trip, userId, ["stops"]);
    return toTripDto(trip, userId);
  }

  async toggleVote(
    tripId: string,
    stopId: string,
    userId: string,
  ): Promise<TripDto> {
    const trip = await this.loadEditable(tripId, userId);
    const expectedVersion = trip.toSnapshot().version;
    trip.toggleVote(stopId, trip.actingMemberId(userId));
    await this.repo.save(trip, expectedVersion);
    await this.publishChange(trip, userId, ["stops"]);
    return toTripDto(trip, userId);
  }

  async addComment(
    tripId: string,
    stopId: string,
    text: string,
    userId: string,
  ): Promise<TripDto> {
    const trip = await this.loadEditable(tripId, userId);
    const expectedVersion = trip.toSnapshot().version;
    trip.addComment(stopId, trip.actingMemberId(userId), text);
    await this.repo.save(trip, expectedVersion);
    await this.publishChange(trip, userId, ["stops", "comments"]);
    return toTripDto(trip, userId);
  }

  async addExpense(
    tripId: string,
    draft: AddExpenseDraft,
    userId: string,
  ): Promise<TripDto> {
    const mutate = (trip: Trip) => {
      const permissions = trip.permissionsFor(userId);
      if (!permissions.isMember) throw new NotFoundError("trip_not_found", "Trip not found");
      if (!permissions.canEdit) throw new ForbiddenError("insufficient_permissions", "You cannot edit this trip");
      const snapshot = trip.toSnapshot();
      const id = draft.requestId ? `expense:${tripId}:${userId}:${draft.requestId}` : null;
      const canonical = (e: { description: string; amount: number; currency?: string; category?: string; payer: string; participants: string[]; allocations?: Record<string, number> }) => JSON.stringify([e.description.trim(), e.amount, e.currency || snapshot.currency, e.category || "Plan", e.payer, [...e.participants].sort(), Object.entries(e.allocations ?? {}).sort()]);
      const existing = id ? snapshot.expenses.find(e => e.id === id) : null;
      if (existing) {
        if (canonical(existing) !== canonical(draft)) throw new DomainError("expense_request_reused", "This save request already has different expense details");
        return;
      }
      const expense = trip.addExpense(draft);
      if (id) expense.id = id;
    };
    if (this.repo.mutateExpense) {
      const trip = await this.repo.mutateExpense(tripId, mutate);
      await this.publishChange(trip, userId, ["expenses"]);
      return toTripDto(trip, userId);
    }
    const trip = await this.loadEditable(tripId, userId);
    const expectedVersion = trip.toSnapshot().version;
    mutate(trip);
    await this.repo.save(trip, expectedVersion);
    await this.publishChange(trip, userId, ["expenses"]);
    return toTripDto(trip, userId);
  }

  async updateExpense(
    tripId: string,
    expenseId: string,
    draft: AddExpenseDraft,
    userId: string,
  ): Promise<TripDto> {
    const mutate = (trip: Trip) => {
      const permissions = trip.permissionsFor(userId);
      if (!permissions.isMember) throw new NotFoundError("trip_not_found", "Trip not found");
      if (!permissions.canEdit) throw new ForbiddenError("insufficient_permissions", "You cannot edit this trip");
      trip.updateExpense(expenseId, draft);
    };
    const trip = this.repo.mutateExpense ? await this.repo.mutateExpense(tripId, mutate) : await this.loadEditable(tripId, userId);
    const expectedVersion = trip.toSnapshot().version;
    if (!this.repo.mutateExpense) { mutate(trip); await this.repo.save(trip, expectedVersion); }
    await this.publishChange(trip, userId, ["expenses"]);
    return toTripDto(trip, userId);
  }
}
