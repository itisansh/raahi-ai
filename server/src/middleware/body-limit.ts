import type { RequestHandler } from "express";
import { contextFor, sendResponse, type HttpContext } from "./web-context";

export function bodyLimit(options: { maxSize: number; onError: (context: HttpContext) => Response }): RequestHandler {
  return async (_req, res, next) => {
    const c = contextFor(res);
    const length = c.req.header("content-length");
    if (length && Number(length) > options.maxSize) return sendResponse(c, options.onError(c), res);
    const reader = c.req.raw.body?.getReader();
    if (!reader) return next();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > options.maxSize) { void reader.cancel().catch(() => { }); return sendResponse(c, options.onError(c), res); }
        chunks.push(part.value);
      }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    c.req.raw = new Request(c.req.raw.url, {
      method: c.req.method, headers: c.req.raw.headers,
      body: bytes, signal: c.req.raw.signal
    });
    next();
  };
}
