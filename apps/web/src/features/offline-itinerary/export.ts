interface OfflineTrip {
  id: string; title: string;
  days: Array<{ number: number; date: string; city: string }>;
  stops: Array<{ id: string; day: number; name: string; time: string; area: string; lat: number; lng: number }>;
}
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export const offlineCopy = {
  save: "Download offline itinerary", title: "Offline itinerary", saved: "Snapshot saved", stale: "This is a snapshot, not the current shared plan. Live maps, searches, voice services and saving changes need a connection. Open this downloaded file to read it offline.",
  offline: "Connection unavailable. Showing the opened itinerary from memory. Reconnect and retry to refresh shared changes. Typed requests remain editable; AI generation and saving need a connection.",
  retry: "Retry connection", failed: "Could not download the itinerary. Try again.", emergency: "India emergency services: 112", datesUnknown: "Date undecided", maps: "Directions (requires internet)", day: "Day", snapshot: "Download contains itinerary locations and times, without group expenses or member details.",
};
export function offlineItineraryHtml(trip: OfflineTrip, savedAt = new Date().toISOString()) {
  const days = trip.days.map(day => `<section><h2>${offlineCopy.day} ${day.number}: ${escapeHtml(day.city)}</h2><p>${escapeHtml(day.date || offlineCopy.datesUnknown)}</p><ol>${trip.stops.filter(s => s.day === day.number).map(s => `<li><strong>${escapeHtml(s.time)} ${escapeHtml(s.name)}</strong><p>${escapeHtml(s.area)}</p>${Number.isFinite(s.lat) && Number.isFinite(s.lng) ? `<p>${s.lat}, ${s.lng} · <a href="https://www.google.com/maps/dir/?api=1&amp;destination=${s.lat},${s.lng}">${offlineCopy.maps}</a></p>` : ""}</li>`).join("")}</ol></section>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; base-uri 'none'; form-action 'none'"><title>${escapeHtml(trip.title)} — Raahi AI</title></head><body><h1>${escapeHtml(trip.title)}</h1><p>${offlineCopy.title} · ${offlineCopy.saved}: ${escapeHtml(savedAt)}</p><p>${offlineCopy.stale}</p><p><a href="tel:112">${offlineCopy.emergency}</a></p><p><a href="https://112.gov.in/">112.gov.in</a></p>${days}</body></html>`;
}
