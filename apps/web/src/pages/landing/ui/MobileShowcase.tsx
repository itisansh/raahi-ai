import { useTranslation } from "react-i18next";
import { IndiaTripPreview } from "./IndiaTripPreview";
import { Reveal } from "./Reveal";

export function MobileShowcase() {
  const { t } = useTranslation("landing");
  return (
    <section className="mx-auto max-w-6xl px-5">
      <Reveal className="grid items-center gap-12 md:grid-cols-2">
        <div className="max-w-md">
          <h2 className="text-2xl font-semibold tracking-[-0.01em] text-balance sm:text-3xl">
            {t("mobile.title")}
          </h2>
          <p className="mt-3 text-base text-pretty text-muted-foreground">
            {t("mobile.body")}
          </p>
        </div>

        <div className="mx-auto w-full max-w-sm rounded-[2rem] border-4 border-foreground/15 bg-background p-3">
          <IndiaTripPreview variant="schedule" compact />
        </div>
      </Reveal>
    </section>
  );
}
