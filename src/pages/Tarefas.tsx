import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { tasks as initialTasks, projects, users, getUserById } from "@/data/mockData";
import { useAuth } from "@/contexts/AuthContext";
import { TaskCalendar } from "@/components/TaskCalendar";
import {
  DISCIPLINE_SHORT,
  TASK_STATUS_LABELS,
  STAGE_NAMES,
  type Discipline,
  type TaskStatus,
  type Task,
} from "@/types";
import {
  Search,
  Plus,
  Filter,
  Clock,
  CalendarDays,
  User,
  ChevronRight,
  Paperclip,
  ListChecks,
  List,
  Calendar,
  Play,
  Square,
} from "lucide-react";
import { toast } from "sonner";

const taskStatusColors: Record<TaskStatus, string> = {
  nao_iniciada: "bg-muted text-muted-foreground",
  em_andamento: "bg-info text-info-foreground",
  concluida: "bg-success text-success-foreground",
};

export default function Tarefas() {
  const { isProjetista, profile } = useAuth();
  const [allTasks, setAllTasks] = useState<Task[]>(initialTasks);
  const [activeTimerTaskId, setActiveTimerTaskId] = useState<string | null>(null);
  const [timerStart, setTimerStart] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Timer tick
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

  const toggleTimer = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeTimerTaskId === taskId) {
      // Stop timer
      const hoursWorked = elapsed / 3600;
      setAllTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, hoursWorked: Math.round((t.hoursWorked + hoursWorked) * 100) / 100, status: "em_andamento" as TaskStatus }
            : t
        )
      );
      setActiveTimerTaskId(null);
      setTimerStart(null);
      setElapsed(0);
      toast.success("Atividade registrada!");
    } else {
      // Start timer (stop any existing)
      if (activeTimerTaskId) {
        const hoursWorked = elapsed / 3600;
        setAllTasks((prev) =>
          prev.map((t) =>
            t.id === activeTimerTaskId
              ? { ...t, hoursWorked: Math.round((t.hoursWorked + hoursWorked) * 100) / 100 }
              : t
          )
        );
      }
      setActiveTimerTaskId(taskId);
      setTimerStart(new Date());
      setElapsed(0);
      setAllTasks((prev) =>
        prev.map((t) =>
          t.id === taskId && t.status === "nao_iniciada"
            ? { ...t, status: "em_andamento" as TaskStatus }
            : t
        )
      );
    }
  };
  const [search, setSearch] = useState("");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterDiscipline, setFilterDiscipline] = useState<Discipline | "all">("all");
  const [filterStatus, setFilterStatus] = useState<TaskStatus | "all">("all");
  const [filterResponsible, setFilterResponsible] = useState<string>("all");
  const [filterStage, setFilterStage] = useState<string>("all");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());

  const [form, setForm] = useState({
    name: "",
    projectId: "",
    stageName: "",
    responsible: "",
    startDate: "",
    endDate: "",
    estimatedHours: "",
  });

  const visibleTasks = useMemo(() => {
    let filtered = allTasks;

    // Projetista can only see their own tasks (mock: match by name email pattern)
    if (isProjetista) {
      // In mock mode, filter by any user - the projetista filter will apply when connected to real data
      // For now, we use the filterResponsible to allow testing
    }

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          projects.find((p) => p.id === t.projectId)?.name.toLowerCase().includes(q)
      );
    }
    if (filterProject !== "all") filtered = filtered.filter((t) => t.projectId === filterProject);
    if (filterDiscipline !== "all") filtered = filtered.filter((t) => t.discipline === filterDiscipline);
    if (filterStatus !== "all") filtered = filtered.filter((t) => t.status === filterStatus);
    if (filterResponsible !== "all") filtered = filtered.filter((t) => t.responsible === filterResponsible);
    if (filterStage !== "all") filtered = filtered.filter((t) => t.stageName === filterStage);

    const statusOrder: Record<string, number> = { em_andamento: 0, nao_iniciada: 1, concluida: 2 };
    return filtered.sort((a, b) => {
      const so = (statusOrder[a.status] ?? 1) - (statusOrder[b.status] ?? 1);
      if (so !== 0) return so;
      return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
    });
  }, [allTasks, search, filterProject, filterDiscipline, filterStatus, filterResponsible, filterStage, isProjetista]);

  const selectedProject = projects.find((p) => p.id === form.projectId);
  const formUsers = selectedProject
    ? users.filter((u) => selectedProject.team.includes(u.id))
    : [];

  const handleCreate = () => {
    if (!form.name || !form.projectId || !form.stageName || !form.responsible || !form.startDate || !form.endDate) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    const project = projects.find((p) => p.id === form.projectId);
    if (!project) return;

    const newTask: Task = {
      id: `t${Date.now()}`,
      name: form.name,
      projectId: form.projectId,
      discipline: project.discipline,
      stageName: form.stageName,
      responsible: form.responsible,
      startDate: form.startDate,
      endDate: form.endDate,
      estimatedHours: Number(form.estimatedHours) || 0,
      hoursWorked: 0,
      status: "nao_iniciada",
      attachments: [],
    };

    setAllTasks((prev) => [newTask, ...prev]);
    setCreateOpen(false);
    setForm({ name: "", projectId: "", stageName: "", responsible: "", startDate: "", endDate: "", estimatedHours: "" });
    toast.success("Tarefa criada com sucesso!");
  };

  const stats = useMemo(() => {
    const active = visibleTasks.filter((t) => t.status === "em_andamento").length;
    const pending = visibleTasks.filter((t) => t.status === "nao_iniciada").length;
    const done = visibleTasks.filter((t) => t.status === "concluida").length;
    const totalEstimated = visibleTasks.reduce((s, t) => s + t.estimatedHours, 0);
    const totalWorked = visibleTasks.reduce((s, t) => s + t.hoursWorked, 0);
    return { active, pending, done, totalEstimated, totalWorked };
  }, [visibleTasks]);

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setDialogOpen(true);
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between animate-reveal-up" style={{ animationFillMode: "backwards" }}>
          <div>
            <h1 className="text-2xl font-bold">Tarefas</h1>
            <p className="text-muted-foreground mt-1">
              {visibleTasks.length} tarefa{visibleTasks.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex items-center border rounded-md">
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                className="gap-1.5 rounded-r-none"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" /> Lista
              </Button>
              <Button
                variant={viewMode === "calendar" ? "default" : "ghost"}
                size="sm"
                className="gap-1.5 rounded-l-none"
                onClick={() => setViewMode("calendar")}
              >
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

        {/* KPIs */}
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

        {/* Filters */}
        <div className="flex flex-wrap gap-3 animate-reveal-up delay-2" style={{ animationFillMode: "backwards" }}>
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar tarefa..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)} className="h-10 rounded-md border bg-card px-3 text-sm">
            <option value="all">Todos projetos</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
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
          </select>
          <select value={filterStage} onChange={(e) => setFilterStage(e.target.value)} className="h-10 rounded-md border bg-card px-3 text-sm">
            <option value="all">Todas etapas</option>
            {STAGE_NAMES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {!isProjetista && (
            <select value={filterResponsible} onChange={(e) => setFilterResponsible(e.target.value)} className="h-10 rounded-md border bg-card px-3 text-sm">
              <option value="all">Todos responsáveis</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Content area */}
        <div className="animate-reveal-up delay-3" style={{ animationFillMode: "backwards" }}>
          {viewMode === "list" ? (
            /* Task list */
            <div className="space-y-2">
              {visibleTasks.map((task) => {
                const project = projects.find((p) => p.id === task.projectId);
                const responsible = getUserById(task.responsible);
                const hoursProgress = task.estimatedHours > 0 ? Math.round((task.hoursWorked / task.estimatedHours) * 100) : 0;
                const isOverdue = new Date(task.endDate) < new Date() && task.status !== "concluida";

                return (
                  <Card
                    key={task.id}
                    className={`shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-[0.99] ${isOverdue ? "border-destructive/40" : ""}`}
                    onClick={() => handleTaskClick(task)}
                  >
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium truncate">{task.name}</p>
                            {isOverdue && <Badge variant="destructive" className="text-xs shrink-0">Atrasada</Badge>}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{project?.name}</span>
                            <span>·</span>
                            <span>{task.stageName}</span>
                            <span>·</span>
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {responsible?.name.split(" ")[0]}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="hidden sm:flex items-center gap-2 w-28">
                            <Progress value={Math.min(hoursProgress, 100)} className={`h-1.5 flex-1 ${hoursProgress > 100 ? "[&>div]:bg-destructive" : ""}`} />
                            <span className="text-xs tabular-nums text-muted-foreground">{task.hoursWorked}/{task.estimatedHours}h</span>
                          </div>
                          {activeTimerTaskId === task.id && (
                            <span className="text-xs font-mono font-medium text-primary tabular-nums">
                              {formatTimer(elapsed)}
                            </span>
                          )}
                          {task.status !== "concluida" && (
                            <Button
                              variant={activeTimerTaskId === task.id ? "destructive" : "outline"}
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              onClick={(e) => toggleTimer(task.id, e)}
                              title={activeTimerTaskId === task.id ? "Parar atividade" : "Iniciar atividade"}
                            >
                              {activeTimerTaskId === task.id ? (
                                <Square className="h-3.5 w-3.5" />
                              ) : (
                                <Play className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          )}
                          <div className="hidden sm:block text-xs text-muted-foreground tabular-nums w-20 text-right">
                            {new Date(task.endDate).toLocaleDateString("pt-BR")}
                          </div>
                          <Badge variant="secondary" className={`${taskStatusColors[task.status]} shrink-0`}>
                            {TASK_STATUS_LABELS[task.status]}
                          </Badge>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {visibleTasks.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <ListChecks className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma tarefa encontrada.</p>
                </div>
              )}
            </div>
          ) : (
            /* Calendar view */
            <Card className="shadow-sm">
              <CardContent className="pt-4">
                <TaskCalendar
                  tasks={visibleTasks}
                  month={calMonth}
                  year={calYear}
                  onMonthChange={(m, y) => { setCalMonth(m); setCalYear(y); }}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Task detail dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          {selectedTask && (() => {
            const project = projects.find((p) => p.id === selectedTask.projectId);
            const responsible = getUserById(selectedTask.responsible);
            const hoursProgress = selectedTask.estimatedHours > 0
              ? Math.round((selectedTask.hoursWorked / selectedTask.estimatedHours) * 100)
              : 0;

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="text-lg">{selectedTask.name}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Projeto</p>
                      <p className="font-medium">{project?.name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Disciplina</p>
                      <p className="font-medium">{DISCIPLINE_SHORT[selectedTask.discipline]}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Etapa</p>
                      <p className="font-medium">{selectedTask.stageName}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Responsável</p>
                      <p className="font-medium">{responsible?.name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Início</p>
                      <p className="font-medium tabular-nums">{new Date(selectedTask.startDate).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Término</p>
                      <p className="font-medium tabular-nums">{new Date(selectedTask.endDate).toLocaleDateString("pt-BR")}</p>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Progresso de horas</span>
                      <span className={`font-medium tabular-nums ${hoursProgress > 100 ? "text-destructive" : ""}`}>
                        {selectedTask.hoursWorked}h / {selectedTask.estimatedHours}h ({hoursProgress}%)
                      </span>
                    </div>
                    <Progress value={Math.min(hoursProgress, 100)} className={`h-2 ${hoursProgress > 100 ? "[&>div]:bg-destructive" : ""}`} />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    <Badge variant="secondary" className={taskStatusColors[selectedTask.status]}>
                      {TASK_STATUS_LABELS[selectedTask.status]}
                    </Badge>
                  </div>

                  {/* Attachments section */}
                  <div className="border-t pt-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Paperclip className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Arquivos Anexos</span>
                    </div>
                    {selectedTask.attachments.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum arquivo anexado.</p>
                    ) : (
                      <div className="space-y-1">
                        {selectedTask.attachments.map((a) => (
                          <div key={a.id} className="flex items-center justify-between p-2 rounded border text-sm">
                            <span>{a.name}</span>
                            <Button variant="ghost" size="sm">Download</Button>
                          </div>
                        ))}
                      </div>
                    )}
                    <Button variant="outline" size="sm" className="mt-2 gap-1">
                      <Paperclip className="h-3 w-3" /> Anexar arquivo
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Create task dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Tarefa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome da Tarefa *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Armação de Lajes do Térreo" />
            </div>
            <div className="space-y-2">
              <Label>Projeto *</Label>
              <select
                value={form.projectId}
                onChange={(e) => setForm({ ...form, projectId: e.target.value, responsible: "" })}
                className="h-10 w-full rounded-md border bg-card px-3 text-sm"
              >
                <option value="">Selecione...</option>
                {projects.filter((p) => p.status !== "concluido").map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Etapa *</Label>
                <select
                  value={form.stageName}
                  onChange={(e) => setForm({ ...form, stageName: e.target.value })}
                  className="h-10 w-full rounded-md border bg-card px-3 text-sm"
                >
                  <option value="">Selecione...</option>
                  {STAGE_NAMES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Responsável *</Label>
                <select
                  value={form.responsible}
                  onChange={(e) => setForm({ ...form, responsible: e.target.value })}
                  className="h-10 w-full rounded-md border bg-card px-3 text-sm"
                  disabled={!form.projectId}
                >
                  <option value="">Selecione...</option>
                  {formUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
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
