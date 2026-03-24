import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfiles, getProfileById, useTimeEntries, type DbTimeEntry } from "@/hooks/useSupabaseData";
import { useAuth } from "@/contexts/AuthContext";
import {
  DISCIPLINE_SHORT, TASK_STATUS_LABELS, type TaskStatus, type Task, type Discipline,
} from "@/types";
import { ArrowLeft, Play, Square, Clock, User, CalendarDays, Paperclip, History, Loader2 } from "lucide-react";
import { toast } from "sonner";

const taskStatusColors: Record<TaskStatus, string> = {
  nao_iniciada: "bg-muted text-muted-foreground",
  em_andamento: "bg-info text-info-foreground",
  concluida: "bg-success text-success-foreground",
};

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  return m > 0 ? `${h}h ${m.toString().padStart(2, "0")}min` : `${h}h`;
}

interface DbTask {
  id: string; name: string; project_id: string; discipline: string; stage_name: string;
  responsible: string; start_date: string; end_date: string; estimated_hours: number;
  hours_worked: number; status: string;
}

interface DbProject {
  id: string; name: string; client: string; discipline: string;
}

export default function TarefaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { profiles } = useActiveProfiles();
  const { entries: timeEntries, refetch: refetchEntries } = useTimeEntries(id);

  const [task, setTask] = useState<DbTask | null>(null);
  const [project, setProject] = useState<DbProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [timerStart, setTimerStart] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    supabase.from("tasks").select("*").eq("id", id).maybeSingle().then(async ({ data }) => {
      if (data) {
        const t = data as unknown as DbTask;
        setTask(t);
        const { data: proj } = await supabase.from("projects").select("id, name, client, discipline").eq("id", t.project_id).maybeSingle();
        if (proj) setProject(proj as unknown as DbProject);
      }
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    if (!timerStart) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - timerStart.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [timerStart]);

  const formatTimer = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const totalHistoryMinutes = useMemo(() => timeEntries.reduce((sum, r) => sum + r.duration_minutes, 0), [timeEntries]);
  const hoursProgress = task && Number(task.estimated_hours) > 0
    ? Math.round((Number(task.hours_worked) / Number(task.estimated_hours)) * 100) : 0;

  const toggleTimer = async () => {
    if (!task || !profile) return;
    if (timerStart) {
      const now = new Date();
      const durationMinutes = Math.max(1, Math.round(elapsed / 60));
      const hoursWorked = elapsed / 3600;
      const pad = (n: number) => n.toString().padStart(2, "0");

      await supabase.from("time_entries").insert({
        task_id: task.id,
        project_id: task.project_id,
        user_id: profile.id,
        user_name: profile.name,
        date: now.toISOString().slice(0, 10),
        start_time: `${pad(timerStart.getHours())}:${pad(timerStart.getMinutes())}`,
        end_time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
        duration_minutes: durationMinutes,
      });

      const newHours = Math.round((Number(task.hours_worked) + hoursWorked) * 100) / 100;
      await supabase.from("tasks").update({ hours_worked: newHours, status: "em_andamento" }).eq("id", task.id);

      setTask(prev => prev ? { ...prev, hours_worked: newHours } : prev);
      setTimerStart(null);
      setElapsed(0);
      refetchEntries();
      toast.success("Atividade registrada!");
    } else {
      setTimerStart(new Date());
      setElapsed(0);
      if (task.status === "nao_iniciada") {
        await supabase.from("tasks").update({ status: "em_andamento" }).eq("id", task.id);
        setTask(prev => prev ? { ...prev, status: "em_andamento" } : prev);
      }
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </AppLayout>
    );
  }

  if (!task || !project) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <p>Tarefa não encontrada.</p>
          <Button variant="ghost" className="mt-4" onClick={() => navigate("/tarefas")}>Voltar para Tarefas</Button>
        </div>
      </AppLayout>
    );
  }

  const responsible = getProfileById(profiles, task.responsible);
  const isOverdue = new Date(task.end_date) < new Date() && task.status !== "concluida";

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="animate-reveal-up" style={{ animationFillMode: "backwards" }}>
          <Button variant="ghost" size="sm" className="gap-1.5 mb-3 -ml-2" onClick={() => navigate("/tarefas")}>
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">{task.name}</h1>
              <p className="text-muted-foreground mt-1">{project.name} · {task.stage_name}</p>
            </div>
            <div className="flex items-center gap-2">
              {isOverdue && <Badge variant="destructive">Atrasada</Badge>}
              <Badge variant="secondary" className={taskStatusColors[task.status as TaskStatus]}>
                {TASK_STATUS_LABELS[task.status as TaskStatus]}
              </Badge>
            </div>
          </div>
        </div>

        {task.status !== "concluida" && (
          <Card className="shadow-sm animate-reveal-up delay-1" style={{ animationFillMode: "backwards" }}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Controle de Tempo</p>
                    <p className="text-xs text-muted-foreground">{timerStart ? "Atividade em andamento..." : "Clique para iniciar"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {timerStart && <span className="text-2xl font-bold font-mono tabular-nums text-primary">{formatTimer(elapsed)}</span>}
                  <Button variant={timerStart ? "destructive" : "default"} className="gap-2" onClick={toggleTimer}>
                    {timerStart ? <><Square className="h-4 w-4" /> Parar</> : <><Play className="h-4 w-4" /> Iniciar</>}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-reveal-up delay-2" style={{ animationFillMode: "backwards" }}>
          <Card className="shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground">Informações</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Projeto</span><span className="font-medium">{project.name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Disciplina</span><span className="font-medium">{DISCIPLINE_SHORT[task.discipline as Discipline]}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Etapa</span><span className="font-medium">{task.stage_name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" /> Responsável</span><span className="font-medium">{responsible?.name || "—"}</span></div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground">Prazos e Horas</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Início</span><span className="font-medium tabular-nums">{new Date(task.start_date).toLocaleDateString("pt-BR")}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Término</span><span className={`font-medium tabular-nums ${isOverdue ? "text-destructive" : ""}`}>{new Date(task.end_date).toLocaleDateString("pt-BR")}</span></div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-muted-foreground">Progresso</span>
                  <span className={`font-medium tabular-nums ${hoursProgress > 100 ? "text-destructive" : ""}`}>{Number(task.hours_worked)}h / {Number(task.estimated_hours)}h ({hoursProgress}%)</span>
                </div>
                <Progress value={Math.min(hoursProgress, 100)} className={`h-2 ${hoursProgress > 100 ? "[&>div]:bg-destructive" : ""}`} />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-sm animate-reveal-up delay-3" style={{ animationFillMode: "backwards" }}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4" /> Histórico de Atividades
              <Badge variant="secondary" className="ml-auto font-mono text-xs">Total: {formatDuration(totalHistoryMinutes)}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {timeEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum registro de atividade ainda.</p>
            ) : (
              <div className="space-y-2">
                {timeEntries.map((record) => (
                  <div key={record.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                    <div>
                      <p className="text-sm font-medium">{record.user_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(record.date + "T00:00:00").toLocaleDateString("pt-BR")} — {record.start_time} → {record.end_time}
                      </p>
                    </div>
                    <div className="text-right"><p className="text-sm font-medium tabular-nums">{formatDuration(record.duration_minutes)}</p></div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm animate-reveal-up delay-4" style={{ animationFillMode: "backwards" }}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Paperclip className="h-4 w-4" /> Arquivos Anexos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum arquivo anexado.</p>
            <Button variant="outline" size="sm" className="mt-3 gap-1"><Paperclip className="h-3 w-3" /> Anexar arquivo</Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
