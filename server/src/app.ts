import express from "express";
import type { Container } from "./config/container";
import type { CreateAppOptions } from "./config/http";
import { createRoutes } from "./routes";
import { requestContext, endpoint } from "./middleware/web-context";
import { requestMetadata } from "./middleware/request-metadata";
import { cors } from "./middleware/cors";
import { resolveSession } from "./middleware/session";
import { errorHandler } from "./middleware/error-handler";

export function createExpressApp(container: Container, options: CreateAppOptions = { runtime: "node" }, trustedProxies: string[] = []) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", trustedProxies);
  app.enable("strict routing");
  app.enable("case sensitive routing");
  app.use(requestContext(container.config.betterAuthUrl));
  app.use(requestMetadata(options));
  app.use(cors(container.config.trustedOrigins));
  app.use(resolveSession(container));
  app.use(createRoutes(container, options));
  app.use(endpoint(context => context.text("404 Not Found", 404)));
  app.use(errorHandler(options));
  return app;
}
