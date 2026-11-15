import { Button } from "@/shared/ui/button";
import { Dialog, DialogTrigger, DialogPortal, DialogBackdrop, DialogSheetViewport, DialogSheetPopup, DialogClose, DialogFooter, DialogTitle, DialogDescription, DialogHeader, DialogPanel } from "@/shared/ui/dialog";
import { medicalCopy as copy, emergencyContacts } from "../model/copy";
export function EmergencyContactLinks() {
  return <div className="flex flex-col gap-2 text-sm">
    {emergencyContacts.map(contact => <div key={contact.phone} className="flex flex-wrap gap-3"><a className="font-semibold underline" href={`tel:${contact.phone}`}>{contact.label}</a><a className="underline" href={contact.url} target="_blank" rel="noreferrer">{copy.source}</a></div>)}
    <p className="text-xs text-muted-foreground">{copy.region}</p><p className="text-xs text-muted-foreground">{copy.reviewed}</p>
  </div>;
}
export function EmergencyContacts() {
  return <Dialog>
    <DialogTrigger render={<Button variant="outline" className="min-h-10" />}>{copy.emergency}</DialogTrigger>
    <DialogPortal><DialogBackdrop className="fixed inset-0 z-50 bg-black/40" /><DialogSheetViewport><DialogSheetPopup><DialogHeader><DialogTitle>{copy.contacts}</DialogTitle><DialogDescription>{copy.region}</DialogDescription></DialogHeader>
      <DialogPanel><EmergencyContactLinks /></DialogPanel>
      <DialogFooter><DialogClose render={<Button variant="outline" />}>{copy.close}</DialogClose></DialogFooter>
    </DialogSheetPopup></DialogSheetViewport></DialogPortal>
  </Dialog>;
}
