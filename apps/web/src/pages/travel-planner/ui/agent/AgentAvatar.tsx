import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib";
import "@/shared/ui/ai-aura.css";

export function AgentAvatar({ className }: { className?: string }) {
  const { t } = useTranslation("agent");
  return <span role="img" aria-label={t("panel.agentName")} className={cn("raahi-ai-orb size-6 shrink-0", className)} />;
}
