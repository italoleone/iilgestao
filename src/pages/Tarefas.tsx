import { useState, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { tasks as initialTasks, projects, users, getUserById, currentUser } from "@/data/mockData";
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
} from "lucide-react";
import { toast } from "sonner";

const taskStatusColors: Record<TaskStatus, string> = {
  nao_iniciada: "bg-muted text-muted-foreground",
  em_andamento: "bg-info text-info-foreground",
  concluida: "bg-success text-success-foreground",
};

export default function Tarefas() {
  const [allTasks, setAllTasks] = useState<Task[]>(initialTasks);
  const [search, setSearch] = useState("");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterDiscipline, setFilterDiscipline] = useState<Discipline | "all">("all");
  const [filterStatus, setFilterStatus] = useState<TaskStatus | "all">("all");
  const [filterResponsible, setFilterResponsible] = useState<string>("all");
  const [filterStage, setFilterStage] = useState<string>("all");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const [form, setForm] = useState({
    name: "",
    projectId: "",
    stageName: "",
    responsible: "",
    startDate: "",
    endDate: "",
    estimatedHours: "",
  });

  // Visibility: projetista sees only their tasks
  const isProjetista = currentUser.role === "projetista";

  const visibleTasks = useMemo(() => {
    let filtered = allTasks;
    if (isProjetista) {
      filtered = filtered.filter((t) => t.responsible === currentUser.id);
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

    // Sort by deadline
    return filtered.sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());
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
          {!isProjetista && (
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Nova Tarefa
            </Button>
          )}
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

        {/* Task list */}
        <div className="space-y-2 animate-reveal-up delay-3" style={{ animationFillMode: "backwards" }}>
          {visibleTasks.map((task) => {
            const project = projects.find((p) => p.id === task.projectId);
            const responsible = getUserById(task.responsible);
            const hoursProgress = task.estimatedHours > 0 ? Math.round((task.hoursWorked / task.estimatedHours) * 100) : 0;
            const isOverdue = new Date(task.endDate) < new Date() && task.status !== "concluida";

            return (
              <Card
                key={task.id}
                className={`shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-[0.99] ${isOverdue ? "border-destructive/40" : ""}`}
                onClick={() => {
                  setSelectedTask(task);
                  setDialogOpen(true);
                }}
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

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="hidden sm:flex items-center gap-2 w-28">
                        <Progress value={Math.min(hoursProgress, 100)} className={`h-1.5 flex-1 ${hoursProgress > 100 ? "[&>div]:bg-destructive" : ""}`} />
                        <span className="text-xs tabular-nums text-muted-foreground">{task.hoursWorked}/{task.estimatedHours}h</span>
                      </div>
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
