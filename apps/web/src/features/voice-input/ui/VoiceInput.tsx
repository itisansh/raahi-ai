import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { MicIcon, SquareIcon } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";
import { elevenLabsVoiceProvider } from "../api/elevenlabs";
import { VoiceRecorder, type RecordingState } from "../model/recorder";

/** Transcription is a review step. Only an explicit press transfers text to a form. */
export function VoiceInput({ onUse, disabled = false, destinationOnly = false }: {
  onUse: (text: string) => void;
  disabled?: boolean;
  destinationOnly?: boolean;
}) {
  const { t } = useTranslation("common");
  const [state, setState] = useState<RecordingState>({ status: "idle", text: "", partial: "" });
  const [edited, setEdited] = useState("");
  const recorder = useRef<VoiceRecorder | null>(null);
  useEffect(() => {
    const instance = new VoiceRecorder(elevenLabsVoiceProvider, (next) => {
      setState(next);
      if (next.status === "ready") setEdited(next.text);
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
    void recorder.current?.start();
  };
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
      <p className="text-xs text-muted-foreground">{t(destinationOnly ? "voice.destinationHint" : "voice.privacy")}</p>
      {(state.status === "connecting" || state.status === "recording" || state.status === "finalizing") && <p role="status" className="text-sm">{t(`voice.${state.status}`)}</p>}
      {state.partial && <p className="text-sm text-muted-foreground">{state.partial}</p>}
      {state.status === "error" && state.error && <p role="alert" className="text-sm text-destructive">{t(`voice.errors.${state.error}`)}</p>}
      {state.status === "ready" && <>
        <Textarea aria-label={t("voice.transcript")} value={edited} maxLength={8000} rows={3} onChange={(event) => setEdited(event.target.value)} />
        <Button type="button" size="lg" disabled={disabled || !edited.trim()} onClick={() => { onUse(edited.trim()); recorder.current?.cancel(); }}>{t("voice.use")}</Button>
      </>}
    </div>
  );
}
