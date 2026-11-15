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
      className="wf-enter wf-interactive wf-pressable flex min-h-10 cursor-pointer gap-2 px-4 items-center justify-center rounded-lg border border-brand/40 bg-brand text-brand-foreground shadow-[0_0_12px_2px_color-mix(in_srgb,var(--brand)_35%,transparent)] transition-shadow duration-300 hover:shadow-[0_0_20px_4px_color-mix(in_srgb,var(--brand)_55%,transparent)] hover:border-brand"
    >
      <MessageCircle className="size-5" aria-hidden />
      <span className="text-sm font-semibold">{t("panel.title")}</span>
    </button>
  );
}
