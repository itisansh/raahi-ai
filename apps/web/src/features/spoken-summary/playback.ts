/** Owns the request and object URL so cancellation cannot start late playback. */
export class SummaryPlayback {
  private active: AbortController | null = null;
  private url: string | null = null;
  constructor(private revoke: (url: string) => void = URL.revokeObjectURL) {}
  async load(fetchAudio: (signal: AbortSignal) => Promise<Blob>, create: (blob: Blob) => string = URL.createObjectURL) {
    this.stop();
    const controller = new AbortController(); this.active = controller;
    try {
      const blob = await fetchAudio(controller.signal);
      if (this.active !== controller) return null;
      this.url = create(blob);
      return this.url;
    } finally { if (this.active === controller) this.active = null; }
  }
  stop() {
    this.active?.abort(); this.active = null;
    if (this.url) this.revoke(this.url);
    this.url = null;
  }
}
