import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { offlineCopy as copy, offlineItineraryHtml } from "./export";
export function OfflineItinerary({ trip }: { trip: Parameters<typeof offlineItineraryHtml>[0] }) {
  const [failed, setFailed] = useState(false);
  const download = () => {
    let url: string | null = null;
    try {
      const html = offlineItineraryHtml(trip);
      url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
      const link = document.createElement("a"); link.href = url; link.download = `raahi-itinerary-${trip.id.replace(/[^a-z0-9_-]/gi, "").slice(0, 80)}.html`; link.click(); setFailed(false);
      const temporaryUrl = url; setTimeout(() => URL.revokeObjectURL(temporaryUrl), 1000);
    } catch { if (url) URL.revokeObjectURL(url); setFailed(true); }
  };
  return <div className="flex flex-col gap-2 p-4"><Button type="button" variant="outline" onClick={download}>{copy.save}</Button><p className="text-xs text-muted-foreground">{copy.snapshot}</p>{failed && <p role="alert">{copy.failed}</p>}</div>;
}
