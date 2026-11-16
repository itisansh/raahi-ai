import type express from "express";
import type { ServerResponse } from "node:http";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { pipeline } from "node:stream/promises";
import { fromNodeHeaders } from "better-auth/node";
import type { Container } from "../config/container";

type Session = Container["auth"]["$Infer"]["Session"];
export interface Variables {
  user: Session["user"] | null;
  session: Session["session"] | null;
  requestId: string;
  agentContext?: { tripId: string; turnId: string };
}
export interface HttpContext {
  req: {
    raw: Request;
    method: string;
    path: string;
    routePath: string;
    header(name: string): string | undefined;
    param(name: string): string;
    query(): Record<string, string>;
    query(name: string): string | undefined;
    json(): Promise<unknown>;
    parseBody(): Promise<Record<string, string | File>>;
  };
  res: Response;
  get<K extends keyof Variables>(key: K): Variables[K];
  set<K extends keyof Variables>(key: K, value: Variables[K]): void;
  header(name: string, value: string): void;
  json(data: unknown, status?: number): Response;
  text(data: string, status?: number): Response;
  body(data: ArrayBuffer, status?: number): Response;
  redirect(url: string, status?: number): Response;
}

class NodeContext implements HttpContext {
  private variables: Partial<Variables> = {};
  private headers = new Headers();
  private response = new Response("404 Not Found", { status: 404 });
  req: HttpContext["req"];
  constructor(raw: Request, request: express.Request) {
    const url = new URL(raw.url);
    this.req = {
      raw, method: raw.method, path: url.pathname, routePath: "*",
      header: name => this.req.raw.headers.get(name) ?? undefined,
      param: name => { const value = request.params[name]; return Array.isArray(value) ? value.join("/") : value ?? ""; },
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
  response.headers.forEach((value, name) => {
    if (name === "set-cookie") return;
    if (name === "vary" && res.hasHeader("vary")) {
      const fields = new Set(`${res.getHeader("vary")},${value}`.split(",").map(field => field.trim().toLowerCase()));
      res.setHeader(name, [...fields].join(", "));
    } else res.setHeader(name, value);
  });
  const cookies = response.headers.getSetCookie();
  if (cookies.length) res.setHeader("set-cookie", cookies);
  if (!response.body) { res.end(); return; }
  const body = Readable.fromWeb(response.body as NodeReadableStream);
  await pipeline(body, res);
}

/** This private header is always overwritten from Express’s verified client IP, never trusted from callers. */
export function nodeRequestHeaders(req: Pick<express.Request, "headers" | "socket"> & { ip?: string }): Headers {
  const headers = fromNodeHeaders(req.headers);
  headers.delete("x-raahi-client-ip");
  const address = req.ip ?? req.socket.remoteAddress;
  if (address) headers.set("x-raahi-client-ip", address);
  return headers;
}

export type Controller = (context: HttpContext) => Response | Promise<Response>;
export const contextFor = (res: express.Response): HttpContext => res.locals.context as HttpContext;

/** Web primitives at the SDK boundary; Express owns all routing and middleware. */
export function requestContext(baseUrl: string): express.RequestHandler {
  return (req, res, next) => {
    const controller = new AbortController();
    const abort = () => { if (!res.writableFinished) controller.abort(); };
    const cleanup = () => { req.off("aborted", abort); res.off("close", abort); };
    req.once("aborted", abort);
    res.once("close", abort);
    res.once("close", cleanup);
    res.once("finish", cleanup);
    try {
      // Keep the original bytes: Better Auth and multipart routes parse their own bodies.
      const raw = new Request(new URL(req.originalUrl, baseUrl || "http://localhost"), {
        method: req.method, headers: nodeRequestHeaders(req), signal: controller.signal,
        ...(["GET", "HEAD"].includes(req.method) ? {} : {
          body: Readable.toWeb(req) as ReadableStream<Uint8Array>, duplex: "half",
        }),
      });
      res.locals.context = new NodeContext(raw, req);
      next();
    } catch (error) { next(error); }
  };
}

/** Parameterized route identity keeps user identifiers out of telemetry. */
export function routeContext(path: string): express.RequestHandler {
  return (_req, res, next) => { contextFor(res).req.routePath = path; next(); };
}

export async function sendResponse(context: HttpContext, response: Response, res: express.Response) {
  context.res = response;
  await sendWebResponse(context.res, res);
}

/** Adapt a Web-response controller to an ordinary Express request handler. */
export function endpoint(controller: Controller): express.RequestHandler {
  return async (_req, res) => {
    const context = contextFor(res);
    await sendResponse(context, await controller(context), res);
  };
}
