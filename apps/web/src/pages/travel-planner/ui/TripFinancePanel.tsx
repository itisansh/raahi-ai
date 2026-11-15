import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Trip } from "@/entities/trip";
import { apiFetch, ApiError } from "@/shared/api";
import { queryKeys } from "@/shared/config";
import { formatMoney } from "@/shared/lib";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { financeCopy as copy, toMinor, type FinanceStatus } from "../model/finance";
export function TripFinancePanel({ trip, canEdit }: { trip: Trip; canEdit: boolean }) {
  const qc = useQueryClient(); const base = `/api/trips/${encodeURIComponent(trip.id)}/finance`;
  const query = useQuery({ queryKey: ["finance", trip.id, trip.version], queryFn: () => apiFetch<FinanceStatus>(base) });
  const [from, setFrom] = useState(""); const [to, setTo] = useState(""); const [amount, setAmount] = useState("");
  const [member, setMember] = useState(""); const [cap, setCap] = useState(""); const [voidId, setVoidId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(false);
  const requestId = useRef(crypto.randomUUID());
  // A failed request retains its identity and exact payload until its outcome is known.
  const pending = useRef<Record<string, unknown> | null>(null);
  const [retrying, setRetrying] = useState(false);
  const data = query.data; const scale = trip.currency === "INR" ? 100 : 1;
  const money = (minor: number) => formatMoney(minor / scale, trip.currency);
  const name = (id: string) => trip.members.find(m => m.id === id)?.name ?? id;
  const save = async (action: "repay" | "void" | "cap", fields: Record<string, unknown>) => {
    if (!data || busy) return;
    setBusy(true); setError(false);
    const body = action === "repay" && pending.current ? pending.current : { ...fields, revision: data.revision };
    if (action === "repay") pending.current = body;
    try {
      const result = await apiFetch<FinanceStatus>(`${base}/${action}`, { method: "POST", body: JSON.stringify(body), signal: AbortSignal.timeout(20_000) });
      qc.setQueryData(["finance", trip.id, trip.version], result);
      if (action === "repay") { pending.current = null; requestId.current = crypto.randomUUID(); setAmount(""); setRetrying(false); }
      setVoidId(null);
      await qc.invalidateQueries({ queryKey: queryKeys.trip(trip.id) });
      await qc.invalidateQueries({ queryKey: ["budget", trip.id] });
    } catch (cause) { setError(true); if (action === "repay") {
      const rejected = cause instanceof ApiError && cause.status >= 400 && cause.status < 500;
      if (rejected) { pending.current = null; requestId.current = crypto.randomUUID(); }
      setRetrying(!rejected);
    } }
    finally { setBusy(false); }
  };
  const choices = <><option value="">{copy.choose}</option>{trip.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</>;
  const selectClass = "min-h-11 w-full rounded-md border border-input bg-background px-3";
  return <section className="flex flex-col gap-4 rounded-lg border border-border p-4" aria-label={copy.title}>
    <details><summary className="min-h-11 cursor-pointer py-2 font-semibold">{copy.title}</summary><div className="flex flex-col gap-4 pt-3"><p className="text-sm text-muted-foreground">{copy.hint}</p>
    {(error || query.isError) && <p role="alert">{copy.failure}</p>}
    <Button variant="outline" disabled={busy} onClick={() => void query.refetch()}>{copy.refresh}</Button>
    {data && <>
      {canEdit && <fieldset disabled={busy} className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2"><label>{copy.from}<select aria-label={copy.from} className={selectClass} value={from} disabled={retrying} onChange={e => setFrom(e.target.value)}>{choices}</select></label><label>{copy.to}<select aria-label={copy.to} className={selectClass} value={to} disabled={retrying} onChange={e => setTo(e.target.value)}>{choices}</select></label></div>
        <label>{copy.amount}<Input inputMode="decimal" value={amount} disabled={retrying} onChange={e => setAmount(e.target.value)} /></label>
        <Button disabled={!retrying && (!from || !to || from === to || toMinor(amount, trip.currency) === null)} onClick={() => void save("repay", { from, to, amountMinor: toMinor(amount, trip.currency), currency: trip.currency, requestId: requestId.current, confirm: true })}>{busy ? copy.pending : retrying ? copy.retry : copy.record}</Button>
      </fieldset>}
      <h4 className="font-medium">{copy.repayments}</h4>
      {!data.repayments.length && <p className="text-sm text-muted-foreground">{copy.empty}</p>}
      <ul className="space-y-3">{data.repayments.map(row => <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 border-t pt-3"><span>{name(row.from)} → {name(row.to)} · {money(row.amountMinor)}{row.voidedAt && ` · ${copy.voided}`}</span>{canEdit && !row.voidedAt && <div className="flex gap-2">{voidId === row.id ? <><Button disabled={busy} onClick={() => void save("void", { repaymentId: row.id, confirm: true })}>{copy.confirmVoid}</Button><Button variant="ghost" onClick={() => setVoidId(null)}>{copy.cancel}</Button></> : <Button variant="outline" onClick={() => setVoidId(row.id)}>{copy.void}</Button>}</div>}</li>)}</ul>
      <h4 className="font-medium">{copy.cap}</h4><p className="text-sm text-muted-foreground">{copy.capHint}</p>
      <ul className="space-y-2">{data.caps.map(row => <li key={row.memberId}><strong>{name(row.memberId)}</strong><p className="text-sm">{copy.spent}: {money(row.spentMinor)} · {row.capMinor == null ? copy.none : `${copy.cap}: ${money(row.capMinor)} · ${copy.remaining}: ${money(row.remainingMinor!)}`}</p></li>)}</ul>
      {canEdit && <fieldset disabled={busy || retrying} className="flex flex-col gap-3"><label>{copy.capMember}<select aria-label={copy.capMember} className={selectClass} value={member} onChange={e => { setMember(e.target.value); const old = data.caps.find(c => c.memberId === e.target.value)?.capMinor; setCap(old == null ? "" : String(old / scale)); }}>{choices}</select></label><label>{copy.cap}<Input inputMode="decimal" value={cap} onChange={e => setCap(e.target.value)} /></label><div className="flex flex-wrap gap-2"><Button disabled={!member || toMinor(cap, trip.currency) == null} onClick={() => void save("cap", { memberId: member, capMinor: toMinor(cap, trip.currency) })}>{copy.saveCap}</Button><Button variant="outline" disabled={!member} onClick={() => void save("cap", { memberId: member, capMinor: null })}>{copy.clearCap}</Button></div></fieldset>}
    </>}
  </div></details></section>;
}
