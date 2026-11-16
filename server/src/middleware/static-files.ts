import express from "express";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

/** Resolve the standard frontend independently of pnpm's package working directory. */
export function resolveWebDist(dist: string) {
  const standard = fileURLToPath(new URL("../../../client/dist/", import.meta.url));
  return ["auto", "client/dist", "../client/dist"].includes(dist.trim()) ? standard : resolve(dist);
}

/** Optional same-origin SPA hosting, mounted after API routes. */
export function nodeWeb(dist: string) {
  const root = resolveWebDist(dist);
  if (!existsSync(resolve(root, "index.html"))) throw new Error(`Frontend missing at ${resolve(root, "index.html")}. Run bash scripts/build-render.sh from the repository root and set WEB_DIST_PATH=auto (or an absolute built frontend path).`);
  const router = express.Router();
  router.use(express.static(root, {
    dotfiles: "deny", setHeaders(res, path) {
      if (path.endsWith("index.html") || path.endsWith("sw.js")) res.setHeader("Cache-Control", "no-cache");
    }
  }));
  router.get("/{*path}", (_req, res) => res.setHeader("Cache-Control", "no-cache").sendFile(resolve(root, "index.html")));
  return router;
}
