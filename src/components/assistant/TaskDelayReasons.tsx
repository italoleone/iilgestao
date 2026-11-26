import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAll";
import { dateBR, timestampBR, DECISION_LABELS, FOLLOWUP_LABELS, type Followup } from "@/lib/assistant";

export function TaskDelayReasons({ taskId }: { taskId: string }) {
  const { data: rows, error } = useQuery({
    queryKey: ["task-delay-reasons", taskId],
    queryFn: () => fetchAllRows<Followup>(() => supabase.from("agent_followups").select("*").eq("task_id", taskId).eq("is_test", false).order("asked_at", { ascending: false })),
    refetchInterval: 60000, refetchOnWindowFocus: true,
  });
  if (!rows?.length && !error) return null;
  return <Card><CardHeader><CardTitle className="text-base">Justificativas de atraso</CardTitle></CardHeader><CardContent>
    {error ? <p className="text-sm text-destructive">Não foi possível carregar as justificativas.</p> : <div className="divide-y">{rows?.map(f => <div key={f.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2"><time className="text-sm text-muted-foreground">{timestampBR(f.asked_at)}</time><Badge variant="secondary">{FOLLOWUP_LABELS[f.status] ?? f.status}</Badge></div>
      {f.reason_summary && <p className="break-words text-sm">{f.reason_summary}</p>}
      <p className="text-sm">{dateBR(f.old_end_date)} → {dateBR(f.proposed_end_date)}</p>
      {f.decision && <p className="text-xs text-muted-foreground">{DECISION_LABELS[f.decision] ?? f.decision}</p>}
    </div>)}</div>}
  </CardContent></Card>;
}
