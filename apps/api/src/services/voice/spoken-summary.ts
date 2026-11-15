import { z } from "zod";
import { DomainError, NotFoundError } from "../../domain/shared/errors";
import type { StoredProposal } from "../planning/proposal-store";
import type { VoiceTokenLimiter } from "./voice-token-service";

export type SpeechLanguage = "en" | "hi";
export interface SpeechProvider {
  synthesize(text: string, language: SpeechLanguage, signal?: AbortSignal): Promise<Uint8Array>;
}
export class SpeechError extends Error {
  constructor(public code: "speech_unavailable" | "speech_rate_limited") { super(code); }
}
const snapshot = z.object({
  status: z.literal("preview"),
  intent: z.object({ origin: z.string().max(200), partySize: z.number().int().positive(), dayCount: z.number().int().positive() }),
  days: z.array(z.object({ city: z.string().max(200) })).min(1).max(14),
  budget: z.object({ groupBudgetPaise: z.number().int().nonnegative() }),
  issues: z.array(z.string()).max(20),
});
const warnings: Record<string, [string, string]> = {
  dates_unknown: ["Dates and seasonal conditions are unconfirmed.", "तारीखें और मौसमी स्थितियाँ तय नहीं हैं।"],
  costs_incomplete: ["Some costs are unknown.", "कुछ खर्चों की जानकारी उपलब्ध नहीं है।"],
  over_budget: ["The upper estimate exceeds your budget.", "अधिकतम अनुमान आपके बजट से अधिक है।"],
  places_unverified: ["Some places could not be verified.", "कुछ स्थानों की पुष्टि नहीं हो सकी।"],
  routes_unverified: ["Some travel times are unavailable.", "कुछ यात्रा समय उपलब्ध नहीं हैं।"],
  schedule_infeasible: ["The schedule needs revision.", "यात्रा कार्यक्रम में बदलाव की आवश्यकता है।"],
  return_travel_unverified: ["Return travel has not been verified.", "वापसी की यात्रा की पुष्टि नहीं हुई है।"],
};

/** Read owner-scoped replies; older proposal snapshots retain their original summary contract. */
export class SpokenSummaryService {
  constructor(
    private read: (id: string, ownerId: string) => Promise<StoredProposal | null>,
    private provider: SpeechProvider | null,
    private limiter: VoiceTokenLimiter,
  ) {}
  async describe(id: string, ownerId: string, language: SpeechLanguage) {
    const stored = await this.read(id, ownerId);
    if (!stored || stored.ownerId !== ownerId) throw new NotFoundError("proposal_not_found", "Proposal not found");
    if (stored.expiresAt.getTime() <= Date.now()) throw new DomainError("proposal_expired", "Generate a fresh proposal");
    const reply = z.object({
      status: z.enum(["clarification", "preview"]),
      reply: z.object({ text: z.string().min(1).max(2500), language: z.enum(["en", "hi"]) }),
    }).safeParse(stored.payload);
    if (reply.success) return reply.data.reply;
    const p = snapshot.parse(stored.payload);
    const cities = [...new Set(p.days.map(day => day.city))];
    const route = cities.slice(0, 3).join(", ");
    const budget = (p.budget.groupBudgetPaise / 100).toLocaleString(language === "hi" ? "hi-IN" : "en-IN", { maximumFractionDigits: 2 });
    const text = language === "hi"
      ? `यह प्रस्तावित यात्रा है। ${p.intent.origin} से ${p.intent.partySize} यात्रियों के लिए ${p.intent.dayCount} दिन। मुख्य स्थान: ${route}। समूह का बजट ${budget} रुपये है। खर्च अनुमानित हैं। किराए, समय सारिणी और बुकिंग की पुष्टि नहीं है। मौसमी सलाह सामान्य जानकारी है; निकलने से पहले आधिकारिक स्थितियाँ जाँचें।`
      : `This is a proposed trip from ${p.intent.origin} for ${p.intent.partySize} travellers over ${p.intent.dayCount} days. Main destinations: ${route}. Your group budget is ${budget} rupees. Costs are estimates. Fares, timetables and bookings are unconfirmed. Seasonal suitability is general guidance; check official conditions before departure.`;
    const caveats = p.issues.map(issue => warnings[issue]?.[language === "hi" ? 1 : 0] ?? (language === "hi" ? "यात्रा विवरण की समीक्षा आवश्यक है।" : "Additional itinerary details need review."));
    return { text: [text, ...caveats].join(" "), language };
  }
  async speak(id: string, ownerId: string, language: SpeechLanguage, signal?: AbortSignal) {
    const summary = await this.describe(id, ownerId, language);
    if (!this.provider) throw new SpeechError("speech_unavailable");
    try {
      if (!await this.limiter.consume(ownerId)) throw new SpeechError("speech_rate_limited");
    } catch (error) {
      if (error instanceof SpeechError) throw error;
      throw new SpeechError("speech_unavailable");
    }
    return this.provider.synthesize(summary.text, summary.language, signal);
  }
}
