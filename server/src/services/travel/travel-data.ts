export interface DailyTravelForecast {
  status: "forecast" | "unavailable" | "outside_window" | "not_configured" | "date_unknown";
  serviceDate: string; source: string; sourceUrl: string;
  retrievedAt: string | null; observedAt: null;
  minC?: number; maxC?: number; precipitationMm?: number;
}
export interface TravelWeatherProvider {
  daily(lat: number, lng: number, date: string): Promise<DailyTravelForecast>;
}
