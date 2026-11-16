import type { RequestHandler } from "express";

export function cors(origins: readonly string[]): RequestHandler {
  return (req, res, next) => {
    const origin = req.get("origin");
    if (origin && origins.includes(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
    res.vary("Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Expose-Headers", "x-request-id,x-agent-turn-id");
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,PUT,POST,DELETE,PATCH");
      const headers = req.get("access-control-request-headers");
      if (headers) res.setHeader("Access-Control-Allow-Headers", headers);
      res.status(204).end();
      return;
    }
    next();
  };
}
