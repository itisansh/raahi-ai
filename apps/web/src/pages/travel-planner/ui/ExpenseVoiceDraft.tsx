import { useEffect, useRef, useState } from "react";
import { VoiceInput } from "@/features/voice-input";
import { apiFetch } from "@/shared/api";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";
import { expenseVoiceCopy as copy } from "../model/expense-voice";
import type { ExpenseVoiceDraft } from "../model/expense-voice";

export function ExpenseVoiceDraftInput({ tripId, onDraft }: { tripId: string; onDraft: (draft: ExpenseVoiceDraft) => void }) {
  const [prompt, setPrompt] = useState(""); const [busy, setBusy] = useState(false); const [failed, setFailed] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => { active.current?.abort(); active.current = null; }, []);
  const interpret = async () => {
    const controller = new AbortController(); active.current?.abort(); active.current = controller;
    setBusy(true); setFailed(false);
    try {
      const draft = await apiFetch<ExpenseVoiceDraft>(`/api/trips/${encodeURIComponent(tripId)}/expenses/preview`, { method: "POST", body: JSON.stringify({ prompt }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]) });
      if (active.current === controller) onDraft(draft);
    } catch { if (active.current === controller) setFailed(true); }
    finally { if (active.current === controller) { active.current = null; setBusy(false); } }
  };
  return <div className="flex flex-col gap-2">
    <VoiceInput disabled={busy} onUse={setPrompt} />
    <Textarea aria-label={copy.request} placeholder={copy.placeholder} value={prompt} maxLength={2000} disabled={busy} onChange={e => setPrompt(e.target.value)} />
    <Button type="button" variant="outline" disabled={busy || prompt.trim().length < 3} onClick={() => void interpret()}>{busy ? copy.busy : copy.interpret}</Button>
    {failed && <p role="alert">{copy.failed}</p>}
    <p className="text-xs text-muted-foreground">{copy.review}</p>
  </div>;
}
