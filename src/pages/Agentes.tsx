import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Save, Play, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAll";
import { canAccessAgents, callAssistant, dateBR, timestampBR, FOLLOWUP_LABELS, DECISION_LABELS, needsActivationConfirmation, validateAgentSettings, type AgentSettings, type Followup } from "@/lib/assistant";

type FollowupRow = Followup & { projetista: { name: string } | null; coordenador: { name: string } | null; tarefa: { name: string } | null };
const DAYS = [{ n: 1, label: "Seg" }, { n: 2, label: "Ter" }, { n: 3, label: "Qua" }, { n: 4, label: "Qui" }, { n: 5, label: "Sex" }, { n: 6, label: "Sáb" }, { n: 0, label: "Dom" }];
const MODE_DESCRIPTIONS: Record<string, string> = { teste: "Mensagens somente para o destinatário do teste. Nenhuma data de tarefa é alterada.", ativo: "Cobranças enviadas aos projetistas. Novas datas podem ser registradas conforme o limite configurado.", desligado: "Não envia cobranças nem processa respostas." };

export default function Agentes() {
  const { profile } = useAuth();
  const allowed = canAccessAgents(profile?.role ?? "");
  const client = useQueryClient();
  const [draft, setDraft] = useState<AgentSettings | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [kind, setKind] = useState("teste");
  const [status, setStatus] = useState("todos");
  const [summary, setSummary] = useState<Record<string, number | string> | null>(null);
  const settings = useQuery({ queryKey: ["agent-settings"], enabled: allowed, queryFn: async () => {
    const { data, error } = await supabase.from("agent_settings").select("*").eq("id", 1).single();
    if (error) throw error;
    return data;
  }, refetchOnWindowFocus: true });
  const people = useQuery({ queryKey: ["agent-active-people"], enabled: allowed, queryFn: () => fetchAllRows<{ id: string; name: string }>(() => supabase.from("profiles").select("id,name").eq("status", "active").order("name")) });
  const followups = useQuery({ queryKey: ["agent-followups", kind], enabled: allowed, queryFn: () => fetchAllRows<FollowupRow>(() => supabase.from("agent_followups")
    .select("*,projetista:profiles!agent_followups_projetista_id_fkey(name),coordenador:profiles!agent_followups_coordenador_id_fkey(name),tarefa:tasks!agent_followups_task_id_fkey(name)")
    .eq("is_test", kind === "teste").order("asked_at", { ascending: false })), refetchInterval: 60000, refetchOnWindowFocus: true });
  useEffect(() => { if (settings.data && !dirty) setDraft(settings.data); }, [settings.data, dirty]);
  const change = (values: Partial<AgentSettings>) => { setDraft(s => s ? { ...s, ...values } : s); setDirty(true); };
  const save = async () => {
    if (!draft || !allowed) return;
    const issue = validateAgentSettings(draft);
    if (issue) { toast.error(issue); return; }
    if (draft.mode === "teste" && !(people.data ?? []).some(p => p.id === draft.test_recipient_id)) { toast.error("O destinatário do teste precisa estar ativo."); return; }
    setSaving(true);
    try {
      // Do not overwrite last_run_date or the execution lease with a stale form.
      const current = await supabase.from("agent_settings").select("updated_at").eq("id", 1).single();
      if (current.error) throw current.error;
      if (new Date(current.data.updated_at).getTime() > Date.now()) throw new Error("Aguarde a execução atual do assistente antes de salvar.");
      const { data, error } = await supabase.from("agent_settings").update({ mode: draft.mode, test_recipient_id: draft.test_recipient_id,
        auto_limit_business_days: draft.auto_limit_business_days, run_weekdays: draft.run_weekdays, run_hour: draft.run_hour, max_reminders: draft.max_reminders,
        updated_at: new Date().toISOString(),
      }).eq("id", 1).eq("updated_at", current.data.updated_at).select("id");
      if (error) throw error;
      if (data?.length !== 1) throw new Error("As configurações mudaram durante o salvamento. Atualize e tente novamente.");
      setDirty(false); await settings.refetch(); toast.success("Configuração salva.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível salvar a configuração."); }
    finally { setSaving(false); }
  };
  const requestSave = () => {
    if (!draft || !settings.data) return;
    const issue = validateAgentSettings(draft);
    if (issue) { toast.error(issue); return; }
    if (needsActivationConfirmation(settings.data.mode, draft.mode)) setConfirm(true);
    else void save();
  };
  const run = async () => {
    if (!allowed || running) return;
    setRunning(true); setSummary(null);
    try { setSummary(await callAssistant({ action: "run", force: true })); await Promise.all([followups.refetch(), settings.refetch(), client.invalidateQueries({ queryKey: ["assistant-chat"] }), client.invalidateQueries({ queryKey: ["assistant-unread"] })]); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível rodar o assistente."); await settings.refetch(); }
    finally { setRunning(false); }
  };
  const rows = followups.data ?? [];
  const shown = status === "todos" ? rows : rows.filter(f => f.status === status);
  const counters = [
    { label: "Abertas", count: rows.filter(f => ["aguardando_resposta", "resposta_recebida", "aguardando_aprovacao"].includes(f.status)).length },
    { label: "Aguardando aprovação", count: rows.filter(f => f.status === "aguardando_aprovacao").length },
    { label: "Resolvidas", count: rows.filter(f => f.status === "resolvido").length },
    { label: "Sem resposta", count: rows.filter(f => f.status === "sem_resposta").length },
  ];
  if (!allowed) return null;
  return <AppLayout><div className="space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="flex items-center gap-2 text-2xl font-bold tracking-normal"><Bot className="h-6 w-6" /> Agentes</h1><p className="mt-1 text-sm text-muted-foreground">Assistente Leone — cobrança de tarefas atrasadas</p></div>
      <Button onClick={() => void run()} disabled={running || saving || dirty || !settings.data || settings.data.mode === "desligado"}>{running ? <Loader2 className="animate-spin" /> : <Play />}{running ? "Executando…" : "Rodar agora"}</Button>
    </header>
    <div className="grid grid-cols-2 gap-4 border-y py-4 lg:grid-cols-4">{counters.map(c => <div key={c.label}><p className="text-sm text-muted-foreground">{c.label}</p><p className="mt-1 text-3xl font-semibold tabular-nums">{c.count}</p></div>)}</div>
    {summary && <div className="border-l-4 border-accent bg-muted px-4 py-3" role="status"><h2 className="text-sm font-semibold">Resumo da execução</h2>{summary.skipped ? <p className="mt-1 text-sm">{summary.skipped === "desligado" ? "Assistente desligado." : "Nenhuma ação necessária neste horário."}</p> : <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">{[["cobrancas_criadas", "Cobranças criadas"], ["lembretes", "Lembretes"], ["respostas_processadas", "Respostas processadas"], ["avisos", "Avisos"], ["erros", "Erros"]].map(([key, label]) => <span key={key}>{label}: <strong>{summary[key] ?? 0}</strong></span>)}</div>}</div>}
    <Card><CardHeader><CardTitle className="text-base">Configuração</CardTitle></CardHeader><CardContent>
      {settings.error ? <p className="text-sm text-destructive">Não foi possível carregar a configuração.</p> : !draft ? <p className="text-sm text-muted-foreground">Carregando configuração…</p> : <div className="space-y-5">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="agent-mode">Modo</Label><Select value={draft.mode} onValueChange={mode => change({ mode })}><SelectTrigger id="agent-mode"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="teste">Teste</SelectItem><SelectItem value="ativo">Ativo</SelectItem><SelectItem value="desligado">Desligado</SelectItem></SelectContent></Select><p className="text-xs text-muted-foreground">{MODE_DESCRIPTIONS[draft.mode]}</p></div>
          <div className="space-y-2"><Label htmlFor="agent-recipient">Destinatário do teste</Label><Select value={draft.test_recipient_id ?? "nenhum"} onValueChange={v => change({ test_recipient_id: v === "nenhum" ? null : v })}><SelectTrigger id="agent-recipient"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="nenhum">Selecionar usuário</SelectItem>{people.data?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>{people.error && <p className="text-xs text-destructive">Não foi possível carregar os usuários.</p>}</div>
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          <div className="space-y-2"><Label htmlFor="agent-limit">Mudar data sozinho até N dias úteis</Label><Input id="agent-limit" type="number" min={0} step={1} value={Number.isNaN(draft.auto_limit_business_days) ? "" : draft.auto_limit_business_days} onChange={e => change({ auto_limit_business_days: e.target.valueAsNumber })} /></div>
          <div className="space-y-2"><Label htmlFor="agent-hour">Hora (São Paulo)</Label><Input id="agent-hour" type="number" min={0} max={23} step={1} value={Number.isNaN(draft.run_hour) ? "" : draft.run_hour} onChange={e => change({ run_hour: e.target.valueAsNumber })} /></div>
          <div className="space-y-2"><Label htmlFor="agent-reminders">Número máximo de lembretes</Label><Input id="agent-reminders" type="number" min={0} step={1} value={Number.isNaN(draft.max_reminders) ? "" : draft.max_reminders} onChange={e => change({ max_reminders: e.target.valueAsNumber })} /></div>
        </div>
        <fieldset><legend className="mb-3 text-sm font-medium">Dias da semana</legend><div className="flex flex-wrap gap-x-6 gap-y-3">{DAYS.map(d => <label key={d.n} className="flex cursor-pointer items-center gap-2 text-sm"><Checkbox checked={draft.run_weekdays.includes(d.n)} onCheckedChange={checked => change({ run_weekdays: checked === true ? [...draft.run_weekdays, d.n] : draft.run_weekdays.filter(n => n !== d.n) })} />{d.label}</label>)}</div></fieldset>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><p className="text-xs text-muted-foreground">Última execução: {dateBR(settings.data?.last_run_date ?? null)}</p><Button onClick={requestSave} disabled={saving || running || !dirty}><Save />{saving ? "Salvando…" : "Salvar"}</Button></div>
      </div>}
    </CardContent></Card>
    <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Cobranças</h2><div className="flex flex-wrap gap-3">
      <Select value={kind} onValueChange={setKind}><SelectTrigger className="w-32" aria-label="Tipo de cobrança"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="teste">Teste</SelectItem><SelectItem value="reais">Reais</SelectItem></SelectContent></Select>
      <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-56" aria-label="Status da cobrança"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os status</SelectItem>{Object.entries(FOLLOWUP_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
    </div></div>
    <div className="overflow-x-auto rounded-lg border bg-card"><Table><TableHeader><TableRow>{["Data", "Projetista", "Tarefa", "Coordenador", "Status", "Motivo", "Nova data", "Decisão", "Lembretes"].map(h => <TableHead key={h} className="whitespace-nowrap">{h}</TableHead>)}</TableRow></TableHeader><TableBody>
      {followups.error ? <TableRow><TableCell colSpan={9} className="text-destructive">Não foi possível carregar as cobranças.</TableCell></TableRow> : followups.isPending ? <TableRow><TableCell colSpan={9} className="text-muted-foreground">Carregando cobranças…</TableCell></TableRow> : !shown.length ? <TableRow><TableCell colSpan={9} className="py-8 text-center text-muted-foreground">Nenhuma cobrança encontrada.</TableCell></TableRow> : shown.map(f => <TableRow key={f.id}>
        <TableCell className="whitespace-nowrap text-xs">{timestampBR(f.asked_at)}</TableCell><TableCell className="min-w-36">{f.projetista?.name ?? "—"}</TableCell><TableCell className="min-w-48 max-w-72"><Button asChild variant="link" className="h-auto max-w-full justify-start whitespace-normal px-0 text-left"><Link to={`/tarefas/${f.task_id}`}>{f.tarefa?.name ?? "Abrir tarefa"}<ExternalLink className="shrink-0" /></Link></Button></TableCell><TableCell className="min-w-36">{f.coordenador?.name ?? "—"}</TableCell><TableCell><Badge variant="secondary" className="whitespace-nowrap">{FOLLOWUP_LABELS[f.status] ?? f.status}</Badge></TableCell><TableCell className="min-w-48 max-w-80 break-words">{f.reason_summary ?? "—"}</TableCell><TableCell className="whitespace-nowrap">{dateBR(f.proposed_end_date)}</TableCell><TableCell className="min-w-36">{f.decision ? DECISION_LABELS[f.decision] ?? f.decision : "—"}</TableCell><TableCell className="text-center tabular-nums">{f.reminders}</TableCell>
      </TableRow>)}
    </TableBody></Table></div></section>
    <AlertDialog open={confirm} onOpenChange={setConfirm}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Ativar Assistente Leone?</AlertDialogTitle><AlertDialogDescription>A partir de agora os projetistas vão receber as cobranças de verdade e as datas poderão ser alteradas. Confirmar?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => void save()}>Confirmar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div></AppLayout>;
}
