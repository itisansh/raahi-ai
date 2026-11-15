import { afterEach } from "vitest";
import type { Server } from "node:http";
import { createExpressApp } from "../src/interfaces/http/express-app";
import type { CreateAppOptions } from "../src/interfaces/http/app";
import type { Container } from "../src/config/container";

const servers = new Set<Server>();
const nodeFetch = globalThis.fetch;
afterEach(async () => {
  for (const server of servers) {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
  servers.clear();
});

/** Run HTTP assertions against the Express transport. */
export function createApp(container: Container, options?: CreateAppOptions) {
  const app = createExpressApp(container, options);
  let server: Server | undefined;
  let ready: Promise<void> | undefined;
  return {
    async request(input: string | URL | Request, init?: RequestInit): Promise<Response> {
      if (!server) {
        server = app.listen(0, "127.0.0.1");
        servers.add(server);
        ready = new Promise((resolve, reject) => {
          server!.once("listening", resolve);
          server!.once("error", reject);
        });
      }
      await ready;
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Test listener missing");
      const source = new Request(input instanceof Request ? input : new URL(input, "http://localhost"), init);
      const url = new URL(source.url);
      const target = `http://127.0.0.1:${address.port}${url.pathname}${url.search}`;
      return nodeFetch(target, { method: source.method, headers: source.headers,
        body: source.body, duplex: "half", redirect: "manual" } as RequestInit);
    },
  };
}
