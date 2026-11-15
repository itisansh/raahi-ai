import { GeoAttribution } from "@/shared/ui/geo-attribution";
import { useEffect, useRef, useState } from "react";
import { ArrowUpIcon, Volume2Icon, VolumeXIcon, SquareIcon } from "lucide-react";
import { VoiceInput } from "@/features/voice-input";
import { useReplySpeech } from "@/features/spoken-summary";
import { apiFetch, ApiError } from "@/shared/api";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";
import { formatMinute, formatPaise, type PlanningResult } from "../model/proposal";
import { proposalCopy as copy } from "../model/proposal-copy";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/shared/config";

type Turn = { id: string; request: string; result: PlanningResult };

export function TripProposalPanel({ tripId, onSaved }: { tripId?: string; onSaved: (id: string) => void }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [streamedReply, setStreamedReply] = useState("");
  const [pendingRequest, setPendingRequest] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    try { return localStorage.getItem("raahi:spoken-replies") !== "off"; } catch { return true; }
  });
  const voicePreference = useRef(voiceEnabled);
  const active = useRef<AbortController | null>(null);
  const replyEnd = useRef<HTMLDivElement>(null);
  useEffect(() => { replyEnd.current?.scrollIntoView({ block: "end", behavior: "instant" }); }, [turns.length, streamedReply]);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const speech = useReplySpeech();
  const result = turns.at(-1)?.result;
  const requestText = [...turns.map(turn => turn.request), draft.trim()].join("\n\n");
  const canSend = !!draft.trim() && requestText.length <= 4000 && !busy && !saving && !recording;
  useEffect(() => () => { active.current?.abort(); active.current = null; }, []);
  const toggleVoice = () => {
    const enabled = !voiceEnabled;
    voicePreference.current = enabled;
    setVoiceEnabled(enabled);
    try { localStorage.setItem("raahi:spoken-replies", enabled ? "on" : "off"); } catch { /* Preference remains available for this dialog. */ }
    if (!enabled) speech.stop();
  };
  const cancel = () => { active.current?.abort(); active.current = null; setBusy(false); setStreamedReply(""); setPendingRequest(""); speech.stop(); };
  const generate = async (voiceText?: string) => {
    const submitted = voiceText ? [draft.trim(), voiceText.trim()].filter(Boolean).join(" ") : draft.trim();
    const prompt = [...turns.map(turn => turn.request), submitted].join("\n\n");
    if (!submitted || prompt.length > 4000 || busy || saving || (!voiceText && recording) || active.current) {
      if (voiceText) setDraft(submitted);
      return;
    }
    speech.stop();
    setDraft(submitted);
    const controller = new AbortController();
    active.current = controller;
    setBusy(true); setError(null); setStreamedReply(""); setPendingRequest(submitted);
    const timeout = setTimeout(() => controller.abort(), 180_000);
    try {
      const next = await apiFetch<PlanningResult>("/api/planning/preview", {
        method: "POST", body: JSON.stringify({ prompt, ...(tripId ? { tripId } : {}) }), signal: controller.signal,
      }, text => { if (active.current === controller) setStreamedReply(text); });
      if (active.current !== controller) return;
      setTurns(current => [...current, { id: next.proposalId, request: submitted, result: next }]);
      setDraft("");
      if (voicePreference.current) void speech.play(next.proposalId, next.reply.language);
    } catch (cause) {
      if (active.current === controller) setError(copy.errors[cause instanceof ApiError ? cause.code : "generic"] ?? copy.errors.generic!);
    } finally {
      clearTimeout(timeout);
      if (active.current === controller) { active.current = null; setBusy(false); setStreamedReply(""); setPendingRequest(""); }
    }
  };
  const approve = async () => {
    if (result?.status !== "preview" || !result.approvable || saving || busy || recording || draft.trim()) return;
    speech.stop(); setSaving(true); setError(null);
    try {
      const saved = await apiFetch<{ tripId: string }>(`/api/planning/proposals/${result.proposalId}/approve`, { method: "POST", body: JSON.stringify({ confirm: true }) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.trips });
      await queryClient.invalidateQueries({ queryKey: queryKeys.trip(saved.tripId) });
      onSaved(saved.tripId);
    } catch (cause) { setError(cause instanceof ApiError ? copy.errors[cause.code] ?? copy.saveFailed : copy.saveFailed); }
    finally { setSaving(false); }
  };
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col break-words">
      <div className="flex flex-none items-center justify-between gap-3 px-4 md:px-6">
        <span className="text-xs text-muted-foreground">{copy.languages}</span>
        <Button variant="ghost" size="lg" aria-pressed={voiceEnabled} onClick={toggleVoice}>
          {voiceEnabled ? <Volume2Icon className="size-4" aria-hidden /> : <VolumeXIcon className="size-4" aria-hidden />}
          {voiceEnabled ? copy.voiceOn : copy.voiceOff}
        </Button>
      </div>
      <div className="scrollbar-overlay min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 pb-4 md:px-6" data-planning-scroll>
      {turns.length === 0 && <div className="flex min-h-40 flex-col justify-center gap-4 py-6">
        <p className="text-xl font-semibold tracking-tight">{tripId ? copy.existingGreeting : copy.greeting}</p>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{tripId ? copy.appendHint : copy.greetingHint}</p>
        <div className="flex flex-wrap gap-2">{copy.starters.map(item => <Button key={item.label} variant="outline" size="lg" disabled={busy || recording} className="min-h-11 whitespace-normal text-left" onClick={() => { setDraft(item.prompt); draftRef.current?.focus(); }}>{item.label}</Button>)}</div>
      </div>}
      {turns.length > 0 && <div className="flex flex-col gap-5" aria-label={copy.conversation}>
        {turns.map(turn => <div key={turn.id} className="space-y-4">
          <p className="ml-8 whitespace-pre-wrap rounded-2xl bg-muted px-4 py-3 text-sm">{turn.request}</p>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">{copy.agentName}</p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{turn.result.reply.text}</p>
          </div>
        </div>)}
      </div>}
      {busy && <div className="space-y-3" aria-busy="true">
        <p className="ml-8 whitespace-pre-wrap rounded-2xl bg-muted px-4 py-3 text-sm">{pendingRequest}</p>
        <p className="text-xs text-muted-foreground" role="status">{copy.streamingDraft}</p>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{streamedReply || copy.generating}</p>
      </div>}
      {result && <div className="flex flex-wrap items-center gap-2">
        {speech.state === "loading" || speech.state === "speaking"
          ? <Button variant="ghost" size="lg" onClick={speech.stop}><SquareIcon className="size-4" aria-hidden />{speech.state === "loading" ? copy.cancelAudio : copy.stopAudio}</Button>
          : <Button variant="ghost" size="lg" disabled={busy || recording || saving} onClick={() => void (speech.state === "blocked" ? speech.resume() : speech.play(result.proposalId, result.reply.language))}><Volume2Icon className="size-4" aria-hidden />{copy.readReply}</Button>}
        {speech.state === "blocked" && <p role="status" className="text-xs text-muted-foreground">{copy.playbackBlocked}</p>}
        {speech.state === "error" && <p role="alert" className="text-xs text-muted-foreground">{copy.audioFailed}</p>}
      </div>}
      {result?.status === "preview" && <section className="space-y-4 text-sm" aria-label={result.title}>
        <h3 className="text-lg font-semibold">{result.title}</h3>
        {tripId && <p className="text-sm text-muted-foreground">{copy.appendHint}</p>}
        <details className="rounded-xl border border-border p-4">
          <summary className="min-h-11 cursor-pointer py-2 font-medium">{copy.viewPlan}</summary>
          <div className="mt-4 space-y-4">
            <p>{copy.labels.groupBudget}: {formatPaise(result.budget.groupBudgetPaise)} · {result.intent.partySize} {copy.labels.people} · {result.intent.dayCount} {copy.labels.days}</p>
            <p>{copy.budgetStatus[result.budget.status]}</p>
            <p className="text-xs text-muted-foreground">{result.costScope === "additions" ? copy.additionEstimates : copy.estimates}</p>
            <dl className="space-y-2 tabular-nums">{result.budget.estimates.map(row => <div key={row.category} className="flex flex-wrap justify-between gap-2">
              <dt>{copy.category[row.category]}</dt><dd>{row.minPaise == null || row.maxPaise == null ? copy.labels.unknown : `${formatPaise(row.minPaise)} – ${formatPaise(row.maxPaise)}`}</dd>
            </div>)}</dl>
            <p>{copy.labels.groupEstimate}: {formatPaise(result.budget.knownMaxGroupPaise)}</p>
            {result.issues.length > 0 && <ul className="list-disc space-y-1 pl-5">{result.issues.map(issue => <li key={issue}>{copy.issues[issue] ?? issue}</li>)}</ul>}
            {result.guidance && <><h4 className="font-medium">{copy.timing}</h4><p>{result.guidance.timing}</p><p className="text-xs text-muted-foreground">{copy.generalGuidance}</p></>}
            {result.days.map(day => <section key={day.day} className="space-y-3 border-t pt-3">
              <h4 className="font-medium">{copy.labels.day} {day.day} · {day.city}</h4>
              {result.retainedStops?.some(stop => stop.day === day.day) && <div className="space-y-1 text-muted-foreground"><p className="text-xs font-medium">{copy.retained}</p>{result.retainedStops.filter(stop => stop.day === day.day).map(stop => <p key={stop.id}>{stop.time} · {stop.name} · {stop.duration}</p>)}</div>}
              {tripId && <p className="text-xs font-medium">{day.stops.length ? copy.additions : copy.noAdditions}</p>}
              {day.stops.map((stop, index) => <div key={index}>
                <p>{formatMinute(stop.startMinute)} · {stop.name} · {stop.durationMinutes} {copy.labels.minutes}</p>
                <p className="text-xs text-muted-foreground">{stop.evidence.status === "matched" ? copy.labels.matched : stop.evidence.status === "ambiguous" ? copy.labels.ambiguous : copy.labels.unverified} · {copy.labels.source}: {stop.evidence.source} · {copy.labels.checked}: {new Date(stop.evidence.checkedAt).toLocaleDateString()}</p>
                <p className="text-xs">{stop.travel.minutes == null ? copy.labels.unavailable : `${copy.labels.road}: ${stop.travel.minutes} ${copy.labels.minutes}`}</p>
                {stop.evidence.place && <a className="text-xs underline" target="_blank" rel="noreferrer" href={stop.evidence.source === "google" ? `https://www.google.com/maps/search/?api=1&query=${stop.evidence.place.lat},${stop.evidence.place.lng}&query_place_id=${encodeURIComponent(stop.evidence.place.id)}` : `https://www.openstreetmap.org/?mlat=${stop.evidence.place.lat}&mlon=${stop.evidence.place.lng}#map=14/${stop.evidence.place.lat}/${stop.evidence.place.lng}`}>{copy.labels.map}</a>}
              </div>)}
            </section>)}
            <p>{copy.labels.returnTravel}: {result.returnTravel.minutes == null ? copy.labels.unavailable : `${copy.labels.road} · ${result.returnTravel.minutes} ${copy.labels.minutes}`}</p>
            {result.days.some(day => day.stops.some(stop => stop.evidence.source === "geoapify")) && <GeoAttribution source="geoapify" />}
            {result.days.some(day => day.stops.some(stop => stop.evidence.source === "osm")) && <a className="text-xs underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">{copy.osmAttribution}</a>}
          </div>
        </details>
        <Button variant="brand" size="lg" className="min-h-12 w-full" disabled={!result.approvable || saving || busy || recording || !!draft.trim()} onClick={() => void approve()}>{saving ? copy.saving : tripId ? copy.approveAdditions : copy.approve}</Button>
        {!result.approvable && <p className="text-xs text-muted-foreground">{copy.saveBlocked}</p>}
      </section>}
      <div ref={replyEnd} />
      </div>
      <div className="flex-none border-t border-border bg-card px-4 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-3 md:px-6">
        {error && <p role="alert" className="mb-2 text-sm text-destructive">{error}</p>}
        {requestText.length > 4000 && <p role="alert" className="mb-2 text-xs text-destructive">{copy.tooLong}</p>}
        <VoiceInput compact={turns.length > 0 || draft.length > 0} variant="orb" disabled={busy || saving} agentState={busy ? "thinking" : speech.state === "speaking" ? "speaking" : "idle"}
          onSend={text => { void generate(text); }}
          statusLabel={busy ? copy.generating : speech.state === "speaking" ? copy.speaking : undefined} onStart={speech.stop} onActivityChange={setRecording} onUse={text => {
            setDraft(current => current.trim() ? `${current} ${text}` : text);
            draftRef.current?.focus();
          }} />

        <div className="raahi-ai-composer flex items-end gap-2 rounded-3xl bg-background p-2">
          <Textarea ref={draftRef} aria-label={copy.request} value={draft} onChange={event => setDraft(event.target.value)}
            disabled={busy || saving || recording} maxLength={4000} rows={2} placeholder={turns.length ? copy.replyPlaceholder : copy.placeholder}
            className="max-h-32 resize-none border-0 bg-transparent shadow-none focus:bg-transparent"
            onKeyDown={event => { if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !event.nativeEvent.isComposing) { event.preventDefault(); void generate(); } }} />
          {busy ? <Button className="min-h-11 min-w-11" size="icon" variant="outline" aria-label={copy.cancel} onClick={cancel}><SquareIcon className="size-4" aria-hidden /></Button>
            : <Button className="min-h-11 min-w-11" size="icon" variant="brand" aria-label={copy.generate} disabled={!canSend} onClick={() => void generate()}><ArrowUpIcon className="size-5" aria-hidden /></Button>}
        </div>
        {turns.length > 0 && <Button variant="ghost" size="lg" disabled={busy || saving || recording} onClick={() => { speech.stop(); setTurns([]); setDraft(""); setError(null); }}>{copy.startOver}</Button>}
        <p className="mt-3 text-center text-xs text-muted-foreground">{copy.inputHint}</p>
      </div>
    </div>
  );
}
