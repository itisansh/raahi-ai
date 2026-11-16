import { useTranslation } from "react-i18next";
import type { Trip } from "@/lib/models/trip";
import type { AgentSuggestion } from "@/lib/api";
import { PanelToggleIcon } from "@/components/layout/app-sidebar";
import { cn } from "@/lib";
import { AgentChat } from "./AgentChat";

/** Right base-layer panel, mirroring the left `AppSidebar`: it sits beneath the
 * main panel (same `bg-sidebar` layer) and reveals via a width transition. When
 * open, the main panel rounds its right corners against it. */
export function AgentDrawer({
  open,
  tripId,
  trip,
  canEdit,
  applyingId,
  onApproveSuggestion,
  onDenySuggestion,
  onFocusDay,
  onFocusStop,
  onClose,
}: {
  open: boolean;
  tripId: string;
  trip: Trip;
  canEdit: boolean;
  applyingId: string | null;
  onApproveSuggestion: (suggestion: AgentSuggestion) => void;
  onDenySuggestion: (suggestion: AgentSuggestion) => void;
  onFocusDay: (dayNumber: number) => void;
  onFocusStop: (stopId: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("agent");
  return (
    <aside
      aria-hidden={!open}
      inert={!open}
      className={cn(
        "absolute right-0 top-0 z-30 xl:relative flex h-dvh flex-none flex-col overflow-hidden bg-card shadow-lg transition-[width] duration-[var(--dur-slow)] ease-[var(--ease-out)]",
        open ? "w-[min(360px,85vw)]" : "w-0",
      )}
    >
      <div
        className={cn(
          "flex h-full w-[min(360px,85vw)] flex-col transition-opacity duration-[var(--dur-slow)] ease-[var(--ease-out)]",
          !open && "pointer-events-none opacity-0",
        )}
      >
        <div className="flex flex-none items-center justify-between gap-2 border-b border-border bg-brand-muted px-4 py-3">
          <div><h2 className="font-semibold">{t("panel.title")}</h2><p className="text-xs text-muted-foreground">{t("panel.description")}</p></div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("toggle.close")}
            title={t("toggle.close")}
            className="wf-interactive wf-pressable -ml-1 flex size-10 flex-none items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <PanelToggleIcon className="size-4" />
          </button>
        </div>
        <AgentChat
          enabled={open}
          tripId={tripId}
          trip={trip}
          canEdit={canEdit}
          applyingId={applyingId}
          onApproveSuggestion={onApproveSuggestion}
          onDenySuggestion={onDenySuggestion}
          onFocusDay={onFocusDay}
          onFocusStop={onFocusStop}
        />
      </div>
    </aside>
  );
}
