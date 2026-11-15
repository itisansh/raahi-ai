import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Trip } from "@/entities/trip";
import { apiFetch } from "@/shared/api";
import { queryKeys } from "@/shared/config";
import { Button } from "@/shared/ui/button";
const copy = { title: "Plan history", empty: "No approved changes yet.", budget: "Budget replan", planning: "Added stops", review: "Review rollback", before: "Restore this itinerary", after: "Current approved itinerary", confirm: "Confirm rollback", cancel: "Keep current plan", done: "Rolled back", stale: "Later changes prevent rollback. Generate a new proposal to revise the current plan.", hint: "Rollback restores the itinerary from before this approval. Expenses and bookings stay in place.", error: "Could not roll back. Refresh the trip and review its latest changes.", refresh: "Refresh history" };
interface Entry { id: string; kind: string; approvedAt: string; rolledBackAt: string | null; canRollback: boolean; beforeStops: Array<{ name: string; day: number }>; afterStops: Array<{ name: string; day: number }> }
export function ProposalHistory({ trip }: { trip: Trip }) {
  const qc = useQueryClient(); const base = `/api/trips/${encodeURIComponent(trip.id)}/history`;
  const query = useQuery({ queryKey: ["history", trip.id, trip.version], queryFn: () => apiFetch<Entry[]>(base) });
  const [review, setReview] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState(false);
  const rollback = async (proposalId: string) => {
    setBusy(true); setError(false);
    try {
      await apiFetch(base + "/rollback", { method: "POST", body: JSON.stringify({ proposalId, revision: trip.version, confirm: true }), signal: AbortSignal.timeout(20_000) });
      setReview(null); await query.refetch(); await qc.invalidateQueries({ queryKey: queryKeys.trip(trip.id) }); await qc.invalidateQueries({ queryKey: ["budget", trip.id] });
    } catch { setError(true); } finally { setBusy(false); }
  };
  return <section className="space-y-3 rounded-lg border border-border p-4" aria-label={copy.title}><details><summary className="min-h-11 cursor-pointer py-2 font-semibold">{copy.title}</summary><div className="space-y-3 pt-3">
    {(query.isError || error) && <p role="alert">{copy.error}</p>}
    <Button variant="outline" disabled={busy} onClick={() => void query.refetch()}>{copy.refresh}</Button>
    {query.data?.length === 0 && <p>{copy.empty}</p>}
    {query.data?.map(row => <div key={row.id} className="space-y-2 border-t pt-3"><p>{row.kind === "budget_replan" ? copy.budget : copy.planning} · {new Date(row.approvedAt).toLocaleString()}</p>
      {row.rolledBackAt ? <p>{copy.done}</p> : row.canRollback ? <Button variant="outline" disabled={busy} onClick={() => setReview(row.id)}>{copy.review}</Button> : <p className="text-sm text-muted-foreground">{copy.stale}</p>}
      {review === row.id && row.canRollback && <div className="space-y-3"><p>{copy.hint}</p><h4>{copy.after}</h4><ul>{row.afterStops.map((s, i) => <li key={i}>{s.day} · {s.name}</li>)}</ul><h4>{copy.before}</h4><ul>{row.beforeStops.map((s, i) => <li key={i}>{s.day} · {s.name}</li>)}</ul><div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => void rollback(row.id)}>{copy.confirm}</Button><Button variant="ghost" disabled={busy} onClick={() => setReview(null)}>{copy.cancel}</Button></div></div>}
    </div>)}
  </div></details></section>;
}
