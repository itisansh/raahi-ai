import { createServer, type Server } from "node:http";
import { WebSocket } from "ws";
import { afterEach, describe, expect, it } from "vitest";
import { NodeRealtime } from "../src/realtime/node-realtime";
import { createTripChange } from "../src/services/rules/realtime";
import type { RealtimeServerMessage } from "../src/realtime/protocol";

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => { for (const close of cleanup.splice(0).reverse()) await close(); });
async function setup(recheckMs = 20_000) {
  const revoked = new Set<string>();
  const realtime = new NodeRealtime({ trustedOrigins: ["https://app.example.test"], recheckMs, authorize: async (headers, tripId) => {
    const user = headers.get("authorization")?.replace("Bearer ", "");
    return user && !revoked.has(user) && tripId === "trip" ? { userId: user, name: user, role: "editor", image: null } : null;
  } });
  const server = createServer((_req, res) => res.end()); realtime.attach(server);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  cleanup.push(async () => { await realtime.close(); await new Promise<void>(resolve => server.close(() => resolve())); });
  return { realtime, server, revoked };
}
function address(server: Server) { const address = server.address(); if (!address || typeof address === "string") throw new Error("Missing address"); return `ws://127.0.0.1:${address.port}`; }
async function connect(server: Server, user: string) {
  const socket = new WebSocket(`${address(server)}/api/trips/trip/realtime`, { headers: { Authorization: `Bearer ${user}`, Origin: "https://app.example.test" } });
  const messages: RealtimeServerMessage[] = [];
  socket.on("message", data => { if (data.toString() !== "pong") messages.push(JSON.parse(data.toString()) as RealtimeServerMessage); });
  socket.on("error", () => {});
  await new Promise<void>((resolve, reject) => { socket.once("open", resolve); socket.once("error", reject); });
  cleanup.push(async () => { socket.terminate(); });
  return { socket, messages };
}
async function until(check: () => boolean) {
  const deadline = Date.now() + 3000;
  while (!check()) { if (Date.now() > deadline) throw new Error("Realtime assertion timed out"); await new Promise(resolve => setTimeout(resolve, 10)); }
}
const change = (eventId = crypto.randomUUID()) => createTripChange({ eventId, tripId: "trip", revision: 1, actorId: "one", occurredAt: new Date().toISOString(), scopes: ["stops"] });
describe("Node WebSocket collaboration", () => {
  it("fans out ordered changes, deduplicates events and counts multiple tabs", async () => {
    const { server, realtime } = await setup();
    const a = await connect(server, "one"), b = await connect(server, "one"), c = await connect(server, "two");
    await until(() => c.messages.some(m => m.type === "hello"));
    const hello = c.messages.find(m => m.type === "hello");
    expect(hello).toMatchObject({ presence: [{ userId: "one", connectionCount: 2 }, { userId: "two", connectionCount: 1 }] });
    const event = change(); await realtime.publish(event); await realtime.publish(event); await realtime.publish(change());
    await until(() => [a, b, c].every(client => client.messages.filter(m => m.type === "change").length === 2));
    expect(a.messages.filter(m => m.type === "change").map(m => m.sequence)).toEqual([1, 2]);
    b.socket.close(); await until(() => a.messages.some(m => m.type === "presence" && m.members.find(x => x.userId === "one")?.connectionCount === 1));
  });
  it("forces a refetch on resume even when a restarted server has a matching cursor", async () => {
    const first = await setup(); const a = await connect(first.server, "one");
    await until(() => a.messages.some(m => m.type === "hello")); await first.realtime.close();
    const restarted = await setup(); const b = await connect(restarted.server, "one");
    await until(() => b.messages.some(m => m.type === "hello"));
    b.socket.send(JSON.stringify({ type: "resume", afterSequence: 0 }));
    await until(() => b.messages.some(m => m.type === "resync_required"));
    expect(b.messages.find(m => m.type === "resync_required")).toMatchObject({ sequence: 0 });
  });
  it("rechecks access before sending changes and periodically for idle clients", async () => {
    const { server, realtime, revoked } = await setup(50);
    const a = await connect(server, "one"); await until(() => a.messages.some(m => m.type === "hello"));
    revoked.add("one"); await realtime.publish(change());
    await until(() => a.socket.readyState === WebSocket.CLOSED);
    expect(a.messages.filter(m => m.type === "change")).toHaveLength(0);
    const b = await connect(server, "two"); await until(() => b.messages.some(m => m.type === "hello")); revoked.add("two");
    await until(() => b.socket.readyState === WebSocket.CLOSED);
  });
  it("rejects untrusted origins, absent credentials and nonmember upgrades", async () => {
    const { server } = await setup();
    for (const [path, headers, status] of [
      ["trip", { Origin: "https://evil.example.test", Authorization: "Bearer one" }, 403],
      ["trip", { Origin: "https://app.example.test" }, 401],
      ["other", { Authorization: "Bearer one" }, 401],
      ["trip", { Cookie: "session=untrusted" }, 403],
    ] as const) {
      const socket = new WebSocket(`${address(server)}/api/trips/${path}/realtime`, { headers }); socket.on("error", () => {});
      const result = await new Promise<number>(resolve => socket.once("unexpected-response", (_req, res) => { resolve(res.statusCode!); res.resume(); socket.terminate(); }));
      expect(result).toBe(status);
    }
  });
  it("rejects binary/invalid messages and terminates open sockets on shutdown", async () => {
    const { server, realtime } = await setup();
    const a = await connect(server, "one"); await until(() => a.messages.some(m => m.type === "hello"));
    a.socket.send("invalid"); await until(() => a.socket.readyState === WebSocket.CLOSED);
    const b = await connect(server, "two"); await realtime.close();
    await until(() => b.socket.readyState === WebSocket.CLOSED);
  });
});
