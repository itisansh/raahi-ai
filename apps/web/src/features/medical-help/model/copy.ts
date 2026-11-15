export const medicalCopy = {
  title: "Medical help", description: "Find healthcare listings near a saved stop, or choose to share your current location for this search.",
  reviewed: "Contacts reviewed: 7 November 2026",
  contacts: "India emergency contacts", india: "Call 112 — India emergency services", source: "Official source", region: "112 is the nationwide emergency number. Local response and dispatch availability vary.",
  stop: "Search near this itinerary stop", gps: "Use my current location", gpsExplain: "Requests browser permission. Your location is sent to the server and places provider only for this search; it is not saved to the trip or shared with members.",
  locating: "Waiting for location permission…", denied: "Location permission was denied or the location could not be obtained. Select a saved stop instead.",
  hospital: "Hospitals", clinic: "Clinics", pharmacy: "Pharmacies", radius: "Search radius", km: "km", search: "Search listings", busy: "Searching…", cancel: "Cancel search", close: "Close", noStops: "No saved stops. You can opt into current-location search.",
  empty: "No matching listings were returned by this provider in the selected area. This does not mean no facilities exist.", unavailable: "The places provider is unavailable. Retry later or use the map search and official contacts.", invalidLocation: "This saved location is unavailable or outside the supported India search area.",
  caution: "Listings are unverified references. Emergency capacity, current opening status, staffing and phone accuracy are unknown. Call to confirm. Distances are straight-line estimates, not travel times.",
  phone: "Call listed number", noPhone: "Phone unavailable — verify directly", hours: "Published hours (may be outdated)", directions: "Open directions", map: "Search in maps", checked: "Checked", cached: "Provider data may be cached. Observation time is unknown.", retry: "Search could not be completed. Check connectivity and retry; wait a minute if the request limit was reached.", offline: "You’re offline. Live search and current-location lookup need a connection. Official contact numbers remain available.",
};
export const emergencyContacts = [
  { label: medicalCopy.india, phone: "112", url: "https://112.gov.in/" },
];
