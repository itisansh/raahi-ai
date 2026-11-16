import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Trip } from "@/lib/models/trip";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { budgetCopy as copy, inputPaise, showPaise, type BudgetStatus, type BudgetProposal } from "../model/budget-replan";
export function BudgetReplanPanel({ trip, canEdit }: { trip: Trip; canEdit: boolean }) {
  const qc = useQueryClient(); const base = `/api/trips/${encodeURIComponent(trip.id)}/budget`;
  const query = useQuery({ queryKey: ["budget", trip.id, trip.version], queryFn: () => apiFetch<BudgetStatus>(base) });
  const [other, setOther] = useState("0");
  const [budget, setBudget] = useState(""); const [buffer, setBuffer] = useState("0"); const [costs, setCosts] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(false); const [proposal, setProposal] = useState<BudgetProposal | null>(null);
  const status = query.data;
  useEffect(() => {
    if (status && !dirty) {
      setBudget(status.forecast ? String(status.forecast.groupBudgetPaise / 100) : "");
      setOther(String((status.forecast?.otherFuturePaise ?? 0) / 100));
      setBuffer(String(status.bufferPaise / 100));
      setCosts(Object.fromEntries(status.future.map(s => [s.id, s.estimatePaise == null ? "" : String(s.estimatePaise / 100)])));
    }
  }, [status, dirty]);
  const act = async (action: "forecast" | "propose" | "approve") => {
    setBusy(true); setError(false);
    try {
      const body = action === "forecast" ? { otherFuturePaise: inputPaise(other), groupBudgetPaise: inputPaise(budget), bufferPaise: inputPaise(buffer), costs: Object.fromEntries((status?.future ?? []).map(s => [s.id, inputPaise(costs[s.id] ?? "")])) } : action === "approve" ? { proposalId: proposal!.proposalId, confirm: true } : {};
      const result = await apiFetch<BudgetProposal>(`${base}/${action}`, { method: "POST", body: JSON.stringify(body), signal: AbortSignal.timeout(40_000) });
      if (action === "propose") setProposal(result);
      else { setProposal(null); setDirty(false); await query.refetch(); await qc.invalidateQueries({ queryKey: queryKeys.trip(trip.id) }); }
    } catch { setError(true); } finally { setBusy(false); }
  };
  if (trip.currency !== "INR") return null;
  return <section className="flex flex-col gap-3 rounded-lg border border-border p-4" aria-label={copy.title}>
    <h3 className="font-semibold">{copy.title}</h3>
    {query.isPending && <p role="status">{copy.loading}</p>}
    {(query.isError || error) && <p role="alert">{copy.failure}</p>}
    {status && <>
      <dl className="grid grid-cols-2 gap-2 text-sm">{[[copy.spent, status.spentPaise], [copy.committed, status.committedPaise], [copy.future, status.estimatedPaise], [copy.projected, status.projectedPaise], [copy.remaining, status.remainingPaise], [copy.perPerson, status.remainingPerPersonPaise]].map(([label, amount]) => <div key={String(label)}><dt>{label}</dt><dd>{showPaise(amount as number | null)}</dd></div>)}</dl>
      {!!status.issues.length && <p role="status">{copy.warning}</p>}
      {canEdit ? <fieldset disabled={busy} className="flex flex-col gap-2">
        <legend>{copy.forecast}</legend><p className="text-xs text-muted-foreground">{copy.estimates}</p>
        <label>{copy.budget}<Input value={budget} inputMode="decimal" onChange={e => { setDirty(true); setBudget(e.target.value); }} /></label>
        <label>{copy.other}<Input value={other} inputMode="decimal" onChange={e => { setDirty(true); setOther(e.target.value); }} /></label>
        <label>{copy.buffer}<Input value={buffer} inputMode="decimal" onChange={e => { setDirty(true); setBuffer(e.target.value); }} /></label>
        {status.future.map(s => <label key={s.id}>{s.name}<Input value={costs[s.id] ?? ""} inputMode="decimal" onChange={e => { setDirty(true); setCosts(v => ({ ...v, [s.id]: e.target.value })); }} /></label>)}
        <Button type="button" variant="outline" onClick={() => void act("forecast")}>{busy ? copy.busy : copy.save}</Button>
        <Button type="button" disabled={dirty || !!status.issues.length || status.remainingPaise == null || status.remainingPaise >= 0} onClick={() => void act("propose")}>{copy.propose}</Button>
      </fieldset> : <p>{copy.readonly}</p>}
      {proposal && <div className="flex flex-col gap-2"><h4>{copy.comparison}</h4><p>{proposal.reason}</p><ul>{proposal.removedStops.map(s => <li key={s.id}>{s.name}</li>)}</ul><p>{copy.projected}: {showPaise(proposal.before.projectedPaise)}</p><p>{copy.savings}: {showPaise(proposal.savingsPaise)}</p><p>{copy.after}: {showPaise(proposal.afterProjectedPaise)}</p><p className="text-xs">{copy.stale}</p><Button type="button" disabled={busy || dirty} onClick={() => void act("approve")}>{copy.approve}</Button><Button type="button" variant="outline" disabled={busy} onClick={() => setProposal(null)}>{copy.reject}</Button></div>}
    </>}
  </section>;
}
