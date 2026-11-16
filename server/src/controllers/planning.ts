import { VoiceError } from "../services/voice/voice-token-service";
import { ExpenseVoiceError } from "../services/expenses/voice-expense";
import { SpeechError } from "../services/voice/spoken-summary";
import { PlanningError, planningRequestSchema } from "../services/planning/contracts";
import { z } from "zod";
import type { Container } from "../config/container";
import { ok, fail } from "../controllers/response";
import type { Controller } from "../middleware/web-context";

export function createPlanningControllers(container: Container) {
  const { config } = container;
  return {
    issueVoiceToken: async (c) => {
      // CORS alone does not prevent cross-site POSTs to this browser-only endpoint.
      const origin = c.req.header("origin");
      if (!origin || !config.trustedOrigins.includes(origin)) {
        return fail(c, "forbidden_origin", "Origin is not allowed", 403);
      }
      try {
        return ok(c, await container.voiceTokenService.createToken(c.get("user")!.id));
      } catch (error) {
        if (!(error instanceof VoiceError)) throw error;
        if (error.code === "voice_rate_limited") c.header("Retry-After", "60");
        return fail(c, error.code, error.message, error.code === "voice_rate_limited" ? 429 : 503);
      }
    },

    previewExpense: async (c) => {
      const origin = c.req.header("origin");
      if (!origin || !config.trustedOrigins.includes(origin)) return fail(c, "forbidden_origin", "Origin is not allowed", 403);
      const { prompt } = z.object({ prompt: z.string().trim().min(3).max(2000) }).strict().parse(await c.req.json().catch(() => null));
      if (!container.voiceExpenseService) return fail(c, "expense_voice_unavailable", "Expense interpretation unavailable", 503);
      try { return ok(c, await container.voiceExpenseService.preview(c.req.param("tripId"), c.get("user")!.id, prompt)); }
      catch (error) {
        if (!(error instanceof ExpenseVoiceError)) throw error;
        return fail(c, error.code, "Expense draft could not be interpreted; enter it manually", error.code === "expense_voice_rate_limited" ? 429 : 503);
      }
    },

    summarizeProposal: async (c) => {
      c.header("Cache-Control", "no-store");
      const origin = c.req.header("origin");
      if (!origin || !config.trustedOrigins.includes(origin)) return fail(c, "forbidden_origin", "Origin is not allowed", 403);
      const action = z.enum(["text", "audio"]).parse(c.req.param("action"));
      const { proposalId, language } = z.object({ proposalId: z.string().uuid(), language: z.enum(["en", "hi"]) }).strict().parse(await c.req.json().catch(() => null));
      const service = container.spokenSummaryService;
      if (!service) return fail(c, "speech_unavailable", "Spoken summaries are unavailable", 503);
      try {
        if (action === "text") return ok(c, await service.describe(proposalId, c.get("user")!.id, language));
        const audio = await service.speak(proposalId, c.get("user")!.id, language, c.req.raw.signal);
        c.header("Content-Type", "audio/mpeg");
        c.header("X-Content-Type-Options", "nosniff");
        return c.body(new Uint8Array(audio).buffer);
      } catch (error) {
        if (!(error instanceof SpeechError)) throw error;
        if (error.code === "speech_rate_limited") c.header("Retry-After", "60");
        return fail(c, error.code, "Spoken summary unavailable; your itinerary is still available as text", error.code === "speech_rate_limited" ? 429 : 503);
      }
    },

    previewPlan: async (c) => {
      const origin = c.req.header("origin");
      if (!origin || !config.trustedOrigins.includes(origin)) {
        return fail(c, "forbidden_origin", "Origin is not allowed", 403);
      }
      const body = await c.req.json().catch(() => null);
      const request = planningRequestSchema.parse(body);
      if (c.req.header("accept")?.includes("application/x-ndjson")) {
        const abort = new AbortController();
        const signal = AbortSignal.any([abort.signal, c.req.raw.signal]);
        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            const send = (event: unknown) => {
              if (!signal.aborted) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
            };
            send({ type: "status", stage: "planning" });
            void container.planningService.preview(c.get("user")!.id, request, {
              signal, onReply: (text) => send({ type: "reply", text }),
            }).then(result => send({ type: "result", data: result }))
              .catch(error => send({ type: "error", code: error instanceof PlanningError ? error.code : "planning_unavailable" }))
              .finally(() => { if (!signal.aborted) controller.close(); });
          },
          cancel() { abort.abort(); },
        });
        return new Response(stream, {
          headers: {
            "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no",
          }
        });
      }
      try {
        return ok(c, await container.planningService.preview(c.get("user")!.id, request));
      } catch (error) {
        if (!(error instanceof PlanningError)) throw error;
        if (error.code === "planning_rate_limited") c.header("Retry-After", "60");
        return fail(c, error.code, "Trip preview could not be generated. Please retry.", error.code === "planning_rate_limited" ? 429 : error.code === "planning_invalid_output" ? 502 : 503);
      }
    },

    approvePlan: async (c) => {
      const origin = c.req.header("origin");
      if (!origin || !config.trustedOrigins.includes(origin)) return fail(c, "forbidden_origin", "Origin is not allowed", 403);
      if (!container.proposalApprovalService) return fail(c, "approval_unavailable", "Proposal saving is unavailable", 503);
      z.object({ confirm: z.literal(true) }).strict().parse(await c.req.json().catch(() => null));
      const id = z.string().uuid().parse(c.req.param("id"));
      const user = c.get("user")!;
      return ok(c, await container.proposalApprovalService.approve(id, { id: user.id, name: user.name, image: user.image }));
    }
  } satisfies Record<string, Controller>;
}

