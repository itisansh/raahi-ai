import { GeoAttribution } from "@/shared/ui/geo-attribution";
import { useEffect, useRef, useState } from "react";
import type { Trip } from "@/entities/trip";
import { apiFetch } from "@/shared/api";
import { Button } from "@/shared/ui/button";
import { travelCopy as copy, type IndiaTravelResult } from "../model/india-travel";
export function IndiaTravelPanel({ trip }: { trip: Trip }) {
  const [selected, setSelected] = useState<string[]>([]); const [data, setData] = useState<IndiaTravelResult | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(false); const active = useRef<AbortController | null>(null);
  const selection = selected.join("|");
  useEffect(() => { active.current?.abort(); active.current = null; setData(null); setBusy(false); setError(false); }, [trip.version, selection]);
  useEffect(() => () => { active.current?.abort(); active.current = null; }, []);
  const cancel = () => { active.current?.abort(); active.current = null; setBusy(false); };
  const check = async () => {
    cancel(); const controller = new AbortController(); active.current = controller; setBusy(true); setError(false); setData(null);
    try {
      const result = await apiFetch<IndiaTravelResult>(`/api/trips/${encodeURIComponent(trip.id)}/travel`, { method: "POST", body: JSON.stringify({ stopIds: selected }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]) });
      if (active.current === controller) setData(result);
    } catch { if (active.current === controller) setError(true); }
    finally { if (active.current === controller) { active.current = null; setBusy(false); } }
  };
  const weatherText = data?.weather.status === "outside_window" ? copy.outsideWindow : data?.weather.status === "date_unknown" ? copy.unknownDate : data?.weather.status === "not_configured" ? copy.disabledWeather : copy.unavailable;
  return <section className="flex flex-col gap-3 border-b border-border p-4" aria-label={copy.title}>
    <h3 className="font-semibold">{copy.title}</h3><p className="text-sm">{copy.description}</p>
    {!trip.stops.length && <p>{copy.noStops}</p>}
    <div className="flex flex-wrap gap-2">{trip.stops.map(stop => <Button type="button" key={stop.id} size="sm" variant="outline" aria-pressed={selected.includes(stop.id)} disabled={!selected.includes(stop.id) && selected.length >= 6} onClick={() => setSelected(ids => ids.includes(stop.id) ? ids.filter(id => id !== stop.id) : [...ids, stop.id])}>{stop.name}</Button>)}</div>
    {!!selected.length && <p className="text-sm">{selected.map(id => trip.stops.find(s => s.id === id)?.name).join(" → ")}</p>}
    <div className="flex gap-2"><Button type="button" disabled={!selected.length || busy} onClick={() => void check()}>{busy ? copy.loading : copy.check}</Button>{busy && <Button type="button" variant="outline" onClick={cancel}>{copy.cancel}</Button>}</div>
    {error && <p role="alert">{copy.failed}</p>}
    {data && <div className="flex flex-col gap-3 text-sm">
      {data.locationStatus !== "saved_coordinates" && <p>{copy.missingLocation}</p>}
      <h4 className="font-medium">{copy.route}</h4>
      <p>{data.road.status === "road_estimate" ? `${Math.round(data.road.distanceMeters! / 1000)} ${copy.units.km} · ${Math.ceil(data.road.durationSeconds! / 60)} ${copy.units.minutes}` : data.road.status === "choose_route" ? copy.chooseRoute : copy.unavailable}</p>
      <p className="text-xs text-muted-foreground">{copy.uncertainty}</p>
      <GeoAttribution source={data.source} /><p><a href={data.sourceUrl} target="_blank" rel="noreferrer" className="underline">{copy.source}: {data.source}</a> · {copy.checked}: {new Date(data.checkedAt).toLocaleString()}</p>
      <h4 className="font-medium">{copy.weather}</h4>
      {data.weather.status === "forecast" ? <p>{data.weather.minC}–{data.weather.maxC} {copy.units.celsius} · {copy.rain}: {data.weather.precipitationMm} {copy.units.mm}</p> : <p>{weatherText}</p>}
      <p>{copy.date}: {data.serviceDate ?? "—"}</p><p className="text-xs">{copy.weatherNote}</p>
      <a href={data.weather.sourceUrl} target="_blank" rel="noreferrer" className="underline">Open-Meteo (CC BY 4.0){data.weather.retrievedAt && ` · ${copy.retrieved}: ${new Date(data.weather.retrievedAt).toLocaleString()}`}</a>
      <h4 className="font-medium">{copy.nearby}</h4><p className="text-xs">{copy.stayNote}</p>
      {data.nearby.status !== "listings" && <p>{data.nearby.status === "empty" ? copy.noListings : copy.unavailable}</p>}
      <ul className="list-disc pl-4">{data.nearby.places.map(place => <li key={place.id}><a className="underline" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lng}#map=15/${place.lat}/${place.lng}`}>{place.name}</a> · {place.label}</li>)}</ul>
      <h4 className="font-medium">{copy.links}</h4><p className="text-xs">{copy.linkNote}</p>
      {data.links.map(link => <a key={link.url} className="underline" href={link.url} target="_blank" rel="noreferrer">{link.name}</a>)}<p>{copy.jeep}</p>
    </div>}
  </section>;
}
