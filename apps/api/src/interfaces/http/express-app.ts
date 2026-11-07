import express from "express";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { pipeline } from "node:stream/promises";
import { fromNodeHeaders } from "better-auth/node";
import type { Container } from "../../config/container";
import { createRouteTable, type CreateAppOptions } from "./app";
import { dispatch, type HttpContext, type Variables } from "./transport";

class NodeContext implements HttpContext {
  private variables: Partial<Variables> = {};
  private headers = new Headers();
  private response = new Response("404 Not Found", { status: 404 });
  readonly executionCtx = { waitUntil: (task: Promise<unknown>) => { void task; } };
  req: HttpContext["req"];
  constructor(raw: Request, params: Record<string, string>, routePath: string) {
    const url = new URL(raw.url);
    this.req = {
      raw, method: raw.method, path: url.pathname, routePath,
      header: name => this.req.raw.headers.get(name) ?? undefined,
      param: name => params[name] ?? "",
      query: ((name?: string) => name === undefined
        ? Object.fromEntries(Array.from(url.searchParams.keys(), key => [key, url.searchParams.get(key)!])) : url.searchParams.get(name) ?? undefined) as HttpContext["req"]["query"],
      json: () => this.req.raw.json(),
      parseBody: async () => Object.fromEntries(await this.req.raw.formData()),
    };
  }
  get res() { return this.response; }
  set res(value: Response) {
    const headers = new Headers(value.headers);
    this.headers.forEach((v, k) => headers.set(k, v));
    this.response = new Response(value.body, { status: value.status, statusText: value.statusText, headers });
  }
  get<K extends keyof Variables>(key: K): Variables[K] { return this.variables[key] as Variables[K]; }
  set<K extends keyof Variables>(key: K, value: Variables[K]) { this.variables[key] = value; }
  header(name: string, value: string) { this.headers.set(name, value); this.response.headers.set(name, value); }
  json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } }); }
  text(data: string, status = 200) { return new Response(data, { status, headers: { "Content-Type": "text/plain; charset=UTF-8" } }); }
  body(data: ArrayBuffer, status = 200) { return new Response(data, { status }); }
  redirect(url: string, status = 302) { return new Response(null, { status, headers: { Location: url } }); }
}

/** Stream Web responses to Node with backpressure; cancel upstream on disconnect. */
export async function sendWebResponse(response: Response, res: ServerResponse): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, name) => { if (name !== "set-cookie") res.setHeader(name, value); });
  const cookies = response.headers.getSetCookie();
  if (cookies.length) res.setHeader("set-cookie", cookies);
  if (!response.body) { res.end(); return; }
  const body = Readable.fromWeb(response.body as NodeReadableStream);
  await pipeline(body, res);
}

export function createExpressApp(container: Container, options: CreateAppOptions = { runtime: "node" }, trustedProxies: string[] = []) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", trustedProxies);
  app.enable("strict routing");
  app.enable("case sensitive routing");
  const table = createRouteTable(container, options);
  const handle = (path: string, handlers: Parameters<typeof dispatch>[1]): express.RequestHandler => async (req, res) => {
    const controller = new AbortController();
    const abort = () => { if (!res.writableFinished) controller.abort(); };
    req.once("aborted", abort);
    res.once("close", abort);
    try {
      // No JSON parser precedes auth: it receives the original, unconsumed stream.
      const raw = new Request(new URL(req.originalUrl, container.config.betterAuthUrl || "http://localhost"), {
        method: req.method, headers: nodeRequestHeaders(req), signal: controller.signal,
        ...(["GET", "HEAD"].includes(req.method) ? {} : {
          body: Readable.toWeb(req as IncomingMessage) as ReadableStream<Uint8Array>, duplex: "half",
        }),
      });
      const params = Object.fromEntries(Object.entries(req.params).map(([k, v]) => [k, Array.isArray(v) ? v.join("/") : v]));
      const context = new NodeContext(raw, params, path);
      const response = await dispatch(table, [...table.middleware, ...handlers], context);
      await sendWebResponse(response, res);
    } catch (error) {
      if (res.destroyed || controller.signal.aborted) return;
      // Handler errors already use the shared envelope; this handles bridge failures.
      if (res.headersSent) { res.destroy(error instanceof Error ? error : undefined); return; }
      res.status(500).json({ error: { code: "internal_error", message: "Something went wrong" } });
    } finally {
      req.off("aborted", abort); res.off("close", abort);
    }
  };
  for (const endpoint of table.endpoints) {
    const path = endpoint.path.replace(/\/\*$/, "/{*splat}");
    app.route(path)[endpoint.method.toLowerCase() as "get"](handle(endpoint.path, endpoint.handlers));
  }
  app.use(handle("*", []));
  return app;
}

/** This private header is always overwritten from Express’s verified client IP, never trusted from callers. */
export function nodeRequestHeaders(req: Pick<express.Request, "headers" | "socket"> & { ip?: string }): Headers {
  const headers = fromNodeHeaders(req.headers);
  headers.delete("x-raahi-client-ip");
  const address = req.ip ?? req.socket.remoteAddress;
  if (address) headers.set("x-raahi-client-ip", address);
  return headers;
}
