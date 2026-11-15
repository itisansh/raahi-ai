import { useCallback, useEffect, useRef, useState } from "react";
import { config } from "@/shared/config";
import { SummaryPlayback } from "./playback";

export type ReplySpeechState = "idle" | "loading" | "speaking" | "blocked" | "error";
export function useReplySpeech() {
  const [state, setState] = useState<ReplySpeechState>("idle");
  const playback = useRef(new SummaryPlayback());
  const audio = useRef<HTMLAudioElement | null>(null);
  const generation = useRef(0);
  const release = useCallback(() => {
    generation.current++;
    if (audio.current) {
      audio.current.pause();
      audio.current.removeAttribute("src");
      audio.current.load();
      audio.current = null;
    }
    playback.current.stop();
  }, []);
  const stop = useCallback(() => { release(); setState("idle"); }, [release]);
  useEffect(() => {
    const hide = () => { if (document.hidden) stop(); };
    document.addEventListener("visibilitychange", hide);
    return () => { document.removeEventListener("visibilitychange", hide); release(); };
  }, [release, stop]);
  const play = useCallback(async (proposalId: string, language: "en" | "hi") => {
    release();
    if (document.visibilityState === "hidden") { setState("idle"); return; }
    const current = generation.current;
    const element = new Audio();
    audio.current = element;
    setState("loading");
    try {
      const url = await playback.current.load(async signal => {
        const response = await fetch(`${config.baseUrl}/api/voice/summary/audio`, {
          method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ proposalId, language }),
          signal: AbortSignal.any([signal, AbortSignal.timeout(40_000)]),
        });
        if (!response.ok || !response.headers.get("content-type")?.includes("audio/mpeg")) throw new Error("speech_unavailable");
        return response.blob();
      });
      if (generation.current !== current || !url) return;
      element.src = url;
      element.onended = () => { if (generation.current === current) stop(); };
      element.onerror = () => { if (generation.current === current) { release(); setState("error"); } };
      try {
        await element.play();
        if (generation.current === current) setState("speaking");
      } catch (error) {
        if (generation.current === current) setState(typeof error === "object" && error !== null && "name" in error && error.name === "NotAllowedError" ? "blocked" : "error");
      }
    } catch {
      if (generation.current === current) { release(); setState("error"); }
    }
  }, [release, stop]);
  // Reuse already-downloaded audio when the browser requires a direct tap.
  const resume = useCallback(async () => {
    const element = audio.current;
    const current = generation.current;
    if (!element) return;
    try { await element.play(); if (generation.current === current) setState("speaking"); }
    catch { if (generation.current === current) setState("blocked"); }
  }, []);
  return { state, play, stop, resume };
}
