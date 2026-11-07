import type { Container } from "../../config/container";

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
  executionCtx: { waitUntil(task: Promise<unknown>): void };
  get<K extends keyof Variables>(key: K): Variables[K];
  set<K extends keyof Variables>(key: K, value: Variables[K]): void;
  header(name: string, value: string): void;
  json(data: unknown, status?: number): Response;
  text(data: string, status?: number): Response;
  body(data: ArrayBuffer, status?: number): Response;
  redirect(url: string, status?: number): Response;
}
export type Handler = (context: HttpContext, next: () => Promise<void>) => Response | void | Promise<Response | void>;
export interface Endpoint { method: string; path: string; handlers: Handler[] }

/** Transport-independent registration; Express and Worker routing share handlers. */
export class RouteTable {
  endpoints: Endpoint[] = [];
  middleware: Handler[] = [];
  errorHandler!: (error: Error, context: HttpContext) => Response;
  use(_path: string, handler: Handler) { this.middleware.push(handler); }
  on(methods: string[], path: string, ...handlers: Handler[]) {
    for (const method of methods) this.endpoints.push({ method, path, handlers });
  }
  get(path: string, ...handlers: Handler[]) { this.on(["GET"], path, ...handlers); }
  post(path: string, ...handlers: Handler[]) { this.on(["POST"], path, ...handlers); }
  put(path: string, ...handlers: Handler[]) { this.on(["PUT"], path, ...handlers); }
  patch(path: string, ...handlers: Handler[]) { this.on(["PATCH"], path, ...handlers); }
  delete(path: string, ...handlers: Handler[]) { this.on(["DELETE"], path, ...handlers); }
  route(prefix: string, child: RouteTable) {
    for (const endpoint of child.endpoints) this.endpoints.push({ ...endpoint,
      path: prefix + endpoint.path, handlers: [...child.middleware, ...endpoint.handlers] });
  }
  onError(handler: RouteTable["errorHandler"]) { this.errorHandler = handler; }
}

export async function dispatch(table: RouteTable, handlers: Handler[], context: HttpContext): Promise<Response> {
  let index = -1;
  async function run(position: number): Promise<void> {
    if (position <= index) throw new Error("Middleware called next twice");
    index = position;
    const handler = handlers[position];
    if (!handler) return;
    try {
      const response = await handler(context, () => run(position + 1));
      if (response) context.res = response;
    } catch (error) {
      context.res = table.errorHandler(error instanceof Error ? error : new Error(String(error)), context);
    }
  }
  await run(0);
  return context.res;
}

export function cors(options: { origin: string[]; credentials: boolean; exposeHeaders: string[] }): Handler {
  return async (c, next) => {
    const origin = c.req.header("origin");
    if (origin && options.origin.includes(origin)) c.header("Access-Control-Allow-Origin", origin);
    c.header("Vary", "Origin");
    c.header("Access-Control-Allow-Credentials", "true");
    c.header("Access-Control-Expose-Headers", options.exposeHeaders.join(","));
    if (c.req.method === "OPTIONS") {
      c.header("Access-Control-Allow-Methods", "GET,HEAD,PUT,POST,DELETE,PATCH");
      const headers = c.req.header("access-control-request-headers");
      if (headers) c.header("Access-Control-Allow-Headers", headers);
      return new Response(null, { status: 204 });
    }
    await next();
  };
}

export function bodyLimit(options: { maxSize: number; onError: (context: HttpContext) => Response }): Handler {
  return async (c, next) => {
    const length = c.req.header("content-length");
    if (length && Number(length) > options.maxSize) return options.onError(c);
    const reader = c.req.raw.body?.getReader();
    if (!reader) return next();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > options.maxSize) { void reader.cancel().catch(() => {}); return options.onError(c); }
        chunks.push(part.value);
      }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    c.req.raw = new Request(c.req.raw.url, { method: c.req.method, headers: c.req.raw.headers,
      body: bytes, signal: c.req.raw.signal });
    await next();
  };
}
