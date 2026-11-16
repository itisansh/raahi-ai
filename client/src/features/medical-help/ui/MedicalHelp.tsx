import { GeoAttribution } from "@/components/ui/geo-attribution";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useNetworkStatus } from "@/lib";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger, DialogPortal, DialogBackdrop, DialogSheetViewport, DialogSheetPopup, DialogHeader, DialogTitle, DialogDescription, DialogPanel, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { EmergencyContactLinks } from "./EmergencyContacts";
import { medicalCopy as copy } from "../model/copy";
import { requestMedicalLocation, type MedicalResult } from "../model/location";
type Stop = { id: string; name: string; lat: number; lng: number };
export function MedicalHelp({ tripId, stops, selectedStopId }: { tripId: string; stops: Stop[]; selectedStopId?: string | null }) {
  const [open, setOpen] = useState(false);
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger render={<Button type="button" variant="outline" size="sm" className="min-h-11" />}>{copy.title}</DialogTrigger>
    <DialogPortal><DialogBackdrop className="fixed inset-0 z-50 bg-black/40" /><DialogSheetViewport><DialogSheetPopup size="lg"><DialogHeader><DialogTitle>{copy.title}</DialogTitle><DialogDescription>{copy.description}</DialogDescription></DialogHeader>
      <DialogPanel>{open && <MedicalSearch tripId={tripId} stops={stops} selectedStopId={selectedStopId} />}</DialogPanel>
      <DialogFooter><DialogClose render={<Button type="button" variant="outline" />}>{copy.close}</DialogClose></DialogFooter>
    </DialogSheetPopup></DialogSheetViewport></DialogPortal>
  </Dialog>;
}
function MedicalSearch({ tripId, stops, selectedStopId }: { tripId: string; stops: Stop[]; selectedStopId?: string | null }) {
  const online = useNetworkStatus();
  const [stopId, setStopId] = useState(stops.some(s => s.id === selectedStopId) ? selectedStopId! : stops[0]?.id ?? "");
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [category, setCategory] = useState<"hospital" | "clinic" | "pharmacy">("hospital");
  const [radius, setRadius] = useState(5000); const [locating, setLocating] = useState(false); const [denied, setDenied] = useState(false);
  const [data, setData] = useState<MedicalResult | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState(false);
  const active = useRef<AbortController | null>(null); const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; active.current?.abort(); active.current = null; }; }, []);
  const clear = () => { active.current?.abort(); active.current = null; setBusy(false); setData(null); setError(false); };
  const locate = async () => {
    clear(); setGps(null); setLocating(true); setDenied(false);
    try { const point = await requestMedicalLocation(); if (mounted.current) { setGps(point); setStopId(""); } }
    catch { if (mounted.current) setDenied(true); }
    finally { if (mounted.current) setLocating(false); }
  };
  const search = async () => {
    clear(); const controller = new AbortController(); active.current = controller; setBusy(true);
    try {
      const result = await apiFetch<MedicalResult>(`/api/trips/${encodeURIComponent(tripId)}/medical`, { method: "POST", body: JSON.stringify({ category, radiusMeters: radius, location: gps ? { kind: "gps", ...gps, consent: true } : { kind: "stop", stopId } }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(25000)]) });
      if (active.current === controller) setData(result);
    } catch { if (active.current === controller) setError(true); }
    finally { if (active.current === controller) { active.current = null; setBusy(false); } }
  };
  const location = data?.location ?? gps ?? stops.find(s => s.id === stopId);
  return <div className="flex flex-col gap-3">
    <EmergencyContactLinks />
    {!online && <p role="status">{copy.offline}</p>}
    <p className="text-sm">{copy.caution}</p>
    {!stops.length && <p>{copy.noStops}</p>}
    <label className="text-sm">{copy.stop}<select aria-label={copy.stop} className="w-full rounded-md border border-border bg-background p-2" value={stopId} disabled={locating} onChange={e => { clear(); setStopId(e.target.value); setGps(null); }}><option value="">—</option>{stops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    <Button type="button" variant="outline" disabled={locating || !online} onClick={() => void locate()}>{locating ? copy.locating : copy.gps}</Button><p className="text-xs">{copy.gpsExplain}</p>
    {gps && <p>{gps.lat}, {gps.lng}</p>}{denied && <p role="alert">{copy.denied}</p>}
    <div className="flex flex-wrap gap-2">{(["hospital", "clinic", "pharmacy"] as const).map(c => <Button key={c} type="button" variant="outline" aria-pressed={category === c} onClick={() => { clear(); setCategory(c); }}>{copy[c]}</Button>)}</div>
    <label>{copy.radius}<select aria-label={copy.radius} value={radius} onChange={e => { clear(); setRadius(Number(e.target.value)); }}><option value={5000}>5 {copy.km}</option><option value={10000}>10 {copy.km}</option></select></label>
    <Button type="button" disabled={busy || locating || !online || (!stopId && !gps)} onClick={() => void search()}>{busy ? copy.busy : copy.search}</Button>
    {busy && <Button type="button" variant="outline" onClick={clear}>{copy.cancel}</Button>}
    {error && <p role="alert">{copy.retry}</p>}
    {data && <>
      <p>{data.location.label} · {data.location.lat}, {data.location.lng}</p>
      <GeoAttribution source={data.source} /><p><a className="underline" href={data.sourceUrl} target="_blank" rel="noreferrer">{copy.source}: {data.source}</a> · {copy.checked}: {new Date(data.checkedAt).toLocaleString()}</p><p className="text-xs">{copy.cached}</p>
      {data.status !== "listings" && <p role="status">{data.status === "empty" ? copy.empty : data.status === "location_unavailable" ? copy.invalidLocation : copy.unavailable}</p>}
      <ul className="flex flex-col gap-3">{data.places.map(p => <li key={p.id} className="border-t border-border pt-2"><strong>{p.name}</strong><p>{copy[category]} · {p.distanceMeters} m</p><p>{p.address}</p>{p.publishedHours.length > 0 && <p>{copy.hours}: {p.publishedHours.join("; ")}</p>}<div className="flex flex-wrap gap-3">{p.phone ? <a className="underline" href={`tel:${p.phone}`}>{copy.phone}: {p.phone}</a> : <span>{copy.noPhone}</span>}<a className="underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`}>{copy.directions}</a></div></li>)}</ul>
    </>}
    {location && <a className="underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${category} near ${location.lat},${location.lng}`)}`}>{copy.map}</a>}
  </div>;
}
