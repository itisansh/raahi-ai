import { DomainError, NotFoundError } from "../rules/shared/errors";
import type { TripSnapshot } from "../rules/trip";
import type { GeoService } from "../geo/geo-service";
import type { TravelWeatherProvider, DailyTravelForecast } from "./travel-data";
export const officialTravelLinks = [
  { name: "IRCTC train search", url: "https://www.irctc.co.in/", status: "search_link" },
  { name: "IRCTC bus search — India", url: "https://www.bus.irctc.co.in/home", status: "search_link" },
  { name: "BusIndia — participating operators across India", url: "https://www.busindia.com/", status: "search_link" },
] as const;
export class IndiaTravelService {
  constructor(private load: (id: string, actor: string) => Promise<TripSnapshot>, private geo: Pick<GeoService, "routeCompute" | "placeNearby">, private source: "osm" | "google" | "geoapify", private weather: TravelWeatherProvider | null, private limiter: { consume(actor: string): Promise<boolean> }) {}
  async inspect(tripId: string, actor: string, stopIds: string[]) {
    if (!stopIds.length || stopIds.length > 6 || new Set(stopIds).size !== stopIds.length) throw new DomainError("invalid_travel_stops", "Choose one to six distinct stops");
    const trip = await this.load(tripId, actor); // Membership precedes provider access.
    try {
      if (!await this.limiter.consume(actor)) throw new DomainError("travel_rate_limited", "Please wait before checking travel data again");
    } catch (error) {
      if (error instanceof DomainError) throw error;
      throw new DomainError("travel_unavailable", "Travel services unavailable");
    }
    const stops = stopIds.map(id => { const stop = trip.stops.find(s => s.id === id); if (!stop) throw new NotFoundError("stop_not_found", "Stop not found"); return stop; });
    const serviceDate = trip.days.find(day => day.number === stops[0]!.day)?.date || null;
    const locationAvailable = stops.every(s => Number.isFinite(s.lat) && Number.isFinite(s.lng) && s.lat >= 6 && s.lat <= 38 && s.lng >= 68 && s.lng <= 98);
    const checkedAt = new Date().toISOString();
    const sourceUrl = this.source === "geoapify" ? "https://www.geoapify.com/" : this.source === "osm" ? "https://www.openstreetmap.org/copyright" : "https://maps.google.com/";
    const metadata = { source: this.source, sourceUrl, checkedAt, observedAt: null, serviceDate, cacheMayBeStale: true };
    let road: { status: "road_estimate" | "unavailable" | "choose_route"; distanceMeters?: number; durationSeconds?: number; legs?: Array<{ distanceMeters: number; durationSeconds: number }> } = { status: stops.length < 2 ? "choose_route" : "unavailable" };
    let nearby: { status: "listings" | "empty" | "unavailable"; places: Array<{ id: string; name: string; label: string; lat: number; lng: number }> } = { status: "unavailable", places: [] };
    let forecast: DailyTravelForecast = { status: this.weather ? serviceDate ? "unavailable" : "date_unknown" : "not_configured", serviceDate: serviceDate ?? "", source: "open-meteo", sourceUrl: "https://open-meteo.com/", retrievedAt: null, observedAt: null };
    if (locationAvailable) {
      await Promise.allSettled([
        (async () => { if (stops.length < 2) return; try { const route = await this.geo.routeCompute({ waypoints: stops.map(s => ({ lat: s.lat, lng: s.lng })), mode: "driving", includeGeometry: false }); if (route && Number.isFinite(route.durationSeconds) && route.durationSeconds >= 0 && Number.isFinite(route.distanceMeters) && route.distanceMeters >= 0) road = { status: "road_estimate", distanceMeters: route.distanceMeters, durationSeconds: route.durationSeconds, legs: route.legs }; } catch { /* Road data is unavailable; never substitute schedules. */ } })(),
        (async () => { try { const places = await this.geo.placeNearby({ lat: stops[0]!.lat, lng: stops[0]!.lng, radiusMeters: 5000, categories: this.source === "osm" ? ["tourism=hotel", "tourism=hostel", "tourism=guest_house"] : ["lodging"], limit: 8 }); nearby = { status: places.length ? "listings" : "empty", places: places.map(({ id, name, label, lat, lng }) => ({ id, name, label, lat, lng })) }; } catch { /* Missing listings do not imply unavailable rooms. */ } })(),
        (async () => { if (this.weather && serviceDate) forecast = await this.weather.daily(stops[0]!.lat, stops[0]!.lng, serviceDate); })(),
      ]);
    }
    return { ...metadata, locationStatus: locationAvailable ? "saved_coordinates" : "location_unavailable", stops: stops.map(s => ({ id: s.id, name: s.name, lat: s.lat, lng: s.lng })), road, nearby, weather: forecast, links: officialTravelLinks, localTransport: { status: "needs_confirmation" as const, fares: null, schedules: null, availability: null } };
  }
}
