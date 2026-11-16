import express from "express";
import { nodeWeb } from "./middleware/static-files";
import { NodeRealtime } from "./realtime/node-realtime";
import { createNodeRateLimitStorage } from "./integrations/auth/node-rate-limit-storage";
import { createMongoContainer } from "./config/mongo-container";
import { loadNodeConfig } from "./config/env";
import { createNodeStorage } from "./integrations/storage/create-node-storage";
import { createExpressApp } from "./app";
import * as Sentry from "@sentry/node";
import { initializeNodeObservability } from "./integrations/observability/node";
import {
  registerAiTelemetry,
  setRuntimeName,
} from "./integrations/observability";

const config = loadNodeConfig(process.env);
setRuntimeName("node");
initializeNodeObservability(config.observability);
registerAiTelemetry();
const realtime = new NodeRealtime({
  trustedOrigins: config.trustedOrigins,
  async authorize(headers, tripId) {
    const session = await container.auth.api.getSession({ headers });
    if (!session) return null;
    try {
      const trip = await container.tripService.getTrip(tripId, session.user.id);
      const member = trip.members.find(member => member.userId === session.user.id);
      if (!member || !trip.permissions.isMember) return null;
      return { userId: session.user.id, name: session.user.name || session.user.email, image: session.user.image ?? null, role: member.role };
    } catch { return null; }
  },
});
const container = await createMongoContainer(config, createNodeStorage(config.storage), {
  tripChangePublisher: realtime,
  authRateLimitStorage: createNodeRateLimitStorage(),
  authIpAddressHeaders: ["x-raahi-client-ip"],
});
const api = createExpressApp(container, {
  runtime: "node",
  setRequestContext: ({ requestId }) => {
    Sentry.setTag("request.id", requestId);
  },
}, process.env.TRUST_PROXY_CIDRS?.split(",").map(value => value.trim()).filter(Boolean) ?? []);
const app = express();
app.disable("x-powered-by");
app.use((_request, _response, next) => Sentry.withIsolationScope(() => next()));
if (process.env.WEB_DIST_PATH) {
  app.use((req, res, next) => req.path === "/api" || req.path.startsWith("/api/") ? api(req, res, next) : next());
  app.use(nodeWeb(process.env.WEB_DIST_PATH));
} else app.use(api);
const port = Number(process.env.PORT ?? 8780);

const server = app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

realtime.attach(server);

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  // Stop admissions and let HTTP streams finish before draining deferred writes.
  const timeout = setTimeout(() => server.closeAllConnections(), 30_000);
  timeout.unref();
  await realtime.close();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await container.disposeAfterDeferred();
  await Sentry.close(2_000);
  clearTimeout(timeout);
}
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => { void shutdown().catch(error => { console.error(error); process.exitCode = 1; }); });
}
