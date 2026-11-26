import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Clock, Users, ListChecks, CalendarX, Timer, FolderX, ShieldCheck } from "lucide-react";
import { useProjects, useTasks, useActiveProfiles } from "@/hooks/useSupabaseData";
import { useActiveTimers } from "@/hooks/useActiveTimers";
import { useAuth } from "@/contexts/AuthContext";

type Severity = "high" | "medium" | "low";
type AlertType =
  | "tarefa_atrasada" | "timer_longo" | "tarefa_prazo_proximo" | "tarefa_nao_iniciada"
  | "aguardando_validacao" | "projeto_atrasado" | "sobrecarga";

interface AlertItem { id: string; type: AlertType; severity: Severity; message: string; link?: string; }

const severityColors = {
  high: "bg-destructive text-destructive-foreground",
  medium: "bg-warning text-warning-foreground",
  low: "bg-info text-info-foreground",
};
const severityLabels = { high: "Crítico", medium: "Atenção", low: "Info" };

const typeIcons: Record<AlertType, typeof AlertTriangle> = {
  tarefa_atrasada: ListChecks,
  timer_longo: Timer,
  tarefa_prazo_proximo: Clock,
  tarefa_nao_iniciada: CalendarX,
  aguardando_validacao: ShieldCheck,
  projeto_atrasado: FolderX,
  sobrecarga: Users,
};
const typeLabels: Record<AlertType, string> = {
  tarefa_atrasada: "Tarefa atrasada",
  timer_longo: "Timer ligado há muito tempo",
  tarefa_prazo_proximo: "Prazo próximo",
  tarefa_nao_iniciada: "Tarefa não iniciada",
  aguardando_validacao: "Aguardando validação",
  projeto_atrasado: "Projeto com prazo vencido",
  sobrecarga: "Sobrecarga",
};

const DONE = new Set(["concluida", "enviado_cliente", "aprovada"]);
const ACTIVE = new Set(["nao_iniciada", "em_andamento", "pausada", "reprovada"]);

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
/** Dias entre duas datas YYYY-MM-DD (b - a), sem fuso. */
function diffDays(a: string, b: string): number {
  const [ay, am, ad] = a.slice(0, 10).split("-").map(Number);
  const [by, bm, bd] = b.slice(0, 10).split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

export default function Alertas() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { projects } = useProjects();
  const { tasks } = useTasks();
  const { activeTimers } = useActiveTimers();
  const { profiles } = useActiveProfiles();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [validationSince, setValidationSince] = useState<Map<string, string>>(new Map());
  const pendingKey = tasks.filter(t => t.status === "aguardando_validacao").map(t => t.id).join(",");
  useEffect(() => {
    if (!pendingKey) { setValidationSince(new Map()); return; }
    supabase.from("tasks").select("id, status_changed_at").eq("status", "aguardando_validacao").not("status_changed_at", "is", null)
      .then(({ data }) => setValidationSince(new Map((data ?? []).map((r: any) => [r.id, r.status_changed_at]))));
  }, [pendingKey]);

  const alerts = useMemo<AlertItem[]>(() => {
    const today = todayLocal();
    const isCoord = profile?.role === "coordenador";
    const visibleProjects = isCoord ? projects.filter(p => p.responsible === profile?.id) : projects;
    const visibleIds = new Set(visibleProjects.map(p => p.id));
    const projById = new Map(projects.map(p => [p.id, p]));
    const nameById = new Map(profiles.map(p => [p.id, p.name]));
    const taskById = new Map(tasks.map(t => [t.id, t]));
    const visibleTasks = tasks.filter(t => visibleIds.has(t.projectId));
    const out: AlertItem[] = [];
    const respName = (id?: string | null) => (id && nameById.get(id)) || "sem responsável";
    const projName = (id: string) => projById.get(id)?.name || "—";

    for (const t of visibleTasks) {
      const status = t.status as string;
      const end = t.endDate ? String(t.endDate).slice(0, 10) : "";
      const start = t.startDate ? String(t.startDate).slice(0, 10) : "";
      if (end && !DONE.has(status)) {
        const d = diffDays(end, today);
        if (d > 0) {
          out.push({ id: `late-${t.id}`, type: "tarefa_atrasada", severity: "high", link: `/tarefas/${t.id}`,
            message: `Tarefa ${t.name} (${projName(t.projectId)}) atrasada há ${d} dia${d === 1 ? "" : "s"} — Responsável ${respName(t.responsible)}` });
        } else if (d >= -3) {
          const n = -d;
          out.push({ id: `soon-${t.id}`, type: "tarefa_prazo_proximo", severity: "medium", link: `/tarefas/${t.id}`,
            message: `Tarefa ${t.name} (${projName(t.projectId)}) vence ${n === 0 ? "hoje" : `em ${n} dia${n === 1 ? "" : "s"}`} — Responsável ${respName(t.responsible)}` });
        }
      }
      if (status === "nao_iniciada" && start && start < today) {
        out.push({ id: `ns-${t.id}`, type: "tarefa_nao_iniciada", severity: "medium", link: `/tarefas/${t.id}`,
          message: `Tarefa ${t.name} (${projName(t.projectId)}) deveria ter começado em ${start.split("-").reverse().join("/")} e não foi iniciada — Responsável ${respName(t.responsible)}` });
      }
      if (status === "aguardando_validacao") {
        const since = validationSince.get(t.id);
        const days = since ? Math.floor((Date.now() - new Date(since).getTime()) / 86400000) : null;
        out.push({ id: `val-${t.id}`, type: "aguardando_validacao", severity: days !== null && days > 3 ? "high" : "medium", link: `/tarefas/${t.id}`,
          message: `Tarefa ${t.name} (${projName(t.projectId)}) aguardando validação${days !== null ? ` há ${days} ${days === 1 ? "dia" : "dias"}` : ""} — Responsável ${respName(t.responsible)}` });
      }
    }

    const now = Date.now();
    for (const timer of activeTimers) {
      if (!visibleIds.has(timer.project_id)) continue;
      const hours = (now - new Date(timer.started_at).getTime()) / 3600000;
      if (hours > 10) {
        const task = taskById.get(timer.task_id);
        out.push({ id: `timer-${timer.id}`, type: "timer_longo", severity: "high", link: `/tarefas/${timer.task_id}`,
          message: `Timer de ${timer.user_name} ligado há ${Math.floor(hours)}h na tarefa ${task?.name || "—"}` });
      }
    }

    for (const p of visibleProjects) {
      const dl = p.deadline ? String(p.deadline).slice(0, 10) : "";
      if (dl && dl < today && p.status !== "concluido") {
        const d = diffDays(dl, today);
        out.push({ id: `proj-${p.id}`, type: "projeto_atrasado", severity: "medium", link: `/projetos/${p.id}`,
          message: `Projeto ${p.name} com prazo vencido há ${d} dia${d === 1 ? "" : "s"}` });
      }
    }

    const counts = new Map<string, number>();
    for (const t of visibleTasks) {
      if (t.responsible && ACTIVE.has(t.status as string)) counts.set(t.responsible, (counts.get(t.responsible) || 0) + 1);
    }
    counts.forEach((n, uid) => {
      if (n > 8) out.push({ id: `load-${uid}`, type: "sobrecarga", severity: "low",
        message: `${respName(uid)} está com ${n} tarefas ativas — possível sobrecarga` });
    });

    const order = { high: 0, medium: 1, low: 2 };
    return out.sort((a, b) => order[a.severity] - order[b.severity]);
  }, [projects, tasks, activeTimers, profiles, profile, validationSince]);

  const filtered = typeFilter === "all" ? alerts : alerts.filter(a => a.type === typeFilter);
  const countBy = (s: Severity) => alerts.filter(a => a.severity === s).length;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="animate-reveal-up flex flex-wrap items-end justify-between gap-4" style={{ animationFillMode: "backwards" }}>
          <div>
            <h1 className="text-2xl font-bold">Alertas</h1>
            <p className="text-muted-foreground mt-1">{alerts.length} alertas ativos</p>
            <div className="flex gap-2 mt-2">
              {(["high", "medium", "low"] as Severity[]).map(s => (
                <Badge key={s} variant="secondary" className={severityColors[s]}>{severityLabels[s]}: {countBy(s)}</Badge>
              ))}
            </div>
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Todos os tipos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {(Object.keys(typeLabels) as AlertType[]).map(k => <SelectItem key={k} value={k}>{typeLabels[k]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-10">Nenhum alerta no momento</p>
          )}
          {filtered.map((alert, i) => {
            const Icon = typeIcons[alert.type] || AlertTriangle;
            return (
              <Card
                key={alert.id}
                onClick={alert.link ? () => navigate(alert.link!) : undefined}
                className={`shadow-sm animate-reveal-up ${alert.link ? "cursor-pointer hover:bg-muted/40 transition-colors" : ""}`}
                style={{ animationDelay: `${Math.min(i + 1, 15) * 60}ms`, animationFillMode: "backwards" }}
              >
                <CardContent className="flex items-start gap-4 py-4">
                  <div className={`p-2 rounded-lg ${alert.severity === "high" ? "bg-destructive/10" : alert.severity === "medium" ? "bg-warning/10" : "bg-info/10"}`}>
                    <Icon className={`h-4 w-4 ${alert.severity === "high" ? "text-destructive" : alert.severity === "medium" ? "text-warning" : "text-info"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{alert.message}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{typeLabels[alert.type]}</p>
                  </div>
                  <Badge variant="secondary" className={severityColors[alert.severity]}>
                    {severityLabels[alert.severity]}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
