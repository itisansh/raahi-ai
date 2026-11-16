import { expect, it, vi, describe } from "vitest";
import { MedicalService, indianDialNumber, medicalRequestSchema } from "../src/services/medical/medical-service";
import { Trip } from "../src/services/rules/trip";
import { createApp } from "./http-app";
import type { Container } from "../src/config/container";
function fixture() {
  const trip = Trip.create({ title: "Medical fixture" }, { id: "owner", name: "Owner" });
  trip.insertStop({ day: 1, index: 0, time: "10:00", name: "Chopta", area: "Uttarakhand", category: "Sight", lat: 30.49, lng: 79.16 }, trip.toSnapshot().members[0]!.id);
  const placeNearby = vi.fn(async () => [{ id: "test-hospital", name: "Simulated listing", label: "Simulated address", lat: 30.5, lng: 79.16, categories: ["hospital"], phone: "+91 98765 43210", openingHours: ["Mo-Fr 09:00-17:00"] }]);
  const load = vi.fn(async () => trip.toSnapshot());
  const service = new MedicalService(load, { placeNearby }, "osm", { consume: async () => true });
  const request = { category: "hospital", radiusMeters: 5000, location: { kind: "stop", stopId: trip.toSnapshot().stops[0]!.id } };
  return { trip, placeNearby, load, service, request };
}
describe("medical listings", () => {
  it("returns sourced listings, a safe dial number and unknown operating status", async () => {
    const f = fixture(); const result = await f.service.search("trip", "owner", f.request);
    expect(result.status).toBe("listings"); expect(result.emergencyCapacity).toBe("unknown"); expect(result.openingStatus).toBe("unknown"); expect(result.observedAt).toBeNull();
    expect(result.places[0]).toMatchObject({ name: "Simulated listing", category: "hospital", phone: "+919876543210" });
    expect(result.places[0]!.distanceMeters).toBeGreaterThan(0);
    expect(f.placeNearby).toHaveBeenCalledWith(expect.objectContaining({ categories: ["amenity=hospital", "healthcare=hospital"], radiusMeters: 5000 }));
  });
  it.each([
    ["Jaipur", 26.9124, 75.7873], ["Kochi", 9.9312, 76.2673],
    ["Panaji", 15.4909, 73.8278], ["Shillong", 25.5788, 91.8933],
    ["Port Blair", 11.6234, 92.7265],
  ])("searches near saved stops across India: %s", async (name, lat, lng) => {
    const f = fixture();
    const stop = f.trip.toSnapshot().stops[0]!;
    Object.assign(stop, { name, lat, lng });
    f.placeNearby.mockResolvedValueOnce([]);
    const result = await f.service.search("trip", "owner", f.request);
    expect(result.status).toBe("empty");
    expect(f.placeNearby).toHaveBeenCalledWith(expect.objectContaining({ lat, lng }));
  });
  it("checks trip permission before places access", async () => {
    const f = fixture(); f.load.mockRejectedValueOnce(new Error("forbidden"));
    await expect(f.service.search("trip", "outsider", f.request)).rejects.toThrow("forbidden"); expect(f.placeNearby).not.toHaveBeenCalled();
  });
  it("distinguishes empty from unavailable without claiming no facilities exist", async () => {
    const f = fixture(); f.placeNearby.mockResolvedValueOnce([]);
    expect((await f.service.search("trip", "owner", f.request)).status).toBe("empty");
    f.placeNearby.mockRejectedValueOnce(new Error("private provider detail"));
    expect((await f.service.search("trip", "owner", f.request)).status).toBe("unavailable");
  });
  it("rejects coordinates without explicit consent and unbounded radii", () => {
    expect(medicalRequestSchema.safeParse({ category: "hospital", radiusMeters: 5000, location: { kind: "gps", lat: 30, lng: 79 } }).success).toBe(false);
    expect(medicalRequestSchema.safeParse({ category: "hospital", radiusMeters: 100000, location: { kind: "gps", lat: 30, lng: 79, consent: true } }).success).toBe(false);
  });
  it("minimizes current-location precision without modifying the saved trip", async () => {
    const f = fixture(); const before = structuredClone(f.trip.toSnapshot());
    const result = await f.service.search("trip", "owner", { category: "hospital", radiusMeters: 5000, location: { kind: "gps", lat: 30.49012345, lng: 79.16012345, consent: true } });
    expect(result.location).toMatchObject({ lat: 30.4901, lng: 79.1601 }); expect(f.trip.toSnapshot()).toEqual(before);
  });
  it("filters incorrect categories and distant results", async () => {
    const f = fixture(); f.placeNearby.mockResolvedValueOnce([{ id: "test", name: "Simulated", label: "Fixture", lat: 27, lng: 80, categories: ["hospital"], phone: "", openingHours: [] }]);
    expect((await f.service.search("trip", "owner", f.request)).places).toEqual([]);
    f.placeNearby.mockResolvedValueOnce([{ id: "test", name: "Simulated", label: "Fixture", lat: 30.49, lng: 79.16, categories: ["hotel"], phone: "", openingHours: [] }]);
    expect((await f.service.search("trip", "owner", f.request)).places).toEqual([]);
  });
  it("limits upstream lookups and handles missing coordinates", async () => {
    const f = fixture(); const limited = new MedicalService(f.load, { placeNearby: f.placeNearby }, "osm", { consume: async () => false });
    await expect(limited.search("trip", "owner", f.request)).rejects.toMatchObject({ code: "medical_rate_limited" });
    expect(f.placeNearby).not.toHaveBeenCalled(); f.trip.toSnapshot().stops[0]!.lat = 0;
    expect((await f.service.search("trip", "owner", f.request)).status).toBe("location_unavailable");
  });
});
it("allows only complete numeric Indian phone formats", () => {
  expect(indianDialNumber("0135-1234567")).toBe("+911351234567");
  for (const value of [undefined, "112", "javascript:alert(1)", "+91 9876543210; +91 9999999999", "123", "0000000000"]) expect(indianDialNumber(value)).toBeNull();
});
it("enforces HTTP authentication and trusted origin without provider calls", async () => {
  const search = vi.fn(async () => ({ status: "empty", places: [] })); let authenticated = true;
  const app = createApp({ config: { trustedOrigins: ["https://web.test"] }, auth: { api: { getSession: async () => authenticated ? { user: { id: "actor" }, session: {} } : null } }, medicalService: { search }, agentService: null } as unknown as Container);
  const post = (origin = "https://web.test") => app.request("https://web.test/api/trips/trip/medical", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ category: "hospital" }) });
  expect((await post("https://evil.test")).status).toBe(403); expect(search).not.toHaveBeenCalled();
  expect((await post()).status).toBe(200); expect(search).toHaveBeenCalledWith("trip", "actor", { category: "hospital" });
  authenticated = false; expect((await post()).status).toBe(401);
});
