import express from "express";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { it, expect } from "vitest";
import { nodeWeb } from "../src/middleware/static-files";
import { nodeRequestHeaders } from "../src/middleware/web-context";

it("serves SPA deep links and assets without caching the app shell", async () => {
  const dir = await mkdtemp(join(tmpdir(), "raahi-web-"));
  await writeFile(join(dir, "index.html"), "<html>Raahi</html>");
  await writeFile(join(dir, "sw.js"), "// worker");
  const app = express();
  app.use(nodeWeb(dir));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing listener");
    const base = `http://127.0.0.1:${address.port}`;
    const page = await fetch(`${base}/trips/test`);
    expect(await page.text()).toContain("<html>Raahi</html>");
    const worker = await fetch(`${base}/sw.js`);
    expect(worker.headers.get("cache-control")).toBe("no-cache");
    expect(await worker.text()).toBe("// worker");
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await rm(dir, { recursive: true, force: true });
  }
});

it.each([false, true])("uses forwarded client IP only through an explicitly trusted proxy (%s)", async trusted => {
  const app = express();
  app.set("trust proxy", trusted ? ["loopback"] : []);
  app.get("/", (req, res) => res.send(nodeRequestHeaders(req).get("x-raahi-client-ip")));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing listener");
    const response = await fetch(`http://127.0.0.1:${address.port}`, { headers: {
      "x-forwarded-for": "198.51.100.8, 192.0.2.10", "x-raahi-client-ip": "spoof",
    } });
    expect(await response.text()).toBe(trusted ? "192.0.2.10" : "127.0.0.1");
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

it("resolves standard frontend paths independently of the launch directory", async () => {
  const { resolveWebDist } = await import("../src/middleware/static-files");
  const { fileURLToPath } = await import("node:url");
  const expected = fileURLToPath(new URL("../../client/dist/", import.meta.url));
  for (const path of ["auto", "client/dist", "../client/dist"]) expect(resolveWebDist(path)).toBe(expected);
  expect(resolveWebDist("/tmp/custom-frontend")).toBe("/tmp/custom-frontend");
  expect(() => nodeWeb("/tmp/raahi-nonexistent-build-test")).toThrow("Run bash scripts/build-render.sh");
});
