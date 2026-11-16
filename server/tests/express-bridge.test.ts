import { afterEach, describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";
import { createExpressApp } from "../src/app";
import type { Container } from "../src/config/container";

let server: Server | undefined;
afterEach(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise<void>(resolve => server!.close(() => resolve()));
    server = undefined;
  }
});
async function start(handler: (request: Request) => Promise<Response> | Response, replaceAvatar?: (...args: unknown[]) => Promise<string>, readSession = async (): Promise<{ user: { id: string }; session: object } | null> => ({ user: { id: "u1" }, session: {} })) {
  const container = {
    config: { trustedOrigins: ["https://web.test"], betterAuthUrl: "https://api.test" },
    avatarService: { replace: replaceAvatar },
    auth: { handler, api: { getSession: readSession } },
  } as unknown as Container;
  const app = createExpressApp(container);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => { server!.once("listening", resolve); server!.once("error", reject); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing listener");
  return `http://127.0.0.1:${address.port}`;
}

describe("Express Web/Node bridge", () => {
  it("preserves raw auth payloads, multiple cookies and private request metadata", async () => {
    const base = await start(async req => {
      expect(await req.text()).toBe("raw auth payload");
      const headers = new Headers();
      headers.append("set-cookie", "one=1; HttpOnly; Path=/");
      headers.append("set-cookie", "two=2; HttpOnly; Path=/");
      return new Response("ok", { headers });
    });
    const response = await fetch(`${base}/api/auth/probe`, { method: "POST", body: "raw auth payload", headers: { "x-request-id": "request-probe-123" } });
    expect(response.headers.getSetCookie()).toHaveLength(2);
    expect(response.headers.get("x-request-id")).toBe("request-probe-123");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.text()).toBe("ok");
  });
  it("serves CORS preflight before authentication and request parsing", async () => {
    const base = await start(() => { throw new Error("Auth handler must not run"); });
    const response = await fetch(`${base}/api/auth/probe`, { method: "OPTIONS", headers: {
      origin: "https://web.test", "access-control-request-headers": "content-type,authorization",
    } });
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://web.test");
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
  });
  it("delivers the first stream chunk before generation finishes and cancels on disconnect", async () => {
    let requestSignal: AbortSignal | undefined;
    let cancelled = false;
    const base = await start(req => {
      requestSignal = req.signal;
      return new Response(new ReadableStream({
        start(controller) { controller.enqueue(new TextEncoder().encode("first")); },
        cancel() { cancelled = true; },
      }), { headers: { "content-type": "text/event-stream" } });
    });
    const controller = new AbortController();
    const response = await fetch(`${base}/api/auth/stream`, { signal: controller.signal });
    const reader = response.body!.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toBe("first");
    controller.abort();
    await reader.cancel().catch(() => {});
    await vi.waitFor(() => {
      expect(requestSignal?.aborted).toBe(true);
      expect(cancelled).toBe(true);
    });
  });
  it("rejects oversized streamed bodies with the route's existing envelope", async () => {
    const base = await start(() => new Response("unused"));
    const response = await fetch(`${base}/api/voice/summary/text`, { method: "POST", headers: {
      origin: "https://web.test", "content-type": "application/json",
    }, body: new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode("x".repeat(1001))); c.close(); } }), duplex: "half" } as RequestInit);
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ error: { code: "request_too_large" } });
  });
  it("parses multipart uploads without consuming or altering file bytes", async () => {
    const replace = vi.fn(async (...args: unknown[]) => {
      const upload = args[2] as { content: Uint8Array; claimedMimeType: string };
      expect([...upload.content]).toEqual([0, 1, 128, 255]);
      expect(upload.claimedMimeType).toBe("image/png");
      return "https://api.test/api/uploads/avatar/u1.png";
    });
    const base = await start(() => new Response("unused"), replace);
    const form = new FormData();
    form.set("avatar", new File([new Uint8Array([0, 1, 128, 255])], "avatar.png", { type: "image/png" }));
    const response = await fetch(`${base}/api/users/avatar`, { method: "POST", body: form });
    expect(response.status).toBe(201);
    expect(replace).toHaveBeenCalledOnce();
    expect(await response.json()).toMatchObject({ data: { url: "https://api.test/api/uploads/avatar/u1.png" } });
  });

  it("preserves case-sensitive paths and strict trailing slashes", async () => {
    const base = await start(req => new Response(new URL(req.url).search));
    expect((await fetch(`${base}/API/health`)).status).toBe(404);
    expect((await fetch(`${base}/api/health/`)).status).toBe(404);
  });

  it("keeps unknown routes public 404s while protecting matched API routes", async () => {
    const base = await start(() => new Response("unused"), undefined, async () => null);
    expect((await fetch(`${base}/api/unknown`)).status).toBe(404);
    expect((await fetch(`${base}/api/trips/t/agent/unknown`)).status).toBe(404);
    const response = await fetch(`${base}/api/trips`);
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: "unauthenticated" } });
  });

  it("handles asynchronous middleware failures with the private error envelope", async () => {
    const base = await start(() => new Response("unused"), undefined, async () => { throw new Error("private database detail"); });
    const response = await fetch(`${base}/api/health`, { headers: { origin: "https://web.test" } });
    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-request-id")).toBeTruthy();
    expect(response.headers.get("access-control-allow-origin")).toBe("https://web.test");
    expect(await response.text()).not.toContain("private database detail");
  });

  it("preserves CORS cache variation when an SDK supplies its own Vary header", async () => {
    const base = await start(() => new Response("ok", { headers: { vary: "Accept" } }));
    const response = await fetch(`${base}/api/auth/probe`, { headers: { origin: "https://web.test" } });
    expect(response.headers.get("vary")?.toLowerCase()).toContain("origin");
    expect(response.headers.get("vary")?.toLowerCase()).toContain("accept");
  });

  it("rejects malformed route parameter encoding as a client error", async () => {
    const base = await start(() => new Response("unused"));
    const response = await fetch(`${base}/api/trips/%E0%A4%A`);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "validation_error" } });
  });

});
