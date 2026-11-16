// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useReplySpeech } from "./use-reply-speech";
let speech: ReturnType<typeof useReplySpeech>;
let root: Root;
let host: HTMLDivElement;
const play = vi.fn(async () => {});
const pause = vi.fn();
const fetcher = vi.fn();
const revoke = vi.fn();
function Harness() { speech = useReplySpeech(); return <span>{speech.state}</span>; }
beforeEach(async () => {
  vi.clearAllMocks();
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  // jsdom 24 lacks AbortSignal.any; fetch is controlled by these tests.
  vi.stubGlobal("AbortSignal", { any: (signals: AbortSignal[]) => signals[0], timeout: () => new AbortController().signal });
  vi.stubGlobal("Audio", class {
    src = ""; play = play; pause = pause; load = vi.fn(); removeAttribute = vi.fn(); onended = null; onerror = null;
  });
  vi.stubGlobal("fetch", fetcher);
  vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:test"), revokeObjectURL: revoke });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<Harness />));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const response = () => ({ ok: true, headers: new Headers({ "Content-Type": "audio/mpeg" }), blob: async () => new Blob(["audio"]) });
it("prevents audio that arrives after stop from playing", async () => {
  let finish!: (value: unknown) => void;
  fetcher.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  let pending!: Promise<void>;
  await act(async () => { pending = speech.play("proposal", "en"); });
  await act(async () => speech.stop());
  await act(async () => { finish(response()); await pending; });
  expect(play).not.toHaveBeenCalled(); expect(speech.state).toBe("idle");
});
it("allows direct playback of downloaded audio after autoplay is blocked", async () => {
  fetcher.mockResolvedValue(response());
  play.mockRejectedValueOnce(new DOMException("Tap required", "NotAllowedError"));
  await act(async () => speech.play("proposal", "hi"));
  expect(speech.state).toBe("blocked");
  await act(async () => speech.resume());
  expect(speech.state).toBe("speaking"); expect(fetcher).toHaveBeenCalledTimes(1);
  await act(async () => speech.stop());
  expect(pause).toHaveBeenCalled(); expect(revoke).toHaveBeenCalledWith("blob:test");
});
it("stops speech and releases audio when the dialog unmounts", async () => {
  fetcher.mockResolvedValue(response());
  await act(async () => speech.play("proposal", "en"));
  await act(async () => root.render(null));
  expect(pause).toHaveBeenCalled(); expect(revoke).toHaveBeenCalledWith("blob:test");
});

it("does not start a late reply while the page is hidden", async () => {
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  await act(async () => speech.play("proposal", "en"));
  expect(fetcher).not.toHaveBeenCalled(); expect(play).not.toHaveBeenCalled();
  expect(speech.state).toBe("idle");
});
