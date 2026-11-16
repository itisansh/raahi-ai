import { expect, it, vi } from "vitest";
import { createApp } from "./http-app";
import type { Container } from "../src/config/container";
function fixture(authenticated = true) {
  const status = vi.fn(async () => ({ remainingPaise: -100 }));
  const approve = vi.fn(async () => ({ tripId: "trip" }));
  const propose = vi.fn(async () => ({ proposalId: "test" }));
  const setForecast = vi.fn();
  const app = createApp({ config: { trustedOrigins: ["https://web.test"] }, auth: { api: { getSession: async () => authenticated ? { user: { id: "actor" }, session: {} } : null } }, budgetService: { status, approve, propose, setForecast }, agentService: null } as unknown as Container);
  const post = (action: string, body: unknown, origin = "https://web.test") => app.request(`https://web.test/api/trips/trip/budget/${action}`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { app, status, approve, propose, post };
}
it("requires authenticated budget access and trusted-origin mutations", async () => {
  expect((await fixture(false).post("propose", {})).status).toBe(401);
  const f = fixture(); expect((await f.post("propose", {}, "https://evil.test")).status).toBe(403);
  expect(f.propose).not.toHaveBeenCalled();
});
it("rejects unconfirmed approval and client-authored itinerary payload", async () => {
  const f = fixture();
  for (const body of [{ proposalId: crypto.randomUUID(), confirm: false }, { proposalId: crypto.randomUUID(), confirm: true, stopIds: ["injected"] }]) expect((await f.post("approve", body)).status).toBe(400);
  expect(f.approve).not.toHaveBeenCalled();
});
it("binds approval to the session actor and requested trip, and disables caching", async () => {
  const f = fixture(); const proposalId = crypto.randomUUID();
  const response = await f.post("approve", { proposalId, confirm: true });
  expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("no-store");
  expect(f.approve).toHaveBeenCalledWith(proposalId, "actor", "trip");
});
