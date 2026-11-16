import { z } from "zod";
import type { GeoProvider, GeoPlace, GeoPlaceSearchQuery, GeoPlaceNearbyQuery, GeoPlaceDetailQuery, GeoRouteComputeQuery, GeoRouteMatrixQuery, GeoReviewLookupQuery } from "../../../services/rules/geo";
import { GeoError } from "../../../services/geo/geo-error";
import { GeoCache } from "../geo-cache";
import { RateLimiter } from "../rate-limiter";
import { fetchJson } from "../http";

const properties = z.object({
  place_id: z.string(), name: z.string().optional(), formatted: z.string().optional(),
  lat: z.number().finite().min(-90).max(90), lon: z.number().finite().min(-180).max(180),
  categories: z.array(z.string()).optional(), city: z.string().optional(), state: z.string().optional(),
  country: z.string().optional(), country_code: z.string().optional(), postcode: z.string().optional(),
  contact: z.object({ phone: z.string().optional(), website: z.string().optional() }).optional(),
  opening_hours: z.string().optional(),
});
const collection = z.object({ features: z.array(z.object({ properties: z.unknown() })) });
const measure = z.number().finite().nonnegative();
const routeSchema = z.object({ features: z.array(z.object({ properties: z.object({
  distance: measure, time: measure, legs: z.array(z.object({ distance: measure, time: measure })), polyline5: z.string().optional(),
}) })) });
const matrixSchema = z.object({ sources_to_targets: z.array(z.array(z.object({ distance: measure.nullable(), time: measure.nullable(), source_index: z.number().int(), target_index: z.number().int() }).nullable())) });
const categories: Record<string, string> = {
  hospital: "healthcare.hospital", clinic: "healthcare.clinic_or_praxis", medical_clinic: "healthcare.clinic_or_praxis", pharmacy: "healthcare.pharmacy",
  lodging: "accommodation", hotel: "accommodation.hotel", hostel: "accommodation.hostel", museum: "entertainment.museum", restaurant: "catering.restaurant", cafe: "catering.cafe", tourist_attraction: "tourism.sights",
};
const modes = { driving: "drive", walking: "walk", cycling: "bicycle" };
function parse<T>(schema: z.ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw);
  if (!result.success) throw new GeoError("geo_failed", "Invalid Geoapify response");
  return result.data;
}
function places(raw: unknown): GeoPlace[] {
  return parse(collection, raw).features.flatMap(feature => {
    const parsed = properties.safeParse(feature.properties);
    if (!parsed.success) return [];
    const p = parsed.data;
    const normalized = (p.categories ?? []).flatMap(c => c === "healthcare.hospital" ? [c, "hospital"] : c === "healthcare.pharmacy" ? [c, "pharmacy"] : c.startsWith("healthcare.clinic_or_praxis") ? [c, "clinic"] : [c]);
    return [{ id: p.place_id, name: p.name ?? p.formatted ?? "", label: p.formatted ?? p.name ?? "", lat: p.lat, lng: p.lon, categories: normalized,
      address: { city: p.city, state: p.state, country: p.country, countryCode: p.country_code, postcode: p.postcode },
      phone: p.contact?.phone, website: p.contact?.website, openingHours: p.opening_hours ? [p.opening_hours] : undefined }];
  });
}
/** Geoapify is the sole upstream for this adapter; errors never switch providers. */
export class GeoapifyGeoProvider implements GeoProvider {
  private cache: GeoCache;
  private limiter = new RateLimiter(1, 250);
  constructor(private config: { apiKey: string; timeoutMs: number; cacheTtlMs: number }) {
    if (!config.apiKey) throw new GeoError("geo_not_configured", "Geoapify API key is required");
    this.cache = new GeoCache(config.cacheTtlMs);
  }
  private request(path: string, params: Record<string, string>, body?: unknown): Promise<unknown> {
    const key = JSON.stringify([path, params, body]);
    return this.cache.getOrLoad(key, async () => {
      await this.limiter.acquire();
      const url = new URL(path, "https://api.geoapify.com");
      for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
      url.searchParams.set("apiKey", this.config.apiKey);
      return fetchJson({ url, timeoutMs: this.config.timeoutMs, ...(body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
    });
  }
  async placeSearch(q: GeoPlaceSearchQuery) {
    return places(await this.request("/v1/geocode/search", { text: q.query, limit: String(q.limit ?? 8), lang: q.lang ?? "en", ...(q.near ? { bias: `proximity:${q.near.lng},${q.near.lat}` } : {}) }));
  }
  async placeNearby(q: GeoPlaceNearbyQuery) {
    return places(await this.request("/v2/places", { categories: (q.categories?.length ? q.categories : ["tourism.sights"]).map(c => categories[c] ?? c).join(","), filter: `circle:${q.lng},${q.lat},${q.radiusMeters}`, bias: `proximity:${q.lng},${q.lat}`, limit: String(q.limit ?? 20), lang: q.lang ?? "en" }));
  }
  async placeDetail(q: GeoPlaceDetailQuery) {
    return places(await this.request("/v2/place-details", { id: q.placeId, features: "details", lang: q.lang ?? "en" }))[0] ?? null;
  }
  async routeCompute(q: GeoRouteComputeQuery) {
    const mode = q.mode ?? "driving";
    if (mode === "transit") throw new GeoError("geo_unsupported", "Live transit routing is not supported");
    const raw = parse(routeSchema, await this.request("/v1/routing", { waypoints: q.waypoints.map(p => `${p.lat},${p.lng}`).join("|"), mode: modes[mode], units: "metric", ...(q.includeGeometry ? { details: "polyline5" } : {}) }));
    const route = raw.features[0]?.properties;
    return route ? { mode, distanceMeters: route.distance, durationSeconds: route.time, legs: route.legs.map(l => ({ distanceMeters: l.distance, durationSeconds: l.time })), ...(q.includeGeometry && route.polyline5 ? { geometry: route.polyline5 } : {}) } : null;
  }
  async routeMatrix(q: GeoRouteMatrixQuery) {
    const mode = q.mode ?? "driving";
    if (mode === "transit") throw new GeoError("geo_unsupported", "Live transit routing is not supported");
    const raw = parse(matrixSchema, await this.request("/v1/routematrix", {}, { mode: modes[mode], sources: q.origins.map(p => ({ location: [p.lng, p.lat] })), targets: q.destinations.map(p => ({ location: [p.lng, p.lat] })), units: "metric" }));
    const cells = q.origins.flatMap((_, originIndex) => q.destinations.map((__, destinationIndex) => {
      const cell = raw.sources_to_targets[originIndex]?.[destinationIndex];
      if (cell && (cell.source_index !== originIndex || cell.target_index !== destinationIndex)) throw new GeoError("geo_failed", "Invalid route matrix indices");
      return cell?.distance != null && cell.time != null ? { originIndex, destinationIndex, condition: "ok" as const, distanceMeters: cell.distance, durationSeconds: cell.time } : { originIndex, destinationIndex, condition: "no_route" as const };
    }));
    return { mode, cells };
  }
  async reviewLookup(q: GeoReviewLookupQuery) { return { placeId: q.placeId, supported: false, reviews: [] }; }
}
