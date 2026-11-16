// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { RecordingState } from "../model/recorder";
import { VoiceInput } from "./VoiceInput";

const mocks = vi.hoisted(() => ({ emit: (_state: RecordingState) => { void _state; }, stop: vi.fn(), send: vi.fn(), edit: vi.fn() }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("../api/elevenlabs", () => ({ elevenLabsVoiceProvider: {} }));
vi.mock("../model/recorder", () => ({ VoiceRecorder: class {
  constructor(_provider: unknown, emit: typeof mocks.emit) { mocks.emit = emit; }
  stop = mocks.stop;
  start() {}
  cancel() { mocks.emit({ status: "idle", text: "", partial: "" }); }
  dispose() {}
} }));
let host: HTMLDivElement;
let root: Root;
beforeEach(async () => {
  vi.clearAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<VoiceInput variant="orb" onSend={mocks.send} onUse={mocks.edit} />));
  await act(async () => mocks.emit({ status: "recording", text: "Plan Jaipur", partial: "for three" }));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
async function click(label: string) {
  const button = [...host.querySelectorAll("button")].find(el => el.textContent === label)!;
  expect(button).toBeTruthy();
  await act(async () => button.click());
}
it("sends only the finalized transcript after an explicit Send now", async () => {
  await click("voice.sendNow");
  expect(mocks.stop).toHaveBeenCalledOnce();
  expect(mocks.send).not.toHaveBeenCalled();
  await act(async () => mocks.emit({ status: "ready", text: "Plan Jaipur for three days", partial: "" }));
  expect(mocks.send).toHaveBeenCalledWith("Plan Jaipur for three days");
  expect(mocks.edit).not.toHaveBeenCalled();
});
it("returns the transcript for editing without submitting", async () => {
  await click("voice.stopEdit");
  await act(async () => mocks.emit({ status: "ready", text: "Plan Jaipur", partial: "" }));
  expect(mocks.edit).toHaveBeenCalledWith("Plan Jaipur");
  expect(mocks.send).not.toHaveBeenCalled();
});
it("clears the send intention when recording is cancelled", async () => {
  await click("voice.sendNow");
  await click("voice.cancel");
  await act(async () => mocks.emit({ status: "ready", text: "Another recording", partial: "" }));
  expect(mocks.send).not.toHaveBeenCalled();
});
