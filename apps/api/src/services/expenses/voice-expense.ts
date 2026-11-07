import { z } from "zod";
export const expenseExtractionSchema = z.object({
  description: z.string().max(200).nullable(),
  amountRupees: z.string().regex(/^\d{1,7}(\.\d{1,2})?$/).nullable(),
  currency: z.enum(["INR", "other"]).nullable(),
  payerName: z.string().max(100).nullable(),
  payerIsSelf: z.boolean(),
  participantNames: z.array(z.string().max(100)).max(100),
  participantCount: z.number().int().min(1).max(100).nullable(),
});
export interface ExpenseExtractionModel { extract(prompt: string): Promise<unknown>; }
export class ExpenseVoiceError extends Error {
  constructor(public code: "expense_voice_unavailable" | "expense_voice_invalid" | "expense_voice_rate_limited") { super(code); }
}
/** Extraction is a draft only; member choice and saving remain explicit. */
export class VoiceExpenseService {
  constructor(private model: ExpenseExtractionModel | null, private authorize: (tripId: string, userId: string) => Promise<void>, private limiter: { consume(userId: string): Promise<boolean> }) {}
  async preview(tripId: string, userId: string, prompt: string) {
    await this.authorize(tripId, userId);
    if (!this.model) throw new ExpenseVoiceError("expense_voice_unavailable");
    try {
      if (!await this.limiter.consume(userId)) throw new ExpenseVoiceError("expense_voice_rate_limited");
    } catch (error) {
      if (error instanceof ExpenseVoiceError) throw error;
      throw new ExpenseVoiceError("expense_voice_unavailable");
    }
    const result = expenseExtractionSchema.safeParse(await this.model.extract(prompt));
    if (!result.success) throw new ExpenseVoiceError("expense_voice_invalid");
    return { ...result.data, saved: false as const };
  }
}
