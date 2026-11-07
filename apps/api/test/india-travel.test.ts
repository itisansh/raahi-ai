import { describe, expect, it, vi } from "vitest";
import { IndiaTravelService } from "../src/services/travel/india-travel-service";
import { OpenMeteoTravelProvider } from "../src/integrations/travel/open-meteo-provider";
import { Trip } from "../src/domain/trip";
import { createApp } from "./http-app";
import type { Container } from "../src/config/container";
const now = () => Date.parse("2026-11-02T10:00:00Z");
const response = () => new Response(JSON.stringify({ daily: { time: ["2026-11-02"], temperature_2m_min: [9], temperature_2m_max: [20], precipitation_sum: [0.5] } }));
describe("Open-Meteo daily evidence", () => {
  it("uses the fixed forecast API, India timezone and shares a location fetch", async () => {
    const fetcher = vi.fn(async () => response()); const provider = new OpenMeteoTravelProvider(fetcher, now);
    const [a, b] = await Promise.all([provider.daily(30.49, 79.16, "2026-11-02"), provider.daily(30.49, 79.16, "2026-11-02")]);
    expect(a).toEqual(b); expect(a).toMatchObject({ status: "forecast", minC: 9, maxC: 20, precipitationMm: 0.5, observedAt: null, retrievedAt: "2026-11-02T10:00:00.000Z" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const url = new URL(String((fetcher.mock.calls as unknown as Array<[URL]>)[0]![0]));
    expect(url.origin).toBe("https://api.open-meteo.com"); expect(url.searchParams.get("timezone")).toBe("Asia/Kolkata");
    expect(url.searchParams.get("forecast_days")).toBe("16");
  });
  it("refuses invalid, past and far future dates without an API call", async () => {
    const fetcher = vi.fn(); const provider = new OpenMeteoTravelProvider(fetcher, now);
    for (const date of ["2026-02-30", "2020-01-01", "2099-01-01", "2026-11-18"]) expect((await provider.daily(30, 79, date)).status).toBe("outside_window");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("does not invent forecast data on missing entries or provider errors", async () => {
    const provider = new OpenMeteoTravelProvider(async () => new Response(JSON.stringify({ daily: { time: ["2026-11-02"], temperature_2m_min: [null], temperature_2m_max: [20], precipitation_sum: [0] } })), now);
    expect((await provider.daily(30, 79, "2026-11-02")).status).toBe("unavailable");
    const failed = new OpenMeteoTravelProvider(async () => new Response("private provider detail", { status: 429 }), now);
    expect(await failed.daily(30, 79, "2026-11-02")).toMatchObject({ status: "unavailable", retrievedAt: null });
  });
  it("expires cached forecasts instead of returning stale data as current", async () => {
    let time = now(); const fetcher = vi.fn(async () => response()); const provider = new OpenMeteoTravelProvider(fetcher, () => time);
    await provider.daily(30, 79, "2026-11-02"); time += 3600001;
    await provider.daily(30, 79, "2026-11-02"); expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
function fixture() {
  const trip = Trip.create({ title: "India fixture", currency: "INR", startDate: "2026-11-02", dayCount: 4 }, { id: "owner", name: "Owner" });
  const member = trip.toSnapshot().members[0]!.id;
  for (const [index, place] of [{ name: "Lucknow", lat: 26.85, lng: 80.95 }, { name: "Rishikesh", lat: 30.0869, lng: 78.2676 }, { name: "Chopta", lat: 30.49, lng: 79.16 }, { name: "Haridwar", lat: 29.9457, lng: 78.1642 }].entries()) trip.insertStop({ ...place, day: index + 1, index: 0, time: "10:00", area: "India", category: "Sight" }, member);
  const routeCompute = vi.fn(async () => ({ distanceMeters: 400000, durationSeconds: 30000, legs: [], mode: "driving" as const }));
  const placeNearby = vi.fn(async () => []);
  const load = vi.fn(async () => trip.toSnapshot());
  const service = new IndiaTravelService(load, { routeCompute, placeNearby }, "osm", null, { consume: async () => true });
  return { trip, load, routeCompute, placeNearby, service, ids: trip.toSnapshot().stops.map(s => s.id) };
}
describe("India travel evidence", () => {
  it("keeps route order, calls driving only, and labels unavailable scheduled transport", async () => {
    const f = fixture(); const result = await f.service.inspect("trip", "owner", f.ids);
    expect(result.road.status).toBe("road_estimate");
    expect(f.routeCompute).toHaveBeenCalledWith({ waypoints: f.trip.toSnapshot().stops.map(s => ({ lat: s.lat, lng: s.lng })), mode: "driving", includeGeometry: false });
    expect(result.nearby.status).toBe("empty"); expect(result.observedAt).toBeNull();
    expect(result.localTransport).toEqual({ status: "needs_confirmation", fares: null, schedules: null, availability: null });
    expect(result.links.every(l => l.status === "search_link")).toBe(true);
  });
  it("preserves official links when providers fail", async () => {
    const f = fixture(); f.routeCompute.mockRejectedValueOnce(new Error("private upstream detail")); f.placeNearby.mockRejectedValueOnce(new Error("offline"));
    const result = await f.service.inspect("trip", "owner", f.ids);
    expect(result.road.status).toBe("unavailable"); expect(result.nearby.status).toBe("unavailable"); expect(result.links.length).toBe(3);
  });
  it("checks permissions before provider calls, rejects unknown and repeated stops", async () => {
    const f = fixture(); f.load.mockRejectedValueOnce(new Error("forbidden"));
    await expect(f.service.inspect("trip", "outsider", f.ids)).rejects.toThrow("forbidden");
    expect(f.routeCompute).not.toHaveBeenCalled();
    await expect(f.service.inspect("trip", "owner", ["invented"])).rejects.toMatchObject({ code: "stop_not_found" });
    await expect(f.service.inspect("trip", "owner", [f.ids[0]!, f.ids[0]!])).rejects.toMatchObject({ code: "invalid_travel_stops" });
  });
  it("does not fetch data for missing or outside-India saved coordinates", async () => {
    const f = fixture(); f.trip.toSnapshot().stops[0]!.lat = 0;
    const result = await f.service.inspect("trip", "owner", [f.ids[0]!]);
    expect(result.locationStatus).toBe("location_unavailable"); expect(f.placeNearby).not.toHaveBeenCalled();
  });
});
it("requires authentication and trusted Origin and rejects client coordinates", async () => {
  const inspect = vi.fn(async () => ({})); let signedIn = true;
  const app = createApp({ config: { trustedOrigins: ["https://web.test"] }, auth: { api: { getSession: async () => signedIn ? { user: { id: "actor" }, session: {} } : null } }, indiaTravelService: { inspect }, agentService: null } as unknown as Container);
  const post = (body: unknown, origin = "https://web.test") => app.request("https://web.test/api/trips/trip/travel", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  expect((await post({ stopIds: ["one"], lat: 30 })).status).toBe(400);
  expect((await post({ stopIds: ["one"] }, "https://evil.test")).status).toBe(403);
  expect(inspect).not.toHaveBeenCalled();
  expect((await post({ stopIds: ["one"] })).status).toBe(200); expect(inspect).toHaveBeenCalledWith("trip", "actor", ["one"]);
  signedIn = false; expect((await post({ stopIds: ["one"] })).status).toBe(401);
});
it("labels an unknown date without inventing a forecast", async () => {
  const f = fixture(); f.trip.toSnapshot().days[0]!.date = "";
  const daily = vi.fn(); const service = new IndiaTravelService(f.load, { routeCompute: f.routeCompute, placeNearby: f.placeNearby }, "osm", { daily }, { consume: async () => true });
  expect((await service.inspect("trip", "owner", [f.ids[0]!])).weather.status).toBe("date_unknown");
  expect(daily).not.toHaveBeenCalled();
});
it("limits provider requests without substituting fake results", async () => {
  const f = fixture(); const service = new IndiaTravelService(f.load, { routeCompute: f.routeCompute, placeNearby: f.placeNearby }, "osm", null, { consume: async () => false });
  await expect(service.inspect("trip", "owner", f.ids)).rejects.toMatchObject({ code: "travel_rate_limited" });
  expect(f.routeCompute).not.toHaveBeenCalled(); expect(f.placeNearby).not.toHaveBeenCalled();
});
