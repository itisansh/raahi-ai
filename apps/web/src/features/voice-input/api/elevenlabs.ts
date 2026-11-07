import { CommitStrategy, RealtimeEvents, Scribe } from "@elevenlabs/client";
import { ApiError, apiFetch } from "@/shared/api";
import type { VoiceProvider } from "../model/recorder";

export const elevenLabsVoiceProvider: VoiceProvider = {
  async token(signal) {
    try {
      const result = await apiFetch<{ token: string }>("/api/voice/token", { method: "POST", signal });
      if (typeof result.token !== "string" || !result.token) throw new Error("voice_unavailable");
      return result.token;
    } catch (error) {
      throw new Error(error instanceof ApiError ? error.code : "voice_unavailable");
    }
  },
  connect(token, events) {
    const connection = Scribe.connect({
      token,
      modelId: "scribe_v2_realtime",
      commitStrategy: CommitStrategy.MANUAL,
      microphone: { echoCancellation: true, noiseSuppression: true },
    });
    connection.on(RealtimeEvents.AUDIO_STARTED, events.audioStarted);
    connection.on(RealtimeEvents.PARTIAL_TRANSCRIPT, ({ text }) => events.partial(text));
    connection.on(RealtimeEvents.COMMITTED_TRANSCRIPT, ({ text }) => events.committed(text));
    connection.on(RealtimeEvents.ERROR, (error) => {
      events.failed(/permission|denied|notallowed/i.test(error.error) ? "permission" : "unavailable");
    });
    connection.on(RealtimeEvents.CLOSE, events.closed);
    return connection;
  },
};
