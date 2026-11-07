import { medicalCopy as copy, emergencyContacts } from "../model/copy";
export function EmergencyContactLinks() {
  return <div className="flex flex-col gap-2 text-sm">
    {emergencyContacts.map(contact => <div key={contact.phone} className="flex flex-wrap gap-3"><a className="font-semibold underline" href={`tel:${contact.phone}`}>{contact.label}</a><a className="underline" href={contact.url} target="_blank" rel="noreferrer">{copy.source}</a></div>)}
    <p className="text-xs text-muted-foreground">{copy.region}</p><p className="text-xs text-muted-foreground">{copy.reviewed}</p>
  </div>;
}
export function EmergencyContacts() {
  return <details className="fixed bottom-4 left-4 z-40 max-w-[min(24rem,calc(100vw-2rem))] rounded-lg border border-border bg-background p-3 shadow-sm">
    <summary className="cursor-pointer text-sm font-medium">{copy.contacts}</summary>
    <div className="pt-3"><EmergencyContactLinks /></div>
  </details>;
}
