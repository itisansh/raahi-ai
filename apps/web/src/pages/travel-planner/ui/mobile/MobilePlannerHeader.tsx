import { BackButton } from "../BackButton";

/** Compact top bar for the narrow-screen planner shell. */
export function MobilePlannerHeader({
  title,
  subtitle,
  onBack,
  onRename,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  onRename?: (title: string) => void;
  /** Retained for API compatibility; agent is now a floating FAB. */
  onOpenAgent?: () => void;
}) {
  return (
    <header className="flex flex-none items-center gap-2 border-b border-border bg-background px-2 pt-[max(0.375rem,env(safe-area-inset-top))] pb-1.5">
      <div className="min-w-0 flex-1">
        <BackButton
          onBack={onBack}
          title={title}
          subtitle={subtitle}
          onRename={onRename}
        />
      </div>
    </header>
  );
}
