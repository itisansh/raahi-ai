import { extractionPrompt, proposalPrompt } from "./planning-prompts";
import { generateObject, streamText, Output, NoObjectGeneratedError, APICallError } from "ai";
import type { AiConfig } from "../../config/env";
import { createAgentLanguageModel } from "./agent-model.ai-sdk";
import { candidateSchema, PlanningError, tripIntentSchema, type PlanningProgress, type PlanningContext, type PlanningModel, type TripIntent } from "../../services/planning/contracts";

// Require early user-facing guidance at the model boundary; historical stored plans remain valid.
const modelCandidateSchema = candidateSchema.required({ guidance: true });

export class AiSdkPlanningModel implements PlanningModel {
  constructor(private config: AiConfig) {}

  async extract(prompt: string, context: PlanningContext | null, progress?: PlanningProgress) {
    try {
      const result = await generateObject({
        model: createAgentLanguageModel(this.config, { allowFallback: true }), schema: tripIntentSchema,
        system: extractionPrompt,
        prompt: JSON.stringify({ request: prompt, persistedContext: context }),
        maxOutputTokens: 1024, maxRetries: 0, abortSignal: progress ? AbortSignal.any([progress.signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000),
      });
      return result.object;
    } catch (error) { throw new PlanningError(APICallError.isInstance(error) && error.statusCode === 429 ? "planning_primary_rate_limited" : NoObjectGeneratedError.isInstance(error) ? "planning_invalid_output" : "planning_unavailable"); }
  }

  async propose(intent: TripIntent, context: PlanningContext | null, progress?: PlanningProgress) {
    let streamFailure: unknown;
    try {
      if (progress) {
        const result = streamText({
          onError: ({ error }) => { streamFailure = error; },
          model: createAgentLanguageModel(this.config), output: Output.object({ schema: modelCandidateSchema }),
          system: proposalPrompt, prompt: JSON.stringify({ intent, persistedContext: context }),
          maxOutputTokens: 8192, maxRetries: 0,
          abortSignal: AbortSignal.any([progress.signal, AbortSignal.timeout(45_000)]),
        });
        let last = "";
        for await (const partial of result.partialOutputStream) {
          const text = partial.guidance?.response;
          if (typeof text === "string" && text !== last) { last = text; progress.onReply(text); }
        }
        return await result.output;
      }
      const result = await generateObject({
        model: createAgentLanguageModel(this.config), schema: modelCandidateSchema,
        system: proposalPrompt,
        prompt: JSON.stringify({ intent, persistedContext: context }),
        maxOutputTokens: 8192, maxRetries: 0, abortSignal: AbortSignal.timeout(45_000),
      });
      return result.object;
     } catch (error) {
      const failure = streamFailure ?? error;
      throw new PlanningError(APICallError.isInstance(failure) && failure.statusCode === 429 ? "planning_primary_rate_limited" : NoObjectGeneratedError.isInstance(failure) ? "planning_invalid_output" : "planning_unavailable");
    }
  }
}
