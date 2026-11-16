import type { Candidate, TripIntent, requiredIntentFields } from "./contracts";

type Missing = (typeof requiredIntentFields)[number];
const questions: Record<Missing, [string, string]> = {
  origin: ["Where are you travelling from?", "आप कहाँ से यात्रा शुरू करेंगे?"],
  partySize: ["How many people are travelling?", "कितने लोग यात्रा करेंगे?"],
  dayCount: ["How many days do you have? I can plan up to 14 days.", "कितने दिन की यात्रा है? मैं 14 दिन तक की योजना बना सकता हूँ।"],
  budgetRupees: ["What is your budget in rupees?", "आपका बजट कितने रुपये है?"],
  budgetBasis: ["Is that budget per person or for the whole group?", "यह बजट प्रति व्यक्ति है या पूरे समूह के लिए?"],
  currency: ["Please give your budget in Indian rupees.", "कृपया बजट भारतीय रुपये में बताएं।"],
};
export function clarificationReply(intent: TripIntent, missing: readonly Missing[], existing = false) {
  const language = intent.language === "en" ? "en" as const : "hi" as const;
  const known = existing ? [
    intent.dayCount ? (language === "en" ? `I have your ${intent.dayCount}-day itinerary${intent.startDate ? ` starting ${intent.startDate}` : ""}.` : `आपकी ${intent.dayCount} दिन की यात्रा${intent.startDate ? ` (${intent.startDate})` : ""} मेरे पास है।`) : "",
    intent.budgetRupees ? (language === "en" ? `Your saved budget is ₹${intent.budgetRupees}${intent.budgetBasis === "per_person" ? " per person" : intent.budgetBasis === "group" ? " for the group" : ""}.` : `आपका बजट ₹${intent.budgetRupees} है।`) : "",
  ].filter(Boolean).join(" ") : "";
  return { language, text: [known, ...missing.map(key => questions[key][language === "en" ? 0 : 1])].filter(Boolean).join(" ") };
}

/** The visible reply and spoken reply share this stored, bounded text. */
export function previewReply(intent: TripIntent, candidate: Candidate, issues: string[]) {
  const language = intent.language === "en" ? "en" as const : "hi" as const;
  const response = candidate.guidance?.response ?? candidate.title;
  const caveat = language === "en"
    ? "This is a proposed itinerary. Costs are estimates; availability and current travel conditions are unconfirmed. Review the details before saving."
    : "यह प्रस्तावित यात्रा है। खर्च अनुमानित हैं; उपलब्धता और मौजूदा यात्रा स्थितियों की पुष्टि नहीं है। सहेजने से पहले विवरण जाँचें।";
  const warning = issues.some(issue => issue !== "dates_unknown")
    ? language === "en" ? "Some budget, place or route checks still need attention before this plan can be saved." : "सहेजने से पहले कुछ बजट, स्थान या मार्ग की जाँच पूरी करनी होगी।"
    : "";
  // Keep speech within the provider's existing 2,500-character bound without
  // cutting model sentences or dropping deterministic caveats.
  const questionsText = candidate.guidance?.questions.join(" ") ?? "";
  const core = [response, caveat, warning].filter(Boolean).join("\n\n");
  return { language, text: core.length + questionsText.length + 2 <= 2500 ? [core, questionsText].filter(Boolean).join("\n\n") : core };
}
