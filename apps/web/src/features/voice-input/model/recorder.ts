export type VoiceFailure = "unavailable" | "permission" | "unsupported" | "timeout" | "empty" | "rateLimited";
export interface RecordingState {
  status: "idle" | "connecting" | "recording" | "finalizing" | "ready" | "error";
  partial: string;
  text: string;
  error?: VoiceFailure;
}
export interface VoiceEvents {
  audioStarted(): void;
  partial(text: string): void;
  committed(text: string): void;
  failed(error: VoiceFailure): void;
  closed(): void;
}
export interface VoiceConnection {
  mute(): void;
  commit(): void;
  close(): void;
}
export interface VoiceProvider {
  token(signal: AbortSignal): Promise<string>;
  connect(token: string, events: VoiceEvents): VoiceConnection;
}
const initial = (): RecordingState => ({ status: "idle", partial: "", text: "" });

/** Owns recording lifetime; partial recognition is never promoted to final text. */
export class VoiceRecorder {
  private state = initial();
  private connection?: VoiceConnection;
  private request?: AbortController;
  private generation = 0;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private chunks: string[] = [];

  constructor(private provider: VoiceProvider, private changed: (state: RecordingState) => void) {}

  private emit(update: Partial<RecordingState>) {
    this.state = { ...this.state, ...update };
    this.changed(this.state);
  }
  private clearTimers() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }
  private release() {
    this.generation += 1;
    this.clearTimers();
    this.request?.abort();
    this.request = undefined;
    const connection = this.connection;
    this.connection = undefined;
    connection?.close();
  }
  cancel() {
    this.release();
    this.chunks = [];
    this.state = initial();
    this.changed(this.state);
  }
  dispose() { this.release(); }
  private fail(error: VoiceFailure) {
    this.release();
    this.emit({ status: "error", error, partial: "", text: "" });
  }
  async start() {
    if (["connecting", "recording", "finalizing"].includes(this.state.status)) return;
    this.release();
    const generation = this.generation;
    const current = () => generation === this.generation;
    this.chunks = [];
    this.emit({ status: "connecting", text: "", partial: "", error: undefined });
    this.request = new AbortController();
    this.timers.push(setTimeout(() => this.fail("timeout"), 20_000));
    try {
      const token = await this.provider.token(this.request.signal);
      if (!current()) return;
      this.connection = this.provider.connect(token, {
        audioStarted: () => {
          if (!current() || this.state.status !== "connecting") return;
          this.clearTimers();
          this.emit({ status: "recording" });
          this.timers.push(setTimeout(() => this.stop(), 90_000));
        },
        partial: (text) => {
          if (current()) this.emit({ partial: text.slice(0, 8_000) });
        },
        committed: (text) => {
          if (!current()) return;
          this.chunks.push(text.trim());
          if (this.state.status !== "finalizing") {
            this.emit({ text: this.chunks.filter(Boolean).join(" ").slice(0, 8_000), partial: "" });
            return;
          }
          const final = this.chunks.filter(Boolean).join(" ").slice(0, 8_000);
          this.release();
          this.emit(final
            ? { status: "ready", text: final, partial: "" }
            : { status: "error", error: "empty", partial: "" });
        },
        failed: (error) => { if (current()) this.fail(error); },
        closed: () => { if (current()) this.fail("unavailable"); },
      });
    } catch (error) {
      if (!current()) return;
      this.fail(error instanceof Error && error.message === "voice_rate_limited" ? "rateLimited" : "unavailable");
    }
  }
  stop() {
    if (this.state.status !== "recording" || !this.connection) return;
    this.clearTimers();
    this.emit({ status: "finalizing", partial: "" });
    try {
      this.connection.mute();
      // Allow the worklet's last buffered audio frame to arrive before committing.
      this.timers.push(setTimeout(() => {
        try { this.connection?.commit(); } catch { this.fail("unavailable"); }
      }, 300));
      this.timers.push(setTimeout(() => this.fail("timeout"), 10_000));
    } catch { this.fail("unavailable"); }
  }
}
