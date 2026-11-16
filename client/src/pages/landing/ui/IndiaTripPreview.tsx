import { useTranslation } from "react-i18next";
import type { Feature } from "../lib/content";

/** Illustrative content, deliberately separate from live trip state. */
export function IndiaTripPreview({ variant, compact = false }: { variant: Feature["id"]; compact?: boolean }) {
  const { t } = useTranslation("landing");
  const routeIndex = ({ map: 0, schedule: 1, budget: 2, agent: 3, collaborate: 4 } as const)[variant];
  const routes = t("preview.routes", { returnObjects: true });
  const route = routes[routeIndex]!;
  return (
    <div className="overflow-hidden rounded-xl border bg-background text-foreground shadow-sm">
      <div className="border-b px-5 py-3 text-xs text-muted-foreground">{t("preview.label")}</div>
      <div className={compact ? "p-4" : "p-6 sm:p-8"}>
        <p className="text-sm text-muted-foreground">{t("preview.people")}</p>
        <h3 className="mt-2 text-2xl font-semibold tracking-tight">{route.title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{route.route}</p>
        {variant === "budget" ? (
          <div className="mt-8 border-t pt-5">
            <p className="text-sm text-muted-foreground">{t("preview.budget")}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{t("preview.cost")}</p>
            <p className="mt-4 text-sm text-muted-foreground">{t("preview.budgetNote")}</p>
          </div>
        ) : variant === "agent" ? (
          <div className="mt-8 space-y-4 border-t pt-5 text-sm">
            <p>{t("preview.question")}</p><p className="text-muted-foreground">{t("preview.answer")}</p>
          </div>
        ) : (
          <ol className="mt-6 divide-y">
            {([0, 1, 2] as const).map(index => <li key={index} className="flex gap-4 py-4 text-sm">
              <span className="text-muted-foreground">{t("preview.day")} {index + 1}</span>
              <span>{route.stops[index]}</span>
            </li>)}
          </ol>
        )}
        {variant === "collaborate" && <p className="mt-4 text-sm text-muted-foreground">{t("preview.vote")}</p>}
      </div>
    </div>
  );
}
