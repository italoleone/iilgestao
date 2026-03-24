import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfiles, getProfileById, useTasks } from "@/hooks/useSupabaseData";
import { useAuth } from "@/contexts/AuthContext";
import { DISCIPLINE_SHORT, STATUS_LABELS, TASK_STATUS_LABELS, type ProjectStatus, type TaskStatus, type Discipline, type Project, type Stage } from "@/types";
import { ArrowLeft, Clock, DollarSign, Users, FileText, ListChecks, Loader2, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { formatBRL } from "@/lib/utils";
import { useTimeEntries } from "@/hooks/useSupabaseData";

const statusColors: Record<ProjectStatus, string> = {
  em_andamento: "bg-info text-info-foreground",
  concluido: "bg-success text-success-foreground",
  atrasado: "bg-destructive text-destructive-foreground",
  pausado: "bg-muted text-muted-foreground",
};

const stageStatusColors: Record<string, string> = {
  pendente: "bg-muted text-muted-foreground",
  em_andamento: "bg-info text-info-foreground",
  concluido: "bg-success text-success-foreground",
  revisao: "bg-warning text-warning-foreground",
};

const stageStatusLabels: Record<string, string> = {
  pendente: "Pendente", em_andamento: "Em andamento", concluido: "Concluído", revisao: "Em revisão",
};

const taskStatusColors: Record<TaskStatus, string> = {
  nao_iniciada: "bg-muted text-muted-foreground",
  em_andamento: "bg-info text-info-foreground",
  concluida: "bg-success text-success-foreground",
};

export default function ProjetoDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profiles } = useActiveProfiles();
  const { tasks: allTasks } = useTasks();
  const { canAccessFinanceiro: canSeeFinancial, canAccessAllProjects } = useAuth();
  const { entries: projectTimeEntries } = useTimeEntries(undefined, id);

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase.from("projects").select("*").eq("id", id).maybeSingle().then(({ data }) => {
      if (data) {
        const d = data as any;
        const stages: Stage[] = Array.isArray(d.stages) ? d.stages : [];
        setProject({
          id: d.id, name: d.name, client: d.client, discipline: d.discipline,
          startDate: d.start_date, deadline: d.deadline, status: d.status,
          responsible: d.responsible, team: d.team || [d.responsible],
          hoursSold: d.hours_sold, saleValue: d.sale_value, hoursWorked: d.hours_worked,
          stages, revisions: Array.isArray(d.revisions) ? d.revisions : [],
        });
      }
      setLoading(false);
    });
  }, [id]);

  const projectTasks = useMemo(() => allTasks.filter(t => t.projectId === id), [allTasks, id]);
  const taskHours = useMemo(() => ({
    estimated: projectTasks.reduce((s, t) => s + t.estimatedHours, 0),
    worked: projectTasks.reduce((s, t) => s + t.hoursWorked, 0),
  }), [projectTasks]);

  const cost = useMemo(() => projectTimeEntries.reduce((sum, entry) => {
    const userProfile = getProfileById(profiles, entry.user_id);
    const costPerHour = userProfile?.cost_per_hour || 0;
    return sum + (entry.duration_minutes / 60) * costPerHour;
  }, 0), [projectTimeEntries, profiles]);

  if (loading) {
    return <AppLayout><div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></AppLayout>;
  }

  if (!project) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">Projeto não encontrado.</p>
          <button onClick={() => navigate("/projetos")} className="text-primary mt-2 text-sm underline">Voltar aos projetos</button>
        </div>
      </AppLayout>
    );
  }

  const completedStages = project.stages.filter(s => s.status === "concluido").length;
  const progress = project.stages.length > 0 ? Math.round((completedStages / project.stages.length) * 100) : 0;
  const responsible = getProfileById(profiles, project.responsible);
  const revenue = project.saleValue;
  const profit = revenue - cost;

  const handleDeleteProject = async () => {
    setDeleting(true);
    const { error } = await supabase.from("projects").delete().eq("id", project.id);
    setDeleting(false);
    if (error) {
      toast.error("Erro ao excluir projeto: " + error.message);
    } else {
      toast.success("Projeto excluído com sucesso.");
      navigate("/projetos");
    }
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="animate-reveal-up" style={{ animationFillMode: "backwards" }}>
          <div className="flex items-center justify-between mb-3">
            <Button variant="ghost" size="sm" className="gap-1.5 -ml-2" onClick={() => navigate("/projetos")}>
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
            {canAccessAllProjects && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="gap-1.5" disabled={deleting}>
                    <Trash2 className="h-4 w-4" /> Excluir Projeto
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir projeto?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja excluir o projeto <strong>{project.name}</strong>?
                      <br /><br />
                      ⚠️ Todas as tarefas vinculadas e registros de horas também serão excluídos permanentemente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteProject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Excluir permanentemente
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div><h1 className="text-2xl font-bold">{project.name}</h1><p className="text-muted-foreground mt-1">{project.client}</p></div>
            <Badge variant="secondary" className={statusColors[project.status]}>{STATUS_LABELS[project.status]}</Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-reveal-up delay-1" style={{ animationFillMode: "backwards" }}>
          <Card className="shadow-sm"><CardContent className="pt-4"><p className="text-xs text-muted-foreground mb-1">Disciplina</p><p className="font-medium">{DISCIPLINE_SHORT[project.discipline]}</p></CardContent></Card>
          <Card className="shadow-sm"><CardContent className="pt-4"><p className="text-xs text-muted-foreground mb-1">Coordenador</p><p className="font-medium">{responsible?.name || "—"}</p></CardContent></Card>
          <Card className="shadow-sm"><CardContent className="pt-4"><p className="text-xs text-muted-foreground mb-1">Prazo</p><p className="font-medium tabular-nums">{new Date(project.deadline).toLocaleDateString("pt-BR")}</p></CardContent></Card>
          <Card className="shadow-sm"><CardContent className="pt-4"><p className="text-xs text-muted-foreground mb-1">Tarefas</p><p className="font-medium tabular-nums">{projectTasks.filter(t => t.status === "concluida").length}/{projectTasks.length}</p></CardContent></Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-sm animate-reveal-up delay-2" style={{ animationFillMode: "backwards" }}>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" /> Horas</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Valor de Venda</span><span className="font-medium tabular-nums">R$ {formatBRL(project.saleValue)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Horas estimadas (tarefas)</span><span className="font-medium tabular-nums">{taskHours.estimated}h</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Horas realizadas (tarefas)</span><span className="font-medium tabular-nums">{taskHours.worked}h</span></div>
              <Progress value={taskHours.estimated > 0 ? (taskHours.worked / taskHours.estimated) * 100 : 0} className="h-2" />
            </CardContent>
          </Card>

          {canSeeFinancial && (
            <Card className="shadow-sm animate-reveal-up delay-3" style={{ animationFillMode: "backwards" }}>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4" /> Financeiro</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Receita</span><span className="font-medium tabular-nums">R$ {formatBRL(revenue)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Custo</span><span className="font-medium tabular-nums">R$ {formatBRL(cost)}</span></div>
                <div className={`flex justify-between text-sm font-semibold ${profit >= 0 ? "text-success" : "text-destructive"}`}>
                  <span>Resultado</span><span className="tabular-nums">{profit >= 0 ? "+" : ""}R$ {formatBRL(profit)}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="shadow-sm animate-reveal-up delay-4" style={{ animationFillMode: "backwards" }}>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><ListChecks className="h-4 w-4" /> Tarefas ({projectTasks.length})</CardTitle></CardHeader>
          <CardContent>
            {projectTasks.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma tarefa cadastrada.</p> : (
              <div className="space-y-2">
                {projectTasks.map(task => {
                  const taskResp = getProfileById(profiles, task.responsible);
                  const hp = task.estimatedHours > 0 ? Math.round((task.hoursWorked / task.estimatedHours) * 100) : 0;
                  const isOverdue = new Date(task.endDate) < new Date() && task.status !== "concluida";
                  return (
                    <div key={task.id} className={`flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/30 transition-colors cursor-pointer ${isOverdue ? "border-destructive/40" : ""}`} onClick={() => navigate(`/tarefas/${task.id}`)}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{task.name}</p>
                        <p className="text-xs text-muted-foreground">{task.stageName} · {taskResp?.name}</p>
                      </div>
                      <div className="hidden sm:flex items-center gap-2 w-24">
                        <Progress value={Math.min(hp, 100)} className={`h-1.5 flex-1 ${hp > 100 ? "[&>div]:bg-destructive" : ""}`} />
                        <span className="text-xs tabular-nums text-muted-foreground">{task.hoursWorked}/{task.estimatedHours}h</span>
                      </div>
                      <Badge variant="secondary" className={taskStatusColors[task.status]}>{TASK_STATUS_LABELS[task.status]}</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm animate-reveal-up delay-5" style={{ animationFillMode: "backwards" }}>
          <CardHeader><CardTitle className="text-base">Etapas do Projeto</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {project.stages.map((stage, i) => {
                const stageResp = getProfileById(profiles, stage.responsible);
                return (
                  <div key={stage.id} className="flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{stage.name}</p>
                      <p className="text-xs text-muted-foreground">{stageResp?.name}</p>
                    </div>
                    <Badge variant="secondary" className={stageStatusColors[stage.status]}>{stageStatusLabels[stage.status]}</Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
