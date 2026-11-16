import { describe, expect, it } from "vitest";
import { Trip } from "../src/services/rules/trip";
import { SAMPLE_TRIP_ID } from "../src/services/user/provision-sample-trip";
import { seedTrips } from "../src/db/seed-data";

describe("Indian onboarding demo", () => {
  it("uses a new template identity, Indian coordinates and labelled estimates without fake payments", () => {
    const demo = seedTrips()[0]!.snapshot;
    expect(demo.id).toBe(SAMPLE_TRIP_ID);
    expect(demo.id).not.toBe("japan-2025");
    expect(demo.currency).toBe("INR");
    expect(demo.days).toHaveLength(6);
    expect(demo.expenses).toEqual([]);
    for (const stop of demo.stops) {
      expect(stop.lat).toBeGreaterThan(26);
      expect(stop.lat).toBeLessThan(31);
      expect(stop.lng).toBeGreaterThan(78);
      expect(stop.lng).toBeLessThan(81);
      expect(stop.note).toContain("SIMULATED_DEMO");
      expect(demo.days.some(day => day.number === stop.day)).toBe(true);
    }
  });

  it("clones the new demo without modifying the shared template", () => {
    const source = seedTrips()[0]!.snapshot;
    const before = structuredClone(source);
    const clone = Trip.cloneFromTemplate(Trip.fromSnapshot(source), { id: "new-user", name: "Traveler" });
    expect(source).toEqual(before);
    expect(clone.toSnapshot().id).not.toBe(SAMPLE_TRIP_ID);
    expect(clone.toSnapshot().currency).toBe("INR");
    expect(clone.toSnapshot().ownerId).toBe("new-user");
  });
});
