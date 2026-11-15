// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TripProposalPanel } from "./TripProposalPanel";

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), play: vi.fn(), stop: vi.fn(), resume: vi.fn() }));
vi.mock("@/shared/api", () => ({ apiFetch: mocks.fetch, ApiError: class extends Error {} }));
vi.mock("@/app/router", () => ({ useRouter: () => ({ navigate: vi.fn() }) }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));
vi.mock("@/features/spoken-summary", () => ({ useReplySpeech: () => ({ state: "idle", play: mocks.play, stop: mocks.stop, resume: mocks.resume }) }));
vi.mock("@/features/voice-input", () => ({ VoiceInput: ({ onUse, onStart, onSend }: { onUse: (text: string) => void; onStart: () => void; onSend: (text: string) => void }) => <><button onClick={() => { onStart(); onUse("Two friends from Jaipur for three days"); }}>Test microphone</button><button onClick={() => onSend("Two friends from Jaipur for three days")}>Send finalized voice</button></> }));
let host: HTMLDivElement;
let root: Root;
const response = { status: "clarification", proposalId: "reply-1", reply: { text: "What is your budget?", language: "en" }, intent: {}, missing: ["budgetRupees"] };
beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
async function render() { await act(async () => root.render(<TripProposalPanel onSaved={vi.fn()} />)); }
async function click(label: string) {
  const button = [...host.querySelectorAll("button")].find(el => el.getAttribute("aria-label") === label || el.textContent === label);
  expect(button, label).toBeTruthy(); await act(async () => button!.click());
}
async function type(text: string) {
  const input = host.querySelector("textarea")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
it("reviews the transcript before sending and automatically speaks the visible reply", async () => {
  mocks.fetch.mockResolvedValue(response); await render();
  await click("Test microphone");
  expect(mocks.fetch).not.toHaveBeenCalled();
  expect(host.querySelector("textarea")!.value).toContain("Jaipur");
  await click("Send trip request");
  expect(host.textContent).toContain(response.reply.text);
  expect(mocks.play).toHaveBeenCalledWith("reply-1", "en");
  expect(host.querySelector("textarea")!.value).toBe("");
});
it("honors voice off while a model request is pending and preserves conversation context", async () => {
  let finish!: (value: unknown) => void;
  mocks.fetch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await render(); await type("Plan three days from Jaipur"); await click("Send trip request");
  await click("Voice on");
  await act(async () => finish(response));
  expect(mocks.play).not.toHaveBeenCalled(); expect(localStorage.getItem("raahi:spoken-replies")).toBe("off");
  mocks.fetch.mockResolvedValue({ ...response, proposalId: "reply-2" });
  await type("Two people, 7000 rupees each"); await click("Send trip request");
  expect(JSON.parse(mocks.fetch.mock.calls[1]![1].body).prompt).toBe("Plan three days from Jaipur\n\nTwo people, 7000 rupees each");
});
it("keeps the draft and ignores a late response after cancellation", async () => {
  let finish!: (value: unknown) => void;
  mocks.fetch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await render(); await type("Plan a trip from Kochi"); await click("Send trip request"); await click("Cancel request");
  await act(async () => finish(response));
  expect(host.querySelector("textarea")!.value).toBe("Plan a trip from Kochi");
  expect(mocks.play).not.toHaveBeenCalled(); expect(host.textContent).not.toContain(response.reply.text);
});

it("sends existing trip context without creating or approving a trip automatically", async () => {
  mocks.fetch.mockResolvedValue(response);
  await act(async () => root.render(<TripProposalPanel tripId="existing-trip" onSaved={vi.fn()} />));
  await type("Add a museum in the afternoon"); await click("Send trip request");
  expect(JSON.parse(mocks.fetch.mock.calls[0]![1].body)).toMatchObject({ tripId: "existing-trip" });
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
});

it("submits finalized voice directly without needing a second Send click", async () => {
  mocks.fetch.mockResolvedValue(response); await render();
  await click("Send finalized voice");
  expect(mocks.fetch).toHaveBeenCalledOnce();
  expect(JSON.parse(mocks.fetch.mock.calls[0]![1].body).prompt).toBe("Two friends from Jaipur for three days");
  expect(host.textContent).toContain(response.reply.text);
});

it("shows live draft text before completion and removes it on cancellation", async () => {
  mocks.fetch.mockImplementation((_path, _init, onReply) => {
    onReply("Exploring Jaipur with relaxed mornings");
    return new Promise(() => {});
  });
  await render(); await type("Three days in Jaipur"); await click("Send trip request");
  expect(host.textContent).toContain("Exploring Jaipur with relaxed mornings");
  expect(host.textContent).toContain("Draft reply");
  expect(mocks.play).not.toHaveBeenCalled();
  await click("Cancel request");
  expect(host.textContent).not.toContain("Exploring Jaipur with relaxed mornings");
});
