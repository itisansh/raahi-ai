import { useEffect, useRef, useState } from "react";
import { VoiceInput } from "@/features/voice-input";
import { SpokenSummary } from "@/features/spoken-summary";
import { apiFetch, ApiError } from "@/shared/api";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";
import { Spinner } from "@/shared/ui/spinner";
import { formatMinute, formatPaise, type PlanningResult } from "../model/proposal";
import { proposalCopy as copy } from "../model/proposal-copy";
import { useRouter } from "@/app/router";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/shared/config";

export function TripProposalPanel() {
  const { navigate } = useRouter();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<PlanningResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => { active.current?.abort(); active.current = null; }, []);
  const cancel = () => { active.current?.abort(); active.current = null; setBusy(false); };
  const edit = (value: string) => { setPrompt(value); setResult(null); setError(null); };
  const approve = async () => {
    if (result?.status !== "preview" || saving) return;
    setSaving(true); setError(null);
    try {
      const saved = await apiFetch<{ tripId: string }>(`/api/planning/proposals/${result.proposalId}/approve`, { method: "POST", body: JSON.stringify({ confirm: true }) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.trips });
      navigate(`/trips/${saved.tripId}`);
    } catch { setError(copy.saveFailed); }
    finally { setSaving(false); }
  };
  const generate = async () => {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true); setError(null); setResult(null);
    const timeout = setTimeout(() => controller.abort(), 180_000);
    try {
      const next = await apiFetch<PlanningResult>("/api/planning/preview", {
        method: "POST", body: JSON.stringify({ prompt }), signal: controller.signal,
      });
      if (active.current === controller) setResult(next);
    } catch (cause) {
      if (active.current === controller) setError(copy.errors[cause instanceof ApiError ? cause.code : "generic"] ?? copy.errors.generic!);
    } finally {
      clearTimeout(timeout);
      if (active.current === controller) { active.current = null; setBusy(false); }
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-2 text-sm font-medium">
        {copy.request}
        <Textarea value={prompt} onChange={(event) => edit(event.target.value)} disabled={busy || saving} maxLength={4000} rows={5} placeholder={copy.placeholder} />
      </label>
      <VoiceInput disabled={busy || saving} onUse={edit} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="brand" disabled={busy || saving || prompt.trim().length < 10} onClick={() => void generate()}>
          {busy && <Spinner className="size-4" />}{busy ? copy.generating : copy.generate}
        </Button>
        {busy && <Button type="button" variant="outline" onClick={cancel}>{copy.cancel}</Button>}
      </div>
      <p className="text-xs text-muted-foreground">{copy.notSaved}</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {result?.status === "clarification" && <div role="status" className="text-sm">
        <p>{copy.clarification}</p>
        <ul className="list-disc pl-5">{result.missing.map((key) => <li key={key}>{copy.missing[key]}</li>)}</ul>
      </div>}
      {result?.status === "preview" && <section aria-label={result.title} className="flex flex-col gap-4 text-sm">
        <h3 className="text-lg font-semibold">{result.title}</h3>
        <SpokenSummary key={result.proposalId} proposalId={result.proposalId} initialLanguage={result.intent.language === "en" ? "en" : "hi"} />
        <Button type="button" variant="brand" disabled={!result.approvable || saving} onClick={() => void approve()}>{saving ? copy.saving : copy.approve}</Button>
        {!result.approvable && <p>{copy.saveBlocked}</p>}
        <dl className="grid grid-cols-2 gap-2">
          {[
            [copy.labels.origin, result.intent.origin], [copy.labels.people, result.intent.partySize],
            [copy.labels.days, result.intent.dayCount], [copy.labels.dates, result.intent.startDate ?? copy.labels.unknown],
            [copy.labels.groupBudget, formatPaise(result.budget.groupBudgetPaise)],
          ].map(([key, value]) => <div key={key}><dt className="text-muted-foreground">{key}</dt><dd>{value}</dd></div>)}
        </dl>
        <p>{copy.estimates}</p>
        <dl className="flex flex-col gap-2 tabular-nums">
          {result.budget.estimates.map((row) => <div key={row.category} className="flex justify-between gap-3">
            <dt>{copy.category[row.category]}</dt><dd>{row.minPaise == null || row.maxPaise == null ? copy.labels.unknown : `${formatPaise(row.minPaise)} – ${formatPaise(row.maxPaise)}`}</dd>
          </div>)}
          <div><dt>{copy.labels.total}</dt><dd>{formatPaise(result.budget.knownMinPerPersonPaise)} – {formatPaise(result.budget.knownMaxPerPersonPaise)}</dd></div>
          <div><dt>{copy.labels.groupEstimate}</dt><dd>{formatPaise(result.budget.knownMaxGroupPaise)}</dd></div>
        </dl>
        <p className="font-medium">{copy.budgetStatus[result.budget.status]}</p>
        <ul className="list-disc space-y-1 pl-5">{result.issues.map((issue) => <li key={issue}>{copy.issues[issue] ?? issue}</li>)}</ul>
        <p className="text-muted-foreground">{copy.labels.note}</p>
        {result.days.map((day) => <section key={day.day} className="border-t border-border pt-3">
          <h4 className="font-semibold">{copy.labels.day} {day.day} · {day.city}</h4>
          <ol className="mt-2 flex flex-col gap-4">{day.stops.map((stop, index) => <li key={index}>
            <p><span className="tabular-nums">{formatMinute(stop.startMinute)}</span> · {stop.name} · {stop.durationMinutes} {copy.labels.minutes}</p>
            <p className="text-xs text-muted-foreground">{stop.evidence.status === "matched" ? copy.labels.matched : stop.evidence.status === "ambiguous" ? copy.labels.ambiguous : copy.labels.unverified} · {copy.labels.source}: {stop.evidence.source} · {copy.labels.checked}: {new Date(stop.evidence.checkedAt).toLocaleDateString()}</p>
            <p className="text-xs">{stop.travel.minutes == null ? copy.labels.unavailable : `${copy.labels.road}: ${stop.travel.minutes} ${copy.labels.minutes}`}</p>
            {stop.evidence.place && <a className="underline" target="_blank" rel="noreferrer" href={stop.evidence.source === "google"
              ? `https://www.google.com/maps/search/?api=1&query=${stop.evidence.place.lat},${stop.evidence.place.lng}&query_place_id=${encodeURIComponent(stop.evidence.place.id)}`
              : `https://www.openstreetmap.org/?mlat=${stop.evidence.place.lat}&mlon=${stop.evidence.place.lng}#map=14/${stop.evidence.place.lat}/${stop.evidence.place.lng}`}>{copy.labels.map}</a>}
          </li>)}</ol>
        </section>)}
        <p>{copy.labels.returnTravel}: {result.returnTravel.minutes == null ? copy.labels.unavailable : `${copy.labels.road} · ${result.returnTravel.minutes} ${copy.labels.minutes}`}</p>
        {result.days.some((day) => day.stops.some((stop) => stop.evidence.source === "osm")) && <a className="text-xs underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">{copy.osmAttribution}</a>}
      </section>}
    </div>
  );
}
