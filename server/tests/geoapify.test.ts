import { afterEach, describe, expect, it, vi } from "vitest";
import { GeoapifyGeoProvider } from "../src/integrations/geo/geoapify/geoapify-geo-provider";
import { GeoService } from "../src/services/geo/geo-service";
import { MedicalService } from "../src/services/medical/medical-service";
import { Trip } from "../src/services/rules/trip";
import { createGeoProvider } from "../src/integrations/geo/create-geo-provider";
import { loadNodeConfig } from "../src/config/env";

const provider = () =>
  new GeoapifyGeoProvider({ apiKey: "private-test-key", timeoutMs: 30, cacheTtlMs: 10000 });

/** Minimal GeoJSON FeatureCollection feature builders for Indian cities */
const hospitalFeature = {
  properties: {
    place_id: "hospital-id", name: "Hospital", formatted: "Jaipur, Rajasthan",
    lat: 26.913, lon: 75.789, categories: ["healthcare.hospital"],
    contact: { phone: "+91 141 123 4567" }, opening_hours: "24/7",
  },
};
const clinicFeature = {
  properties: {
    place_id: "clinic-id", name: "City Clinic", formatted: "Pune, Maharashtra",
    lat: 18.521, lon: 73.857, categories: ["healthcare.clinic_or_praxis.doctor"],
    contact: { phone: "+91 20 2567 8901" },
  },
};
const pharmacyFeature = {
  properties: {
    place_id: "pharmacy-id", name: "MedPlus Pharmacy", formatted: "Chennai, Tamil Nadu",
    lat: 13.082, lon: 80.270, categories: ["healthcare.pharmacy"],
  },
};

afterEach(() => vi.restoreAllMocks());

describe("Geoapify provider", () => {
  it("requires a configured key and creates the selected Node config, picked by createGeoProvider", () => {
    const env = {
      MONGO_URI: "mongodb://localhost/test",
      BASE_URL: "http://localhost:5170",
      BETTER_AUTH_SECRET: "a".repeat(32),
      STORAGE_BACKEND: "fs",
      STORAGE_ROOT: "/tmp/uploads",
      GEO_PROVIDER: "geoapify",
    };
    expect(() => loadNodeConfig(env)).toThrow("GEOAPIFY_API_KEY");
    const cfg = loadNodeConfig({ ...env, GEOAPIFY_API_KEY: "key" });
    expect(cfg.geo).toMatchObject({ provider: "geoapify", geoapifyApiKey: "key" });
    expect(createGeoProvider(cfg.geo)).toBeInstanceOf(GeoapifyGeoProvider);
  });

  it("maps hospital category/contact and skips invalid coordinates; coalesces duplicate requests", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ features: [hospitalFeature, { properties: { ...hospitalFeature.properties, lat: 100 } }] })),
    );
    const p = provider();
    const query = { lat: 26.9124, lng: 75.7873, radiusMeters: 5000, categories: ["hospital"] };
    const [a, b] = await Promise.all([p.placeNearby(query), p.placeNearby(query)]);
    expect(a).toEqual(b);
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({
      id: "hospital-id",
      categories: ["healthcare.hospital", "hospital"],
      phone: "+91 141 123 4567",
      openingHours: ["24/7"],
    });
    // Single-flight: only one upstream call despite two concurrent callers
    expect(fetch).toHaveBeenCalledTimes(1);
    const url = new URL(String(fetch.mock.calls[0]![0]));
    expect(url.searchParams.get("filter")).toBe("circle:75.7873,26.9124,5000");
    expect(url.searchParams.get("categories")).toBe("healthcare.hospital");
  });

  it("maps clinic: healthcare.clinic_or_praxis subcategory normalises to 'clinic'", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ features: [clinicFeature] })),
    );
    const results = await provider().placeNearby({
      lat: 18.521, lng: 73.857, radiusMeters: 5000, categories: ["medical_clinic"],
    });
    expect(results).toHaveLength(1);
    // Both the raw Geoapify category AND the normalised alias must be present
    expect(results[0]!.categories).toContain("healthcare.clinic_or_praxis.doctor");
    expect(results[0]!.categories).toContain("clinic");
    // Category param sent upstream maps medical_clinic → healthcare.clinic_or_praxis
    const url = new URL(String((vi.mocked(globalThis.fetch).mock.calls[0]![0] as string)));
    expect(url.searchParams.get("categories")).toBe("healthcare.clinic_or_praxis");
  });

  it("maps pharmacy: healthcare.pharmacy normalises to 'pharmacy'", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ features: [pharmacyFeature] })),
    );
    const results = await provider().placeNearby({
      lat: 13.082, lng: 80.270, radiusMeters: 5000, categories: ["pharmacy"],
    });
    expect(results).toHaveLength(1);
    expect(results[0]!.categories).toContain("healthcare.pharmacy");
    expect(results[0]!.categories).toContain("pharmacy");
    const url = new URL(String((vi.mocked(globalThis.fetch).mock.calls[0]![0] as string)));
    expect(url.searchParams.get("categories")).toBe("healthcare.pharmacy");
  });

  it("placeSearch sends text, bias, and limit params; returns mapped places", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ features: [hospitalFeature] })),
    );
    const results = await provider().placeSearch({ query: "hospital Jaipur", near: { lat: 26.9, lng: 75.8 }, limit: 5 });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ id: "hospital-id", lat: 26.913, lng: 75.789 });
    const url = new URL(String((vi.mocked(globalThis.fetch).mock.calls[0]![0] as string)));
    expect(url.pathname).toBe("/v1/geocode/search");
    expect(url.searchParams.get("text")).toBe("hospital Jaipur");
    expect(url.searchParams.get("bias")).toMatch(/^proximity:/);
    expect(url.searchParams.get("limit")).toBe("5");
  });

  it("placeDetail fetches /v2/place-details with id+lang and returns first feature", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ features: [hospitalFeature] })),
    );
    const detail = await provider().placeDetail({ placeId: "hospital-id", lang: "hi" });
    expect(detail).toMatchObject({ id: "hospital-id", name: "Hospital" });
    const url = new URL(String((vi.mocked(globalThis.fetch).mock.calls[0]![0] as string)));
    expect(url.pathname).toBe("/v2/place-details");
    expect(url.searchParams.get("id")).toBe("hospital-id");
    expect(url.searchParams.get("lang")).toBe("hi");
  });

  it("placeDetail returns null when the feature collection is empty", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ features: [] })),
    );
    expect(await provider().placeDetail({ placeId: "unknown-id" })).toBeNull();
  });

  it("reviewLookup always returns unsupported without making a network request", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    const result = await provider().reviewLookup({ placeId: "hospital-id" });
    expect(result).toEqual({ placeId: "hospital-id", supported: false, reviews: [] });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not expose the API key or upstream response body on upstream error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("private-test-key", { status: 403 }));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(provider().placeSearch({ query: "Jaipur" })).rejects.toMatchObject({ code: "geo_failed" });
    expect(JSON.stringify(log.mock.calls)).not.toContain("private-test-key");
  });

  it("maps AbortError timeout and does not substitute an empty success", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      (_, init) => new Promise((_, reject) =>
        init!.signal!.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))),
      ),
    );
    await expect(provider().placeNearby({ lat: 26, lng: 75, radiusMeters: 5000 })).rejects.toMatchObject({ code: "geo_timeout" });
  });

  it("routeCompute: uses lat,lon waypoint order and preserves metres/seconds/geometry", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ features: [{ properties: { distance: 1200, time: 180, legs: [{ distance: 1200, time: 180 }], polyline5: "encoded" } }] })),
    );
    const route = await provider().routeCompute({ waypoints: [{ lat: 26, lng: 75 }, { lat: 27, lng: 76 }], includeGeometry: true });
    expect(route).toMatchObject({ distanceMeters: 1200, durationSeconds: 180, geometry: "encoded" });
    expect(new URL(String(fetch.mock.calls[0]![0])).searchParams.get("waypoints")).toBe("26,75|27,76");
  });

  it("routeMatrix: sends lon/lat in POST body and maps null cells to no_route", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ sources_to_targets: [[{ source_index: 0, target_index: 0, distance: 125, time: 40 }, null]] })),
    );
    const result = await provider().routeMatrix({ origins: [{ lat: 26, lng: 75 }], destinations: [{ lat: 27, lng: 76 }, { lat: 28, lng: 77 }] });
    expect(result.cells[1]).toEqual({ originIndex: 0, destinationIndex: 1, condition: "no_route" });
    expect(JSON.parse(fetch.mock.calls[0]![1]!.body as string).sources).toEqual([{ location: [75, 26] }]);
  });

  it("transit mode is unsupported for both routing operations", async () => {
    await expect(provider().routeCompute({ waypoints: [], mode: "transit" })).rejects.toMatchObject({ code: "geo_unsupported" });
    await expect(provider().routeMatrix({ origins: [], destinations: [], mode: "transit" })).rejects.toMatchObject({ code: "geo_unsupported" });
  });
});

describe("Geoapify + MedicalService integration", () => {
  function medicalFixture(geoFeature: { properties: Record<string, unknown> }) {
    const lat = geoFeature.properties.lat as number;
    const lng = geoFeature.properties.lon as number;
    const trip = Trip.create({ title: "Medical test" }, { id: "owner", name: "Owner" });
    trip.insertStop(
      { day: 1, index: 0, time: "09:00", name: "Test stop", area: "India", category: "Sight", lat, lng },
      trip.toSnapshot().members[0]!.id,
    );
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ features: [geoFeature] })),
    );
    const geoService = new GeoService(
      new GeoapifyGeoProvider({ apiKey: "test-key", timeoutMs: 1000, cacheTtlMs: 0 }),
    );
    const service = new MedicalService(async () => trip.toSnapshot(), geoService, "geoapify", { consume: async () => true });
    const stopId = trip.toSnapshot().stops[0]!.id;
    return { service, stopId };
  }

  it("hospital: Geoapify healthcare.hospital flows through MedicalService to a listing", async () => {
    const { service, stopId } = medicalFixture(hospitalFeature);
    const result = await service.search("trip", "owner", { category: "hospital", radiusMeters: 5000, location: { kind: "stop", stopId } });
    expect(result.status).toBe("listings");
    expect(result.source).toBe("geoapify");
    expect(result.sourceUrl).toContain("geoapify.com");
    expect(result.places[0]).toMatchObject({ name: "Hospital", category: "hospital" });
  });

  it("clinic: Geoapify healthcare.clinic_or_praxis subcategory flows through MedicalService to a listing", async () => {
    const { service, stopId } = medicalFixture(clinicFeature);
    const result = await service.search("trip", "owner", { category: "clinic", radiusMeters: 5000, location: { kind: "stop", stopId } });
    expect(result.status).toBe("listings");
    expect(result.source).toBe("geoapify");
    expect(result.places[0]).toMatchObject({ name: "City Clinic", category: "clinic" });
  });

  it("pharmacy: Geoapify healthcare.pharmacy flows through MedicalService to a listing", async () => {
    const { service, stopId } = medicalFixture(pharmacyFeature);
    const result = await service.search("trip", "owner", { category: "pharmacy", radiusMeters: 5000, location: { kind: "stop", stopId } });
    expect(result.status).toBe("listings");
    expect(result.places[0]).toMatchObject({ name: "MedPlus Pharmacy", category: "pharmacy" });
  });

  it("empty: returns empty status when Geoapify returns no features in radius", async () => {
    const trip = Trip.create({ title: "Empty" }, { id: "owner", name: "Owner" });
    trip.insertStop(
      { day: 1, index: 0, time: "09:00", name: "Remote", area: "Ladakh", category: "Sight", lat: 34.1, lng: 77.5 },
      trip.toSnapshot().members[0]!.id,
    );
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ features: [] })));
    const geoService = new GeoService(new GeoapifyGeoProvider({ apiKey: "test-key", timeoutMs: 1000, cacheTtlMs: 0 }));
    const service = new MedicalService(async () => trip.toSnapshot(), geoService, "geoapify", { consume: async () => true });
    const result = await service.search("trip", "owner", { category: "hospital", radiusMeters: 5000, location: { kind: "stop", stopId: trip.toSnapshot().stops[0]!.id } });
    expect(result.status).toBe("empty");
    expect(result.places).toEqual([]);
  });
});
