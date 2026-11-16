import { describe, expect, it, vi } from "vitest";
import { createApp } from "./http-app";
import type { Container } from "../src/config/container";

function fixture(signedIn = true) {
  const approve = vi.fn(async () => ({ tripId: "saved-trip" }));
  const app = createApp({
    config: { trustedOrigins: ["https://web.example.test"], betterAuthUrl: "https://web.example.test" },
    auth: { api: { getSession: async () => signedIn ? { user: { id: "actor", name: "Actor", image: null }, session: { id: "s" } } : null } },
    proposalApprovalService: { approve }, agentService: null,
  } as unknown as Container);
  const request = (body: unknown, origin = "https://web.example.test") => app.request("https://web.example.test/api/planning/proposals/11111111-1111-4111-8111-111111111111/approve", { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(body) });
  return { approve, request };
}
describe("explicit proposal approval boundary", () => {
  it("requires a session and trusted Origin", async () => {
    expect((await fixture(false).request({ confirm: true })).status).toBe(401);
    const f = fixture();
    expect((await f.request({ confirm: true }, "https://attacker.test")).status).toBe(403);
    expect(f.approve).not.toHaveBeenCalled();
  });
  it.each([{}, { confirm: false }, { confirm: true, payload: {} }, { confirm: true, userId: "other" }])("rejects missing confirmation and client-authored payloads", async (body) => {
    const f = fixture();
    expect((await f.request(body)).status).toBe(400);
    expect(f.approve).not.toHaveBeenCalled();
  });
  it("uses the session actor and server proposal ID", async () => {
    const f = fixture(); const response = await f.request({ confirm: true });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(f.approve).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", { id: "actor", name: "Actor", image: null });
  });
});
