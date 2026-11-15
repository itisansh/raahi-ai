import type { TripChange } from "./types";

/** Driven port implemented by the Node WebSocket publisher. */
export interface TripChangePublisher {
  publish(change: TripChange): Promise<void>;
}

