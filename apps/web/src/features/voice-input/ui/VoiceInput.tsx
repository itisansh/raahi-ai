import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { MicIcon, SquareIcon, AudioLinesIcon } from "lucide-react";
import "./voice-orb.css";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";
import { elevenLabsVoiceProvider } from "../api/elevenlabs";
import { VoiceRecorder, type RecordingState } from "../model/recorder";

/** Final transcripts are reviewed in this control or the owning message composer. */
export function VoiceInput({ onUse, onSend, disabled = false, destinationOnly = false, variant = "default", onActivityChange, onStart, agentState = "idle", statusLabel, compact = false }: {
  onUse: (text: string) => void;
  onSend?: (text: string) => void;
  disabled?: boolean;
  destinationOnly?: boolean;
  variant?: "default" | "orb";
  onActivityChange?: (active: boolean) => void;
  onStart?: () => void;
  statusLabel?: string;
  compact?: boolean;
  agentState?: "idle" | "thinking" | "speaking";
}) {
  const { t } = useTranslation("common");
  const [state, setState] = useState<RecordingState>({ status: "idle", text: "", partial: "" });
  const [edited, setEdited] = useState("");
  const callbacks = useRef({ onUse, onSend, onActivityChange, variant });
  callbacks.current = { onUse, onSend, onActivityChange, variant };
  const sendAfterStop = useRef(false);
  const recorder = useRef<VoiceRecorder | null>(null);
  useEffect(() => {
    const instance = new VoiceRecorder(elevenLabsVoiceProvider, (next) => {
      if (next.status === "idle" || next.status === "error") sendAfterStop.current = false;
      setState(next);
      callbacks.current.onActivityChange?.(["connecting", "recording", "finalizing"].includes(next.status));
      if (next.status === "ready") {
        setEdited(next.text);
        if (sendAfterStop.current && callbacks.current.onSend) {
          sendAfterStop.current = false;
          callbacks.current.onSend(next.text);
        } else if (callbacks.current.variant === "orb") callbacks.current.onUse(next.text);
      }
    });
    recorder.current = instance;
    const cancelWhenHidden = () => { if (document.hidden) instance.cancel(); };
    document.addEventListener("visibilitychange", cancelWhenHidden);
    return () => {
      document.removeEventListener("visibilitychange", cancelWhenHidden);
      instance.dispose();
      recorder.current = null;
    };
  }, []);
  useEffect(() => { if (disabled) recorder.current?.cancel(); }, [disabled]);
  const busy = ["connecting", "recording", "finalizing"].includes(state.status);
  const start = () => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setState({ status: "error", error: "unsupported", text: "", partial: "" });
      return;
    }
    sendAfterStop.current = false;
    onStart?.();
    void recorder.current?.start();
  };
  const recordingActions = state.status === "recording" && <div className="flex flex-wrap justify-center gap-2">
    {onSend && <Button type="button" variant="brand" onClick={() => { sendAfterStop.current = true; recorder.current?.stop(); }}>{t("voice.sendNow")}</Button>}
    <Button type="button" variant="outline" onClick={() => { sendAfterStop.current = false; recorder.current?.stop(); }}>{t("voice.stopEdit")}</Button>
  </div>;
  if (variant === "orb") return (
    <div className={compact ? "flex flex-col items-center gap-2 py-1" : "flex flex-col items-center gap-3 py-4"}>
      <button type="button" className="raahi-voice-orb" data-compact={compact} data-state={busy ? state.status : agentState}
        disabled={disabled || (busy && state.status !== "recording")}
        aria-label={t(state.status === "recording" ? "voice.stop" : "voice.start")}
        aria-pressed={state.status === "recording"}
        onClick={state.status === "recording" ? () => recorder.current?.stop() : start}>
        {state.status === "recording" ? <SquareIcon aria-hidden className="size-7" /> : agentState === "speaking" ? <AudioLinesIcon aria-hidden className="size-8" /> : <MicIcon aria-hidden className="size-8" />}
      </button>
      <p role="status" className={compact && !busy && !statusLabel ? "sr-only" : "text-sm text-muted-foreground"}>{(state.status === "connecting" || state.status === "recording" || state.status === "finalizing") ? t(`voice.${state.status}`) : statusLabel ?? t("voice.start")}</p>
      {(busy || agentState === "speaking") && <div className="raahi-voice-wave" aria-hidden="true">{[0, 1, 2, 3, 4].map(index => <span key={index} />)}</div>}
      {recordingActions}
      {busy && <Button variant="ghost" onClick={() => recorder.current?.cancel()}>{t("voice.cancel")}</Button>}
      {busy && (state.text || state.partial) && <p className="max-h-24 max-w-full overflow-y-auto break-words text-center text-sm">{[state.text, state.partial].filter(Boolean).join(" ")}</p>}
      {state.status === "error" && state.error && <p role="alert" className="text-sm text-destructive">{t(`voice.errors.${state.error}`)}</p>}
    </div>
  );
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="lg" disabled={disabled || (busy && state.status !== "recording")}
          onClick={state.status === "recording" ? () => recorder.current?.stop() : start}>
          {state.status === "recording" ? <SquareIcon className="size-4" aria-hidden /> : <MicIcon className="size-4" aria-hidden />}
          {t(state.status === "recording" ? "voice.stop" : "voice.start")}
        </Button>
        {state.status !== "idle" && <Button type="button" variant="ghost" size="lg" onClick={() => recorder.current?.cancel()}>{t("voice.cancel")}</Button>}
      </div>
      {recordingActions}
      <p className="text-xs text-muted-foreground">{t(destinationOnly ? "voice.destinationHint" : "voice.privacy")}</p>
      {(state.status === "connecting" || state.status === "recording" || state.status === "finalizing") && <div role="status" aria-live="polite" className="flex min-h-28 items-center gap-4 rounded-xl border bg-muted/40 p-4 motion-safe:animate-in motion-safe:fade-in">
        <MicIcon aria-hidden className={`size-8 shrink-0 text-brand ${state.status === "recording" ? "motion-safe:animate-pulse" : ""}`} />
        <p className="text-sm">{t(`voice.${state.status}`)}</p>
      </div>}
      {state.partial && <p className="text-sm text-muted-foreground">{state.partial}</p>}
      {state.status === "error" && state.error && <p role="alert" className="text-sm text-destructive">{t(`voice.errors.${state.error}`)}</p>}
      {state.status === "ready" && <>
        <Textarea aria-label={t("voice.transcript")} value={edited} maxLength={8000} rows={3} onChange={(event) => setEdited(event.target.value)} />
        <Button type="button" size="lg" disabled={disabled || !edited.trim()} onClick={() => { onUse(edited.trim()); recorder.current?.cancel(); }}>{t("voice.use")}</Button>
      </>}
    </div>
  );
}
