export interface VoiceTokenProvider {
  createToken(): Promise<{ token: string }>;
}

export interface VoiceTokenLimiter {
  consume(userId: string): Promise<boolean>;
}

export class VoiceError extends Error {
  constructor(public code: "voice_unavailable" | "voice_rate_limited") {
    super(code === "voice_rate_limited"
      ? "Too many recording attempts. Try again shortly."
      : "Voice input is unavailable. You can still type your request.");
  }
}

/** Issues credentials for transcription only. Never receives or stores audio. */
export class VoiceTokenService {
  constructor(
    private readonly provider: VoiceTokenProvider | null,
    private readonly limiter: VoiceTokenLimiter,
  ) {}

  async createToken(userId: string): Promise<{ token: string }> {
    if (!this.provider) throw new VoiceError("voice_unavailable");
    if (!await this.limiter.consume(userId)) throw new VoiceError("voice_rate_limited");
    return this.provider.createToken();
  }
}
