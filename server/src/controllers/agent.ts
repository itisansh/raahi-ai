import { initiatingAgentTurnId } from "../services";
import type { Container } from "../config/container";
import { ok } from "../controllers/response";
import type { Controller } from "../middleware/web-context";
import type { CreateAppOptions } from "../config/http";
import { createControllerHelpers } from "./helpers";
import { agentPostMessageSchema, agentChatSchema, agentApprovalSchema, agentEventsQuerySchema } from "./schemas";

export function createAgentControllers(container: Container, options: CreateAppOptions) {
  const { agentService } = container;
  const { deferOf } = createControllerHelpers(container, options);
  return {
    getHistory: async (c) =>
      ok(
        c,
        await agentService!.getHistory(c.req.param("tripId")!, c.get("user")!.id),
      ),

    postMessage: async (c) => {
      const body = agentPostMessageSchema.parse(await c.req.json());
      return ok(
        c,
        await agentService!.postMessage(
          c.req.param("tripId")!,
          c.get("user")!.id,
          {
            text: body.text,
            files: body.files,
            observability: {
              requestId: c.get("requestId"),
              runtime: options.runtime,
            },
          },
          deferOf(c),
        ),
      );
    },

    streamChat: async (c) => {
      const input = agentChatSchema.parse(await c.req.json());
      const clientMessages =
        input.messages ?? (input.message ? [input.message] : undefined);

      const hasApprovalResponse = (clientMessages ?? []).some((m) =>
        m.parts.some((p) => {
          const state = (p as { state?: unknown }).state;
          const approval = (p as { approval?: { approved?: unknown } }).approval;
          return (
            state === "approval-responded" ||
            (typeof approval === "object" &&
              approval !== null &&
              typeof (approval as { approved?: unknown }).approved === "boolean" &&
              state !== "approval-requested")
          );
        }),
      );

      // Prefer the latest user text (and its client id) from the UI message list.
      // Attachment-only turns still need the client id for history dedupe.
      let text: string | null = null;
      let clientMessageId: string | undefined;
      if (!hasApprovalResponse && clientMessages?.length) {
        for (let i = clientMessages.length - 1; i >= 0; i--) {
          const m = clientMessages[i]!;
          if (m.role !== "user") continue;
          const joined = m.parts
            .filter((p) => p.type === "text" && typeof p.text === "string")
            .map((p) => p.text as string)
            .join("\n")
            .trim();
          const hasFile = m.parts.some((p) => p.type === "file");
          if (joined || hasFile) {
            text = joined || null;
            clientMessageId = m.id;
            break;
          }
        }
      }

      const tripId = c.req.param("tripId")!;
      const turnId = initiatingAgentTurnId(clientMessages, clientMessageId);
      c.set("agentContext", { tripId, turnId });
      c.header("x-agent-turn-id", turnId);

      // Streaming response: returned as-is, outside the { data } envelope.
      // Pass defer so onFinish persistence outlives the Response return and
      // graceful shutdown waits until the assistant row is written.
      const response = await agentService!.streamChat(
        tripId,
        c.get("user")!.id,
        {
          text,
          clientMessageId,
          clientMessages,
          approvalContinue: hasApprovalResponse,
          requestId: c.get("requestId"),
          runtime: options.runtime,
          turnId,
        },
        deferOf(c),
      );
      response.headers.set("x-agent-turn-id", turnId);
      return response;
    },

    getEvents: async (c) => {
      const afterSeq = agentEventsQuerySchema.parse(c.req.query("after"));
      return ok(
        c,
        await agentService!.listEvents(
          c.req.param("tripId")!,
          c.get("user")!.id,
          afterSeq,
        ),
      );
    },

    approveSuggestion: async (c) => {
      const body = agentApprovalSchema.parse(await c.req.json().catch(() => ({})));
      const suggestionId = c.req.param("suggestionId");
      return ok(
        c,
        await agentService!.respondToSuggestion(
          c.req.param("tripId")!,
          c.get("user")!.id,
          {
            id: body.id ?? suggestionId,
            approved: body.approved,
            reason: body.reason,
          },
        ),
      );
    },

    applySuggestion: async (c) => {
      const body = agentApprovalSchema
        .partial()
        .parse(await c.req.json().catch(() => ({})));
      return ok(
        c,
        await agentService!.respondToSuggestion(
          c.req.param("tripId")!,
          c.get("user")!.id,
          {
            id: body.id ?? c.req.param("suggestionId"),
            approved: body.approved ?? true,
            reason: body.reason,
          },
        ),
      );
    },

    dismissSuggestion: async (c) => {
      const body = agentApprovalSchema
        .partial()
        .parse(await c.req.json().catch(() => ({})));
      return ok(
        c,
        await agentService!.respondToSuggestion(
          c.req.param("tripId")!,
          c.get("user")!.id,
          {
            id: body.id ?? c.req.param("suggestionId"),
            approved: false,
            reason: body.reason,
          },
        ),
      );
    }
  } satisfies Record<string, Controller>;
}

