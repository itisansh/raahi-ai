import type { PendingPatch } from "../rules/agent";
import type { Trip } from "../rules/trip";

export type TripPatchApplyResult<TDto> =
  | { ok: true; summary: string; trip: TDto }
  | { ok: false; error: string };

/**
 * Serialize AI SDK parallel tool executes onto one in-memory Trip for the
 * lifetime of a single chat request.
 *
 * Serialize patches against one working aggregate rather than allowing
 * parallel tool calls to overwrite each other with independently loaded copies.
 */
export function createSequentialTripPatchApplier<TDto>(options: {
  loadEditable: () => Promise<Trip>;
  apply: (
    trip: Trip,
    patch: PendingPatch,
  ) => Promise<{ ok: true; summary: string } | { ok: false; error: string }>;
  toDto: (trip: Trip) => TDto;
}): (patch: PendingPatch) => Promise<TripPatchApplyResult<TDto>> {
  let working: Trip | null = null;
  let patchQueue: Promise<void> = Promise.resolve();

  return (patch: PendingPatch) => {
    const run = async (): Promise<TripPatchApplyResult<TDto>> => {
      try {
        if (!working) {
          working = await options.loadEditable();
        }
        const result = await options.apply(working, patch);
        if (!result.ok) return result;
        return {
          ok: true,
          summary: result.summary,
          trip: options.toDto(working),
        };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to apply trip change";
        return { ok: false, error: message };
      }
    };

    const result = patchQueue.then(run, run);
    patchQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
}
