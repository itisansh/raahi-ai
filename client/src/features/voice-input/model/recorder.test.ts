import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VoiceRecorder, type RecordingState, type VoiceEvents } from "./recorder";

function fixture(token = vi.fn(async (signal: AbortSignal) => { signal.throwIfAborted(); return "token"; })) {
  let events!: VoiceEvents;
  let state!: RecordingState;
  const connection = { mute: vi.fn(), commit: vi.fn(), close: vi.fn() };
  const connect = vi.fn((_token: string, handlers: VoiceEvents) => { events = handlers; return connection; });
  const recorder = new VoiceRecorder({ token, connect }, (next) => { state = next; });
  return { recorder, token, connect, connection, get events() { return events; }, get state() { return state; } };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("voice recording lifecycle", () => {
  it("waits for actual audio, then commits before closing; partial text never becomes a draft", async () => {
    const f = fixture();
    await f.recorder.start();
    expect(f.state.status).toBe("connecting");
    f.events.audioStarted();
    expect(f.state.status).toBe("recording");
    f.events.partial("seven hundred");
    expect(f.state.text).toBe("");
    f.recorder.stop();
    expect(f.connection.mute).toHaveBeenCalledOnce();
    expect(f.connection.close).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(f.connection.commit).toHaveBeenCalledOnce();
    f.events.committed("seven thousand rupees");
    expect(f.state).toMatchObject({ status: "ready", text: "seven thousand rupees", partial: "" });
    expect(f.connection.close).toHaveBeenCalledOnce();
  });
  it("cancels during token fetch without opening a microphone later", async () => {
    let resolve!: (token: string) => void;
    const f = fixture(vi.fn((signal: AbortSignal) => { signal.throwIfAborted(); return new Promise<string>((done) => { resolve = done; }); }));
    const starting = f.recorder.start();
    f.recorder.cancel();
    expect(f.token.mock.calls[0]![0].aborted).toBe(true);
    resolve("late token");
    await starting;
    expect(f.connect).not.toHaveBeenCalled();
    expect(f.state.status).toBe("idle");
  });
  it("ignores late committed events after cancel or disposal", async () => {
    const f = fixture();
    await f.recorder.start();
    f.recorder.cancel();
    f.events.committed("do not save this");
    expect(f.state.text).toBe("");
    expect(f.connection.close).toHaveBeenCalledOnce();
    await f.recorder.start();
    f.recorder.dispose();
    f.events.committed("do not save this either");
    expect(f.state.text).toBe("");
    expect(f.connection.close).toHaveBeenCalledTimes(2);
  });
  it("times out when permission/audio startup never finishes", async () => {
    const f = fixture();
    await f.recorder.start();
    vi.advanceTimersByTime(20_000);
    expect(f.state).toMatchObject({ status: "error", error: "timeout" });
    expect(f.connection.close).toHaveBeenCalledOnce();
  });
  it("caps recording at 90 seconds and does not promote an uncommitted partial on timeout", async () => {
    const f = fixture();
    await f.recorder.start();
    f.events.audioStarted();
    f.events.partial("unconfirmed expense amount");
    vi.advanceTimersByTime(90_000);
    expect(f.state.status).toBe("finalizing");
    vi.advanceTimersByTime(10_000);
    expect(f.state).toMatchObject({ status: "error", error: "timeout", text: "" });
  });
  it.each(["permission", "unavailable"] as const)("closes on %s without changing typed input", async (error) => {
    const f = fixture();
    await f.recorder.start();
    f.events.failed(error);
    expect(f.state).toMatchObject({ status: "error", error, text: "" });
    expect(f.connection.close).toHaveBeenCalledOnce();
  });
  it("rejects an empty final transcript", async () => {
    const f = fixture();
    await f.recorder.start();
    f.events.audioStarted();
    f.recorder.stop();
    f.events.committed(" ");
    expect(f.state).toMatchObject({ status: "error", error: "empty" });
  });
  it("does not open two sessions on repeated start presses", async () => {
    const f = fixture();
    await Promise.all([f.recorder.start(), f.recorder.start()]);
    expect(f.token).toHaveBeenCalledOnce();
    expect(f.connect).toHaveBeenCalledOnce();
    f.recorder.dispose();
  });
});

it("shows committed chunks during listening without treating them as a submitted draft", async () => {
  const f = fixture(); await f.recorder.start(); f.events.audioStarted();
  f.events.committed("We are two friends");
  expect(f.state).toMatchObject({ status: "recording", text: "We are two friends" });
  f.events.partial("from Jaipur");
  expect(f.state.partial).toBe("from Jaipur");
  f.recorder.stop(); vi.advanceTimersByTime(300); f.events.committed("from Jaipur");
  expect(f.state).toMatchObject({ status: "ready", text: "We are two friends from Jaipur" });
});
