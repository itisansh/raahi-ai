import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "./Reveal";
import { IndiaTripPreview } from "./IndiaTripPreview";

export function CallToAction({ onGetStarted }: { onGetStarted: () => void }) {
  const { t } = useTranslation("landing");

  return (
    <section className="relative isolate overflow-hidden bg-primary px-5 pt-20 text-primary-foreground sm:pt-24 dark:bg-card dark:text-foreground">

      <div className="mx-auto grid max-w-6xl items-end gap-10 md:grid-cols-[1fr_auto]">
        <div className="pb-10 text-center md:pb-28 md:text-left">
          <Reveal>
            <h2 className="max-w-xl text-4xl font-semibold tracking-[-0.02em] text-balance sm:text-5xl">
              {t("cta.title")}
            </h2>
          </Reveal>
          <Reveal className="mt-5" delay={60}>
            <p className="max-w-md text-base text-pretty opacity-70">{t("cta.subtitle")}</p>
          </Reveal>
          <Reveal className="mt-9 flex justify-center md:justify-start" delay={120}>
            <Button variant="brand" size="lg" onClick={onGetStarted} className="group">
              {t("cta.button")}
              <ArrowRight
                className="size-4 transition-transform duration-fast ease-out motion-safe:group-hover:translate-x-0.5"
                aria-hidden
              />
            </Button>
          </Reveal>
        </div>

        <Reveal className="-mb-24 flex justify-center md:-mb-20" delay={180}>
          <div className="w-72 pb-28 text-foreground"><IndiaTripPreview variant="schedule" compact /></div>
        </Reveal>
      </div>
    </section>
  );
}
