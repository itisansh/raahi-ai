import { extractionPrompt, proposalPrompt } from "./planning-prompts";
import { generateObject, NoObjectGeneratedError } from "ai";
import type { AiConfig } from "../../config/env";
import { createAgentLanguageModel } from "./agent-model.ai-sdk";
import { candidateSchema, PlanningError, tripIntentSchema, type PlanningContext, type PlanningModel, type TripIntent } from "../../services/planning/contracts";

export class AiSdkPlanningModel implements PlanningModel {
  constructor(private config: AiConfig) {}

  async extract(prompt: string, context: PlanningContext | null) {
    try {
      const result = await generateObject({
        model: createAgentLanguageModel(this.config), schema: tripIntentSchema,
        system: extractionPrompt,
        prompt: JSON.stringify({ request: prompt, persistedContext: context }),
        maxOutputTokens: 1024, maxRetries: 0, abortSignal: AbortSignal.timeout(30_000),
      });
      return result.object;
    } catch (error) { throw new PlanningError(NoObjectGeneratedError.isInstance(error) ? "planning_invalid_output" : "planning_unavailable"); }
  }

  async propose(intent: TripIntent, context: PlanningContext | null) {
    try {
      const result = await generateObject({
        model: createAgentLanguageModel(this.config), schema: candidateSchema,
        system: proposalPrompt,
        prompt: JSON.stringify({ intent, persistedContext: context }),
        maxOutputTokens: 8192, maxRetries: 0, abortSignal: AbortSignal.timeout(45_000),
      });
      return result.object;
    } catch (error) { throw new PlanningError(NoObjectGeneratedError.isInstance(error) ? "planning_invalid_output" : "planning_unavailable"); }
  }
}
