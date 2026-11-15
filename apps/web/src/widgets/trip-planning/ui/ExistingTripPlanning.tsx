import { useState } from "react";
import { MicIcon, XIcon } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogPortal, DialogBackdrop, DialogSheetViewport, DialogSheetPopup, DialogHeader, DialogTitle, DialogDescription, DialogPanel } from "@/shared/ui/dialog";
import { TripProposalPanel } from "./TripProposalPanel";
import { proposalCopy as copy } from "../model/proposal-copy";

export function ExistingTripPlanning({ tripId }: { tripId: string }) {
  const [open, setOpen] = useState(false);
  return <>
    <Button variant="outline" size="lg" className="min-h-11" onClick={() => setOpen(true)}><MicIcon className="size-4" aria-hidden />{copy.openExisting}</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogPortal><DialogBackdrop className="fixed inset-0 z-50 bg-black/40" />
        <DialogSheetViewport><DialogSheetPopup size="lg" className="h-full max-h-full rounded-none md:h-[85%] md:max-h-[760px] md:rounded-2xl">
          <DialogHeader className="flex-row items-start justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] md:px-6">
            <div><DialogTitle>{copy.openExisting}</DialogTitle><DialogDescription>{copy.description}</DialogDescription></div>
            <Button variant="ghost" size="icon" aria-label={copy.close} onClick={() => setOpen(false)}><XIcon className="size-5" aria-hidden /></Button>
          </DialogHeader>
          <DialogPanel className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
            {open && <TripProposalPanel tripId={tripId} onSaved={() => setOpen(false)} />}
          </DialogPanel>
        </DialogSheetPopup></DialogSheetViewport>
      </DialogPortal>
    </Dialog>
  </>;
}
