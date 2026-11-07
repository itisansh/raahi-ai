export const travelCopy = {
  title: "India travel checks", description: "Select up to six saved stops in travel order. Weather and nearby stays use the first selected stop.",
  check: "Check selected stops", loading: "Checking travel data…", cancel: "Cancel", failed: "Travel data could not be checked. Your itinerary is unchanged. Wait a minute and retry.",
  noStops: "Add a saved location to check travel options.", route: "Road estimate", chooseRoute: "Select at least two stops for a road estimate.", unavailable: "Data unavailable. Confirm directly with the provider.",
  uncertainty: "Saved coordinates may not be independently verified. Provider data may be cached; its observation time is unavailable. Road estimates do not confirm train, bus or jeep schedules, road conditions or seasonal access.",
  nearby: "Nearby stay listings", noListings: "No nearby listings returned. This does not establish room availability.", stayNote: "Listings only. Prices, rooms and opening status are unverified.",
  weather: "Daily forecast", weatherNote: "Forecast for the selected itinerary date; mountain conditions may differ at nearby elevations.",
  unknownDate: "Choose an itinerary date to check its forecast.", outsideWindow: "The date is outside the provider’s current 16-day forecast window.", disabledWeather: "Daily travel forecasts are not configured.",
  links: "Official transport searches", linkNote: "Search links only. Raahi has not checked fares, departure times, seats or reservations.",
  jeep: "Local jeeps and last-mile connections need local confirmation. No live schedules, fares or availability are supplied.",
  source: "Source", checked: "Checked", retrieved: "Forecast retrieved", date: "Service date", map: "View location", missingLocation: "An Indian location could not be established from these saved coordinates.",
  rain: "Daily precipitation", units: { km: "km", minutes: "min", celsius: "°C", mm: "mm" },
};
export interface IndiaTravelResult {
  source: string; sourceUrl: string; checkedAt: string; serviceDate: string | null; locationStatus: string;
  stops: Array<{ id: string; name: string; lat: number; lng: number }>;
  road: { status: string; distanceMeters?: number; durationSeconds?: number };
  nearby: { status: string; places: Array<{ id: string; name: string; label: string; lat: number; lng: number }> };
  weather: { status: string; serviceDate: string; sourceUrl: string; retrievedAt: string | null; minC?: number; maxC?: number; precipitationMm?: number };
  links: Array<{ name: string; url: string }>;
}
