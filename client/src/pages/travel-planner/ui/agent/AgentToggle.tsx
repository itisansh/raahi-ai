import { useTranslation } from "react-i18next";
import { AgentAvatar } from "./AgentAvatar";

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
      className="raahi-ai-action wf-pressable flex min-h-11 items-center justify-center gap-2 rounded-full px-4"
    >
      <AgentAvatar className="size-6" />
      <span className="text-sm font-semibold">{t("panel.title")}</span>
    </button>
  );
}
