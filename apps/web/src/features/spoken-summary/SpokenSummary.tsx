import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/shared/api";
import { config } from "@/shared/config";
import { Button } from "@/shared/ui/button";
import { SummaryPlayback } from "./playback";
import { speechCopy as copy } from "./copy";

export function SpokenSummary({ proposalId, initialLanguage }: { proposalId: string; initialLanguage: "en" | "hi" }) {
  const [language, setLanguage] = useState(initialLanguage);
  const [text, setText] = useState("");
  const [src, setSrc] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const player = useRef(new SummaryPlayback());
  const started = useRef(false);
  const audio = useRef<HTMLAudioElement>(null);
  const request = useRef<AbortController | null>(null);
  const stop = () => {
    request.current?.abort(); request.current = null; started.current = false;
    audio.current?.pause(); player.current.stop(); setSrc(null); setBusy(false);
  };
  useEffect(() => { const playback = player.current; return () => { request.current?.abort(); request.current = null; playback.stop(); }; }, []);
  const play = async () => {
    stop(); setFailed(false); setBusy(true);
    const controller = new AbortController(); request.current = controller;
    const body = JSON.stringify({ proposalId, language });
    try {
      const summary = await apiFetch<{ text: string }>("/api/voice/summary/text", { method: "POST", body, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) });
      if (request.current !== controller) return;
      setText(summary.text);
      const url = await player.current.load(async signal => {
        const response = await fetch(`${config.baseUrl}/api/voice/summary/audio`, {
          method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body,
          signal: AbortSignal.any([signal, controller.signal, AbortSignal.timeout(40_000)]),
        });
        if (!response.ok || !response.headers.get("content-type")?.includes("audio/mpeg")) throw new Error("Speech unavailable");
        return response.blob();
      });
      if (request.current === controller && url) setSrc(url);
    } catch {
      if (request.current === controller) setFailed(true);
    } finally {
      if (request.current === controller) { request.current = null; setBusy(false); }
    }
  };
  return <section aria-label={copy.title} className="flex flex-col gap-2">
    <h4 className="font-medium">{copy.title}</h4>
    <div className="flex flex-wrap gap-2">
      {(["en", "hi"] as const).map(value => <Button key={value} type="button" variant="outline" aria-pressed={language === value} onClick={() => { stop(); setLanguage(value); setText(""); setFailed(false); }}>{value === "en" ? copy.english : copy.hindi}</Button>)}
      <Button type="button" variant="outline" disabled={busy} onClick={() => void play()}>{busy ? copy.loading : copy.play}</Button>
      {(busy || src) && <Button type="button" variant="outline" onClick={stop}>{busy ? copy.cancel : copy.stop}</Button>}
    </div>
    {text && <p lang={language}>{text}</p>}
    {src && <>
      <audio ref={audio} src={src} controls onCanPlay={() => { if (!started.current) { started.current = true; void audio.current?.play().catch(() => setFailed(true)); } }} onError={() => setFailed(true)} aria-label={copy.title} />
      <p className="text-xs text-muted-foreground">{copy.ready}</p>
    </>}
    {failed && <p role="alert">{copy.failed}</p>}
  </section>;
}
