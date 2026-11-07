/** Called only from an explicit button action, never on mount. */
export function requestMedicalLocation(geo: Pick<Geolocation, "getCurrentPosition"> = navigator.geolocation): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!geo) { reject(new Error("Geolocation unavailable")); return; }
    geo.getCurrentPosition(position => resolve({ lat: Number(position.coords.latitude.toFixed(4)), lng: Number(position.coords.longitude.toFixed(4)) }), reject, { enableHighAccuracy: false, maximumAge: 0, timeout: 10000 });
  });
}
export interface MedicalResult {
  status: string; category: "hospital" | "clinic" | "pharmacy"; source: string; sourceUrl: string; checkedAt: string;
  location: { lat: number; lng: number; label: string; kind: string };
  places: Array<{ id: string; name: string; address: string; category: string; lat: number; lng: number; distanceMeters: number; phone: string | null; publishedHours: string[] }>;
}
