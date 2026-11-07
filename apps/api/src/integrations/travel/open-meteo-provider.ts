import { z } from "zod";
import type { DailyTravelForecast, TravelWeatherProvider } from "../../services/travel/travel-data";
const dailySchema = z.object({ daily: z.object({
  time: z.array(z.string()).max(16), temperature_2m_min: z.array(z.number().finite().nullable()).max(16),
  temperature_2m_max: z.array(z.number().finite().nullable()).max(16), precipitation_sum: z.array(z.number().finite().nonnegative().nullable()).max(16),
}) });
type ForecastRows = z.infer<typeof dailySchema>["daily"];
/** Explicit non-commercial daily forecast adapter; separate from legacy hourly weather. */
export class OpenMeteoTravelProvider implements TravelWeatherProvider {
  private cache = new Map<string, { daily: ForecastRows; retrievedAt: string; expires: number }>();
  private inFlight = new Map<string, Promise<{ daily: ForecastRows; retrievedAt: string; expires: number }>>();
  constructor(private fetcher: typeof fetch = fetch, private now: () => number = Date.now) {}
  async daily(lat: number, lng: number, date: string): Promise<DailyTravelForecast> {
    const base = { serviceDate: date, source: "open-meteo", sourceUrl: "https://open-meteo.com/", observedAt: null, retrievedAt: null } as const;
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(this.now()));
    const last = new Date(Date.parse(`${today}T00:00:00Z`) + 15 * 86400000).toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date || date < today || date > last) return { ...base, status: "outside_window" };
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return { ...base, status: "unavailable" };
    const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
    try {
      let value = this.cache.get(key);
      if (!value || value.expires <= this.now()) {
        let pending = this.inFlight.get(key);
        if (!pending) {
          if (this.inFlight.size >= 100) return { ...base, status: "unavailable" };
          pending = this.load(lat, lng).then(result => {
            for (const [entry, cached] of this.cache) if (cached.expires <= this.now()) this.cache.delete(entry);
            if (this.cache.size >= 1000) this.cache.delete(this.cache.keys().next().value!);
            this.cache.set(key, result); return result;
          }).finally(() => this.inFlight.delete(key));
          this.inFlight.set(key, pending);
        }
        value = await pending;
      }
      const index = value.daily.time.indexOf(date);
      const minC = value.daily.temperature_2m_min[index]; const maxC = value.daily.temperature_2m_max[index]; const precipitationMm = value.daily.precipitation_sum[index];
      if (index < 0 || minC == null || maxC == null || precipitationMm == null || maxC < minC) return { ...base, status: "unavailable", retrievedAt: value.retrievedAt };
      return { ...base, status: "forecast", retrievedAt: value.retrievedAt, minC, maxC, precipitationMm };
    } catch { return { ...base, status: "unavailable" }; }
  }
  private async load(lat: number, lng: number) {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.search = new URLSearchParams({ latitude: String(lat), longitude: String(lng), daily: "temperature_2m_min,temperature_2m_max,precipitation_sum", timezone: "Asia/Kolkata", forecast_days: "16" }).toString();
    const response = await this.fetcher(url, { signal: AbortSignal.timeout(10000), redirect: "error", headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Forecast unavailable");
    const body = await response.text();
    if (body.length > 500000) throw new Error("Forecast response too large");
    const { daily } = dailySchema.parse(JSON.parse(body));
    return { daily, retrievedAt: new Date(this.now()).toISOString(), expires: this.now() + 3600000 };
  }
}
