import express from "express";
import { resolve } from "node:path";
import { existsSync } from "node:fs";

/** Optional same-origin SPA hosting, mounted after API routes. */
export function nodeWeb(dist: string) {
  const root = resolve(dist);
  if (!existsSync(resolve(root, "index.html"))) throw new Error("WEB_DIST_PATH must contain a built frontend");
  const router = express.Router();
  router.use(express.static(root, { dotfiles: "deny", setHeaders(res, path) {
    if (path.endsWith("index.html") || path.endsWith("sw.js")) res.setHeader("Cache-Control", "no-cache");
  } }));
  router.get("/{*path}", (_req, res) => res.setHeader("Cache-Control", "no-cache").sendFile(resolve(root, "index.html")));
  return router;
}
