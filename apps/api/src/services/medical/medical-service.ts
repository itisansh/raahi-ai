import { z } from "zod";
import { DomainError, NotFoundError } from "../../domain/shared/errors";
import type { TripSnapshot } from "../../domain/trip";
import type { GeoService } from "../geo/geo-service";
export const medicalRequestSchema = z.object({
  category: z.enum(["hospital", "clinic", "pharmacy"]), radiusMeters: z.union([z.literal(5000), z.literal(10000)]),
  location: z.discriminatedUnion("kind", [z.object({ kind: z.literal("stop"), stopId: z.string().min(1).max(150) }).strict(), z.object({ kind: z.literal("gps"), lat: z.number().finite().min(6).max(38), lng: z.number().finite().min(68).max(98), consent: z.literal(true) }).strict()]),
}).strict();
export function indianDialNumber(raw?: string): string | null {
  if (!raw || !/^[+\d\s()-]+$/.test(raw)) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  return /^[1-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
}
function distance(lat: number, lng: number, a: number, b: number) {
  const radians = (value: number) => value * Math.PI / 180;
  const h = Math.sin(radians(a - lat) / 2) ** 2 + Math.cos(radians(lat)) * Math.cos(radians(a)) * Math.sin(radians(b - lng) / 2) ** 2;
  return Math.round(6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h))));
}
const osmCategories = { hospital: ["amenity=hospital", "healthcare=hospital"], clinic: ["amenity=clinic", "amenity=doctors", "healthcare=clinic", "healthcare=doctor"], pharmacy: ["amenity=pharmacy", "healthcare=pharmacy"] };
const matching = { hospital: ["hospital", "general_hospital"], clinic: ["clinic", "doctors", "doctor", "medical_clinic", "medical_center"], pharmacy: ["pharmacy"] };
export class MedicalService {
  constructor(private load: (id: string, actor: string) => Promise<TripSnapshot>, private geo: Pick<GeoService, "placeNearby">, private source: "osm" | "google", private limiter: { consume(actor: string): Promise<boolean> }) {}
  async search(id: string, actor: string, raw: unknown) {
    const request = medicalRequestSchema.parse(raw);
    const trip = await this.load(id, actor);
    let lat: number; let lng: number; let label: string;
    if (request.location.kind === "stop") {
      const stopId = request.location.stopId;
      const stop = trip.stops.find(s => s.id === stopId);
      if (!stop) throw new NotFoundError("stop_not_found", "Stop not found");
      lat = stop.lat; lng = stop.lng; label = stop.name;
    } else { lat = Number(request.location.lat.toFixed(4)); lng = Number(request.location.lng.toFixed(4)); label = "Current location"; }
    try { if (!await this.limiter.consume(actor)) throw new DomainError("medical_rate_limited", "Please wait before searching again"); }
    catch (error) { if (error instanceof DomainError) throw error; throw new DomainError("medical_unavailable", "Medical place search unavailable"); }
    const base = { category: request.category, radiusMeters: request.radiusMeters, location: { lat, lng, label, kind: request.location.kind }, source: this.source, sourceUrl: this.source === "osm" ? "https://www.openstreetmap.org/copyright" : "https://maps.google.com/", checkedAt: new Date().toISOString(), observedAt: null, cacheMayBeStale: true, emergencyCapacity: "unknown", openingStatus: "unknown" };
    if (![lat, lng].every(Number.isFinite) || lat < 6 || lat > 38 || lng < 68 || lng > 98) return { ...base, status: "location_unavailable", places: [] };
    try {
      const results = await this.geo.placeNearby({ lat, lng, radiusMeters: request.radiusMeters, categories: this.source === "osm" ? osmCategories[request.category] : [request.category === "clinic" ? "medical_clinic" : request.category], limit: 20 });
      const places = results.filter(p => {
        const categories = [...p.categories, p.extras?.healthcare ?? "", p.extras?.amenity ?? ""];
        return categories.some(c => matching[request.category].includes(c.toLowerCase())) && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180 && distance(lat, lng, p.lat, p.lng) <= request.radiusMeters;
      }).map(p => ({ id: p.id, name: p.name, address: p.label, category: request.category, lat: p.lat, lng: p.lng, distanceMeters: distance(lat, lng, p.lat, p.lng), phone: indianDialNumber(p.phone), publishedHours: p.openingHours ?? [] }));
      const unique = [...new Map(places.map(p => [p.id, p])).values()].sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, 10);
      return { ...base, status: unique.length ? "listings" : "empty", places: unique };
    } catch { return { ...base, status: "unavailable", places: [] }; }
  }
}
