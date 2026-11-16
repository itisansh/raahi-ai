import { Bot, CalendarDays, Map, MessageSquare, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface Feature {
  /** i18n key stem under `features.*`. */
  id: "map" | "schedule" | "budget" | "agent" | "collaborate";
  icon: LucideIcon;
}

/** Feature rows, in scroll order. The showcase alternates the image side. */
export const FEATURES: Feature[] = [
  { id: "map", icon: Map },
  { id: "schedule", icon: CalendarDays },
  { id: "budget", icon: Wallet },
  { id: "agent", icon: Bot },
  { id: "collaborate", icon: MessageSquare },
];
