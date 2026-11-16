// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ExpenseVoiceDraftInput } from "./ExpenseVoiceDraft";
const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiFetch: mocks.fetch }));
vi.mock("@/features/voice-input", () => ({ VoiceInput: ({ onUse, onActivityChange }: { onUse: (text: string) => void; onActivityChange: (active: boolean) => void }) => <><button onClick={() => onActivityChange(true)}>Record</button><button onClick={() => { onActivityChange(false); onUse("I paid 600 rupees for lunch for four people"); }}>Finish</button></> }));
let host: HTMLDivElement; let root: Root;
const draft = { amountRupees: "600", participantCount: 4, participantNames: [] };
beforeEach(() => {
  vi.clearAllMocks(); Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  if (!AbortSignal.any) AbortSignal.any = signals => signals[0]!;
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
async function click(label: string) { await act(async () => { Array.from(host.querySelectorAll("button")).find(button => button.textContent === label)!.click(); }); }
it("requires explicit interpretation after recording and retains the exact participant question", async () => {
  const onDraft = vi.fn(); const onActivityChange = vi.fn(); mocks.fetch.mockResolvedValue(draft);
  await act(async () => root.render(<ExpenseVoiceDraftInput tripId="trip" onDraft={onDraft} onActivityChange={onActivityChange} />));
  await click("Record"); expect(onActivityChange).toHaveBeenLastCalledWith(true);
  expect(host.querySelector("textarea")!.disabled).toBe(true);
  await click("Finish"); expect(mocks.fetch).not.toHaveBeenCalled();
  expect(host.querySelector("textarea")!.value).toContain("four people");
  await click("Fill expense draft"); expect(onDraft).toHaveBeenCalledWith(draft);
  expect(onActivityChange).toHaveBeenLastCalledWith(false);
  expect(mocks.fetch.mock.calls[0]![0]).toBe("/api/trips/trip/expenses/preview");
});
it("cancels interpretation without applying a late result or losing the transcript", async () => {
  let finish!: (value: unknown) => void;
  mocks.fetch.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const onDraft = vi.fn();
  await act(async () => root.render(<ExpenseVoiceDraftInput tripId="trip" onDraft={onDraft} />));
  await click("Finish"); await click("Fill expense draft"); await click("Cancel interpretation");
  await act(async () => finish(draft));
  expect(onDraft).not.toHaveBeenCalled(); expect(host.querySelector("textarea")!.value).toContain("600");
});
