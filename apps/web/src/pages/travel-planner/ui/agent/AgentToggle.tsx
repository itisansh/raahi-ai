import { useTranslation } from "react-i18next";
import { MessageCircle } from "lucide-react";

/** Labelled assistant entry in the planner toolbar. */
export function AgentToggle({
  onOpen,
}: {
  onOpen: () => void;
}) {
  const { t } = useTranslation("agent");
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t("toggle.open")}
      title={t("toggle.open")}
      className="wf-enter wf-interactive wf-pressable flex min-h-10 gap-2 px-4 items-center justify-center rounded-lg border border-border bg-brand text-brand-foreground shadow-sm backdrop-blur-md hover:bg-accent hover:text-foreground"
    >
      <MessageCircle className="size-5" aria-hidden />
      <span className="text-sm font-semibold">{t("panel.title")}</span>
    </button>
  );
}
