import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket, WebSocketServer } from "ws";
import type { RealtimeConnectionIdentity, TripChange, TripChangePublisher } from "../services/rules/realtime";
import { buildPresence, encodeRealtimeMessage, parseRealtimeClientMessage, type RealtimeServerMessage } from "./protocol";

type Identity = Omit<RealtimeConnectionIdentity, "connectionId" | "tripId">;
export interface NodeRealtimeOptions {
  trustedOrigins: readonly string[];
  authorize(headers: Headers, tripId: string): Promise<Identity | null>;
  recheckMs?: number;
}
interface Client { alive: boolean; queued: number; socket: WebSocket; headers: Headers; identity: RealtimeConnectionIdentity }
interface Room { clients: Set<Client>; sequence: number; seen: Set<string>; pending: Promise<void> }

/** Single-process invalidation fan-out. Reconnect always refetches authoritative state. */
export class NodeRealtime implements TripChangePublisher {
  private readonly rooms = new Map<string, Room>();
  private readonly wss = new WebSocketServer({ noServer: true, maxPayload: 2048, perMessageDeflate: false });
  private closed = false;
  private pendingUpgrades = 0;
  private readonly timer: ReturnType<typeof setInterval>;
  private server?: Server;
  constructor(private options: NodeRealtimeOptions) {
    this.timer = setInterval(() => {
      for (const room of this.rooms.values()) void this.enqueue(room, async () => {
        for (const client of room.clients) {
          if (!client.alive) client.socket.terminate();
          else { client.alive = false; client.socket.ping(); }
        }
        await this.revalidate(room);
        this.presence(room);
      });
    }, options.recheckMs ?? 20_000);
    this.timer.unref();
  }
  attach(server: Server) { this.server = server; server.on("upgrade", this.upgrade); }
  private enqueue(room: Room, operation: () => Promise<void>) {
    const result = room.pending.then(operation);
    room.pending = result.catch(() => { for (const client of room.clients) client.socket.close(1011, "Realtime unavailable"); });
    return room.pending;
  }
  private upgrade = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    socket.on("error", () => {});
    if (this.closed || this.wss.clients.size + this.pendingUpgrades >= 1000) { this.reject(socket, 503); return; }
    this.pendingUpgrades++;
    const timeout = setTimeout(() => socket.destroy(), 10_000);
    timeout.unref();
    void this.connect(request, socket, head).catch(() => this.reject(socket, 503)).finally(() => { this.pendingUpgrades--; clearTimeout(timeout); });
  };
  private reject(socket: Duplex, code: number) {
    if (!socket.destroyed) socket.end(`HTTP/1.1 ${code} Rejected\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  }
  private async connect(request: IncomingMessage, socket: Duplex, head: Buffer) {
    const url = new URL(request.url ?? "/", "http://localhost");
    const match = /^\/api\/trips\/([^/]+)\/realtime$/.exec(url.pathname);
    if (!match) return this.reject(socket, 404);
    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
    const origin = headers.get("origin");
    if (origin ? !this.options.trustedOrigins.includes(origin) : !headers.get("authorization")?.startsWith("Bearer ")) return this.reject(socket, 403);
    let tripId: string;
    try { tripId = decodeURIComponent(match[1]!); } catch { return this.reject(socket, 400); }
    const identity = await this.options.authorize(headers, tripId);
    if (!identity) return this.reject(socket, 401);
    if (this.closed || socket.destroyed) return this.reject(socket, 503);
    this.wss.handleUpgrade(request, socket, head, ws => {
      let room = this.rooms.get(tripId);
      if (!room) { room = { clients: new Set(), sequence: 0, seen: new Set(), pending: Promise.resolve() }; this.rooms.set(tripId, room); }
      const active = room;
      const client: Client = { alive: true, queued: 0, socket: ws, headers, identity: { ...identity, tripId, connectionId: crypto.randomUUID() } };
      active.clients.add(client);
      ws.on("pong", () => { client.alive = true; });
      ws.on("error", () => ws.terminate());
      ws.on("close", () => {
        active.clients.delete(client);
        if (!active.clients.size && this.rooms.get(tripId) === active) this.rooms.delete(tripId);
        else void this.enqueue(active, async () => { await this.revalidate(active); this.presence(active); });
      });
      ws.on("message", (data, binary) => {
        if (binary) { ws.close(1003, "Text messages only"); return; }
        if (++client.queued > 16) { ws.close(1008, "Too many pending messages"); return; }
        void this.enqueue(active, async () => {
          client.queued--;
          if (!await this.check(client)) return;
          if (data.toString() === "ping") { ws.send("pong"); return; }
          if (!parseRealtimeClientMessage(data.toString())) { ws.close(1008, "Unsupported message"); return; }
          // Sequence alone cannot identify the server incarnation. Refetch even if
          // an old cursor coincidentally matches after a restart/room eviction.
          this.send(client, { type: "resync_required", sequence: active.sequence });
        });
      });
      void this.enqueue(active, async () => {
        await this.revalidate(active);
        if (!active.clients.has(client)) return;
        this.send(client, { type: "hello", connectionId: client.identity.connectionId, sequence: active.sequence, presence: this.members(active) });
        this.presence(active);
      });
    });
  }
  private async check(client: Client) {
    try {
      const current = await this.options.authorize(client.headers, client.identity.tripId);
      if (current && current.userId === client.identity.userId) { client.identity = { ...client.identity, ...current }; return true; }
    } catch { /* Fail closed on session or membership lookup errors. */ }
    client.socket.close(1008, "Access expired");
    this.rooms.get(client.identity.tripId)?.clients.delete(client);
    return false;
  }
  private async revalidate(room: Room) { for (const client of [...room.clients]) await this.check(client); }
  private members(room: Room) { return buildPresence([...room.clients].map(client => client.identity)); }
  private presence(room: Room) { for (const client of room.clients) this.send(client, { type: "presence", members: this.members(room) }); }
  private send(client: Client, message: RealtimeServerMessage) {
    if (client.socket.readyState !== WebSocket.OPEN) return;
    if (client.socket.bufferedAmount > 256 * 1024) { client.socket.terminate(); return; }
    client.socket.send(encodeRealtimeMessage(message));
  }
  async publish(change: TripChange) {
    const room = this.rooms.get(change.tripId);
    if (!room || this.closed) return;
    await this.enqueue(room, async () => {
      await this.revalidate(room);
      if (room.seen.has(change.eventId)) return;
      room.seen.add(change.eventId);
      if (room.seen.size > 256) room.seen.delete(room.seen.values().next().value!);
      room.sequence++;
      for (const client of room.clients) this.send(client, { type: "change", sequence: room.sequence, change });
    });
  }
  async close() {
    this.closed = true; clearInterval(this.timer);
    this.server?.off("upgrade", this.upgrade);
    for (const socket of this.wss.clients) socket.terminate();
    await Promise.all([...this.rooms.values()].map(room => room.pending));
    await new Promise<void>(resolve => this.wss.close(() => resolve()));
    this.rooms.clear();
  }
}
