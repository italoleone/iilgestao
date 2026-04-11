import { useState, useMemo, useEffect } from "react";
import { ProjectCombobox } from "@/components/ProjectCombobox";
import { parseLocalDate, formatDateBR } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useProjects, useTasks, useActiveProfiles, getProfileById } from "@/hooks/useSupabaseData";
import { useAuth } from "@/contexts/AuthContext";
import { TaskCalendar } from "@/components/TaskCalendar";
import { supabase } from "@/integrations/supabase/client";
import {
  DISCIPLINE_SHORT, TASK_STATUS_LABELS, STAGE_NAMES,
  type Discipline, type TaskStatus, type Task,
} from "@/types";
import {
  Search, Plus, Clock, User, ChevronRight, ListChecks, List, Calendar, Play, Square, Loader2, Radio, CheckCircle2, AlertTriangle, Send,
} from "lucide-react";
import { toast } from "sonner";
import { useActiveTimers, startActiveTimer, stopActiveTimer, getTimerForTask } from "@/hooks/useActiveTimers";
import { getTaskFilter } from "@/utils/permissions";

const taskStatusColors: Record<TaskStatus, string> = {
  nao_iniciada: "bg-muted text-muted-foreground",
  em_andamento: "bg-info text-info-foreground",
  concluida: "bg-success text-success-foreground",
  aguardando_validacao: "bg-warning text-warning-foreground",
  aprovada: "bg-success text-success-foreground",
  reprovada: "bg-destructive text-destructive-foreground",
  enviado_cliente: "bg-primary text-primary-foreground",
};

export default function Tarefas() {
  const { isProjetista, isCoordenador, canCreateTasks, profile } = useAuth();
  const navigate = useNavigate();
  const { projects } = useProjects();
  const { tasks: allTasks, loading, refetch: refetchTasks } = useTasks();
  const { profiles } = useActiveProfiles();
  const { activeTimers, loaded: timersLoaded } = useActiveTimers();
  const [activeTimerTaskId, setActiveTimerTaskId] = useState<string | null>(null);
  const [timerStart, setTimerStart] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Restore timer state from backend on mount / when activeTimers change
  useEffect(() => {
    if (!profile || !timersLoaded) return;
    const myTimer = activeTimers.find(t => t.user_id === profile.id);
    if (myTimer) {
      setActiveTimerTaskId(myTimer.task_id);
      const startedAt = new Date(myTimer.started_at);
      setTimerStart(startedAt);
      setElapsed(Math.floor((Date.now() - startedAt.getTime()) / 1000));
    } else if (activeTimerTaskId) {
      // Only clear if we previously had a timer (it was stopped)
      setActiveTimerTaskId(null);
      setTimerStart(null);
      setElapsed(0);
    }
  }, [activeTimers, profile, timersLoaded]);

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

  const toggleTimer = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeTimerTaskId === taskId && timerStart) {
      // Stop timer - all logic handled atomically by backend
      try {
        const result = await stopActiveTimer();
        if (result.stopped) {
          setActiveTimerTaskId(null);
          setTimerStart(null);
          setElapsed(0);
          refetchTasks();
          toast.success("Atividade registrada!");
        }
      } catch (err: any) {
        toast.error("Erro ao parar timer: " + err.message);
      }
    } else {
      // Start new timer - backend atomically stops any existing timer
      try {
        const task = allTasks.find(t => t.id === taskId);
        if (!task || !profile) return;
        await startActiveTimer(taskId, task.projectId);
        setActiveTimerTaskId(taskId);
        setTimerStart(new Date());
        setElapsed(0);
        if (task.status === "nao_iniciada") {
          refetchTasks();
        }
      } catch (err: any) {
        toast.error("Erro ao iniciar timer: " + err.message);
      }
    }
  };

  const [search, setSearch] = useState("");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterDiscipline, setFilterDiscipline] = useState<Discipline | "all">("all");
  const [filterStatus, setFilterStatus] = useState<TaskStatus | "all">("all");
  const [filterResponsible, setFilterResponsible] = useState<string>("all");
  const [filterStage, setFilterStage] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());

  const [form, setForm] = useState({
    name: "", projectId: "", stageName: "", responsible: "", startDate: "", endDate: "", estimatedHours: "",
  });

  const visibleTasks = useMemo(() => {
    let filtered = allTasks;

    if (!profile) return [];

    const role = profile.role;

    // PROJETISTA: vê todas suas tarefas ativas (com ou sem data)
    // Exceto as que já foram concluídas/enviadas ao cliente
    if (role === "projetista") {
      filtered = filtered.filter(t =>
        t.responsible === profile.id &&
        !["concluida", "enviado_cliente"].includes(t.status)
      );
    }
    // COORDENADOR: vê tarefas dos projetos que coordena
    // Com ou sem data — Bug 4 era causado por exigir startDate
    else if (role === "coordenador") {
      const coordinatedProjectIds = new Set(
        projects.filter(p => p.responsible === profile.id).map(p => p.id)
      );
      if (filterProject !== "all") {
        filtered = filtered.filter(t => t.projectId === filterProject);
      } else {
        filtered = filtered.filter(t =>
          coordinatedProjectIds.has(t.projectId) &&
          !["enviado_cliente", "concluida"].includes(t.status)
        );
      }
    }
    // PLANEJAMENTO / ADMIN / ADMIN_GERAL: vê todas com filtro de projeto
    else if (["planejamento", "admin", "admin_geral"].includes(role)) {
      if (filterProject !== "all") {
        filtered = filtered.filter(t => t.projectId === filterProject);
      } else {
        // Sem projeto selecionado: mostrar apenas tarefas com data definida
        // para evitar mostrar as 1000 tarefas sem data (Bug 3)
        filtered = filtered.filter(t =>
          (t.startDate || t.endDate) &&
          !["enviado_cliente", "concluida"].includes(t.status)
        );
      }
    }

    // Aplicar filtros adicionais
    if (search) filtered = filtered.filter(t =>
      t.name.toLowerCase().includes(search.toLowerCase())
    );
    if (filterDiscipline !== "all") filtered = filtered.filter(t => t.discipline === filterDiscipline);
    if (filterStatus !== "all") filtered = filtered.filter(t => t.status === filterStatus);
    if (filterStage !== "all") filtered = filtered.filter(t => t.stageName === filterStage);
    if (filterResponsible !== "all") filtered = filtered.filter(t => t.responsible === filterResponsible);

    // Ordenar: atrasadas primeiro, depois por data de término
    return filtered.sort((a, b) => {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const aOverdue = a.endDate && new Date(a.endDate) < now && !["concluida", "aprovada", "enviado_cliente"].includes(a.status);
      const bOverdue = b.endDate && new Date(b.endDate) < now && !["concluida", "aprovada", "enviado_cliente"].includes(b.status);
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;
      if (!a.endDate && !b.endDate) return 0;
      if (!a.endDate) return 1;
      if (!b.endDate) return -1;
      return a.endDate.localeCompare(b.endDate);
    });
  }, [allTasks, profile, projects, activeTimers, search, filterProject, filterDiscipline, filterStatus, filterStage, filterResponsible]);

  const handleCreate = async () => {
    if (!form.name || !form.projectId || !form.stageName || !form.responsible || !form.startDate || !form.endDate) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    const project = projects.find(p => p.id === form.projectId);
    if (!project) return;

    const { error } = await supabase.from("tasks").insert({
      name: form.name,
      project_id: form.projectId,
      discipline: project.discipline,
      stage_name: form.stageName,
      responsible: form.responsible,
      start_date: form.startDate,
      end_date: form.endDate,
      estimated_hours: Number(form.estimatedHours) || 0,
      hours_worked: 0,
      status: "nao_iniciada",
    });

    if (error) {
      toast.error("Erro ao criar tarefa: " + error.message);
      return;
    }

    setCreateOpen(false);
    setForm({ name: "", projectId: "", stageName: "", responsible: "", startDate: "", endDate: "", estimatedHours: "" });
    refetchTasks();
    toast.success("Tarefa criada com sucesso!");
  };

  const stats = useMemo(() => {
    const active = visibleTasks.filter(t => t.status === "em_andamento").length;
    const pending = visibleTasks.filter(t => t.status === "nao_iniciada").length;
    const done = visibleTasks.filter(t => t.status === "concluida").length;
    const totalEstimated = visibleTasks.reduce((s, t) => s + t.estimatedHours, 0);
    const totalWorked = visibleTasks.reduce((s, t) => s + t.hoursWorked, 0);
    return { active, pending, done, totalEstimated, totalWorked };
  }, [visibleTasks]);

  const handleTaskClick = (task: Task) => { navigate(`/tarefas/${task.id}`); };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between animate-reveal-up" style={{ animationFillMode: "backwards" }}>
          <div>
            <h1 className="text-2xl font-bold">Tarefas</h1>
            <p className="text-muted-foreground mt-1">
              {isProjetista
                ? `${visibleTasks.length} tarefa${visibleTasks.length !== 1 ? "s" : ""} atribuída${visibleTasks.length !== 1 ? "s" : ""}`
                : `${visibleTasks.length} tarefa${visibleTasks.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center border rounded-md">
              <Button variant={viewMode === "list" ? "default" : "ghost"} size="sm" className="gap-1.5 rounded-r-none" onClick={() => setViewMode("list")}>
                <List className="h-4 w-4" /> Lista
              </Button>
              <Button variant={viewMode === "calendar" ? "default" : "ghost"} size="sm" className="gap-1.5 rounded-l-none" onClick={() => setViewMode("calendar")}>
                <Calendar className="h-4 w-4" /> Calendário
              </Button>
            </div>
            {!isProjetista && (
              <Button onClick={() => setCreateOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Nova Tarefa
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-reveal-up delay-1" style={{ animationFillMode: "backwards" }}>
          {[
            { label: "Em andamento", value: stats.active, color: "text-info" },
            { label: "Não iniciadas", value: stats.pending, color: "text-muted-foreground" },
            { label: "Concluídas", value: stats.done, color: "text-success" },
            { label: "Horas", value: `${stats.totalWorked}/${stats.totalEstimated}h`, color: "" },
          ].map((kpi) => (
            <Card key={kpi.label} className="shadow-sm">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                <p className={`text-xl font-bold tabular-nums ${kpi.color}`}>{kpi.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 animate-reveal-up delay-2" style={{ animationFillMode: "backwards" }}>
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar tarefa..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <ProjectCombobox
            projects={projects}
            value={filterProject}
            onValueChange={setFilterProject}
            includeAll
            allLabel="Todos projetos"
            triggerClassName="h-10 text-sm w-[200px]"
          />
          <select value={filterDiscipline} onChange={(e) => setFilterDiscipline(e.target.value as Discipline | "all")} className="h-10 rounded-md border bg-card px-3 text-sm">
            <option value="all">Todas disciplinas</option>
            <option value="estrutural">Estrutural</option>
            <option value="hidraulica">Hidráulica</option>
            <option value="eletrica">Elétrica</option>
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as TaskStatus | "all")} className="h-10 rounded-md border bg-card px-3 text-sm">
            <option value="all">Todos status</option>
            <option value="nao_iniciada">Não iniciada</option>
            <option value="em_andamento">Em andamento</option>
            <option value="concluida">Concluída</option>
            <option value="aguardando_validacao">Aguardando Validação</option>
            <option value="aprovada">Aprovada</option>
            <option value="reprovada">Reprovada</option>
            <option value="enviado_cliente">Enviado ao Cliente</option>
          </select>
          <select value={filterStage} onChange={(e) => setFilterStage(e.target.value)} className="h-10 rounded-md border bg-card px-3 text-sm">
            <option value="all">Todas etapas</option>
            {STAGE_NAMES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {!isProjetista && (
            <select value={filterResponsible} onChange={(e) => setFilterResponsible(e.target.value)} className="h-10 rounded-md border bg-card px-3 text-sm">
              <option value="all">Todos responsáveis</option>
              {profiles.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
        </div>

        <div className="animate-reveal-up delay-3" style={{ animationFillMode: "backwards" }}>
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : viewMode === "list" ? (
            <div className="space-y-2">
              {visibleTasks.map((task) => {
                const project = projects.find(p => p.id === task.projectId);
                const responsible = getProfileById(profiles, task.responsible);
                const hoursProgress = task.estimatedHours > 0 ? Math.round((task.hoursWorked / task.estimatedHours) * 100) : 0;
                const isOverdue = parseLocalDate(task.endDate) < new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()) && !["concluida", "aprovada", "enviado_cliente"].includes(task.status);
                const taskActiveTimers = getTimerForTask(activeTimers, task.id);
                const hasActiveUsers = taskActiveTimers.length > 0;
                return (
                  <Card key={task.id} className={`shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-[0.99] ${isOverdue ? "border-destructive/40" : ""} ${hasActiveUsers ? "border-l-4 border-l-success" : ""}`} onClick={() => handleTaskClick(task)}>
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium truncate">{task.name}</p>
                            {isOverdue && <Badge variant="destructive" className="text-xs shrink-0">Atrasada</Badge>}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{project?.name}</span><span>·</span><span>{task.stageName}</span><span>·</span>
                            <span className="flex items-center gap-1"><User className="h-3 w-3" />{responsible?.name?.split(" ")[0] || "—"}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="hidden sm:flex items-center gap-2 w-28">
                            <Progress value={Math.min(hoursProgress, 100)} className={`h-1.5 flex-1 ${hoursProgress > 100 ? "[&>div]:bg-destructive" : ""}`} />
                            <span className="text-xs tabular-nums text-muted-foreground">{task.hoursWorked}/{task.estimatedHours}h</span>
                          </div>
                          {activeTimerTaskId === task.id && (
                            <span className="text-xs font-mono font-medium text-primary tabular-nums">{formatTimer(elapsed)}</span>
                          )}
                          {!["concluida", "aguardando_validacao", "aprovada"].includes(task.status) && (
                            <Button variant={activeTimerTaskId === task.id ? "destructive" : "outline"} size="icon" className="h-8 w-8 shrink-0" onClick={(e) => toggleTimer(task.id, e)}>
                              {activeTimerTaskId === task.id ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                            </Button>
                          )}
                          <div className="hidden sm:block text-xs text-muted-foreground tabular-nums w-20 text-right">
                            {formatDateBR(task.endDate)}
                          </div>
                          {(() => {
                            const hasTimer = getTimerForTask(activeTimers, task.id).length > 0;
                            if (hasTimer) return null;
                            if (task.status === "em_andamento") return <Badge className="bg-orange-100 text-orange-800 border-orange-300 shrink-0">Pausada</Badge>;
                            if (task.status === "nao_iniciada") return <Badge variant="secondary" className="shrink-0">Não iniciada</Badge>;
                            if (task.status === "aguardando_validacao") return <Badge className="bg-warning text-warning-foreground shrink-0">Aguard. Validação</Badge>;
                            if (task.status === "aprovada") return <Badge className="bg-success text-success-foreground shrink-0">Aprovada</Badge>;
                            if (task.status === "reprovada") return <Badge variant="destructive" className="shrink-0">Reprovada</Badge>;
                            if (["concluida", "enviado_cliente"].includes(task.status)) return <Badge className="bg-success text-success-foreground shrink-0">Concluída</Badge>;
                            return null;
                          })()}
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {visibleTasks.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <ListChecks className="h-8 w-8 mx-auto mb-2 opacity-50" /><p>Nenhuma tarefa encontrada.</p>
                </div>
              )}
            </div>
          ) : (
            <Card className="shadow-sm">
              <CardContent className="pt-4">
                <TaskCalendar tasks={visibleTasks} projects={projects} month={calMonth} year={calYear} onMonthChange={(m, y) => { setCalMonth(m); setCalYear(y); }} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Nova Tarefa</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome da Tarefa *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Armação de Lajes do Térreo" />
            </div>
            <div className="space-y-2">
              <Label>Projeto *</Label>
              <ProjectCombobox
                projects={projects.filter(p => p.status !== "concluido")}
                value={form.projectId}
                onValueChange={(v) => setForm({ ...form, projectId: v, responsible: "" })}
                placeholder="Selecione..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Etapa *</Label>
                <select value={form.stageName} onChange={(e) => setForm({ ...form, stageName: e.target.value })} className="h-10 w-full rounded-md border bg-card px-3 text-sm">
                  <option value="">Selecione...</option>
                  {STAGE_NAMES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Projetista Responsável *</Label>
                <select value={form.responsible} onChange={(e) => setForm({ ...form, responsible: e.target.value })} className="h-10 w-full rounded-md border bg-card px-3 text-sm">
                  <option value="">Selecione...</option>
                  {profiles.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data de Início *</Label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Data de Término *</Label>
                <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Horas Estimadas</Label>
              <Input type="number" value={form.estimatedHours} onChange={(e) => setForm({ ...form, estimatedHours: e.target.value })} placeholder="Ex: 24" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate}>Criar Tarefa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
