import { type Defer } from "../services";
import type { OperationEvent } from "../services/rules/agent";
import type { Container } from "../config/container";
import { captureException, logger } from "../integrations/observability";
import type { HttpContext } from "../middleware/web-context";
import type { CreateAppOptions } from "../config/http";
type Session = Container["auth"]["$Infer"]["Session"];

export function createControllerHelpers(container: Container, options: CreateAppOptions) {
  const { agentService } = container;
  const deferOf = (c: HttpContext): Defer => (task) => {
    const guarded = task.catch((err) => {
      logger.error("agent.deferred_task_failed", {
        runtime: options.runtime,
        requestId: c.get("requestId"),
        error: err,
      });
      captureException(err, {
        runtime: options.runtime,
        requestId: c.get("requestId"),
      });
    },
    );
    container.trackDeferred(guarded);

  };

  const notifyAgent = (
    c: HttpContext,
    event: Omit<OperationEvent, "actorUserId" | "actorName">,
  ) => {
    if (!agentService) return;
    const user = c.get("user");
    if (!user) return;
    const defer = deferOf(c);
    defer(
      agentService.recordOperation(
        { ...event, actorUserId: user.id, actorName: user.name || user.email },
        defer,
        { requestId: c.get("requestId"), runtime: options.runtime },
      ),
    );
  };

  const inviteActor = (u: Session["user"]) => ({
    id: u.id,
    name: u.name || u.email,
    email: u.email,
    image: u.image ?? null,
  });
  return { deferOf, notifyAgent, inviteActor };
}
