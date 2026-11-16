import { SpeechError, type SpeechLanguage, type SpeechProvider } from "../../services/voice/spoken-summary";

/** Fixed provider URL and server-configured voices; credentials never enter the SPA. */
export class ElevenLabsSpeechProvider implements SpeechProvider {
  constructor(private key: string, private voices: Record<SpeechLanguage, string>, private fetcher: typeof fetch = fetch) {}
  async synthesize(text: string, language: SpeechLanguage, signal?: AbortSignal) {
    try {
      const voice = this.voices[language];
      if (!/^[a-zA-Z0-9_-]{1,100}$/.test(voice) || text.length > 2500) throw new Error("Invalid speech configuration");
      const response = await this.fetcher(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
        method: "POST", redirect: "error",
        headers: { "xi-api-key": this.key, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }),
        signal: AbortSignal.any([AbortSignal.timeout(30_000), ...(signal ? [signal] : [])]),
      });
      if (!response.ok || response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "audio/mpeg" || !response.body) throw new Error("Speech failed");
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = []; let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 4_000_000) throw new Error("Audio too large");
          chunks.push(value);
        }
      } finally { await reader.cancel(); }
      if (!size) throw new Error("Empty audio");
      const audio = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { audio.set(chunk, offset); offset += chunk.length; }
      return audio;
    } catch { throw new SpeechError("speech_unavailable"); }
  }
}
