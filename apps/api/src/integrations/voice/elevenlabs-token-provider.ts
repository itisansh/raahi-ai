import { z } from "zod";
import { VoiceError, type VoiceTokenProvider } from "../../services/voice/voice-token-service";

const tokenResponse = z.object({ token: z.string().min(1).max(4096) });

export class ElevenLabsTokenProvider implements VoiceTokenProvider {
  constructor(
    private readonly apiKey: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async createToken(): Promise<{ token: string }> {
    try {
      const response = await this.fetcher(
        "https://api.elevenlabs.io/v1/single-use-token/realtime_scribe",
        {
          method: "POST",
          headers: { "xi-api-key": this.apiKey },
          signal: AbortSignal.timeout(10_000),
          redirect: "error",
        },
      );
      if (!response.ok) throw new VoiceError("voice_unavailable");
      return tokenResponse.parse(await response.json());
    } catch {
      // Provider errors may contain private data. Never forward their bodies.
      throw new VoiceError("voice_unavailable");
    }
  }
}
