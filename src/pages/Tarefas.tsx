import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { ProjectCombobox } from "@/components/ProjectCombobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveTimers, startActiveTimer, stopActiveTimer, getTimerForTask } from "@/hooks/useActiveTimers";
import { STAGE_NAMES } from "@/types";
import {
  Search, Plus, ChevronRight, Play, Square, Loader2, ListChecks,
  Clock, User, CalendarDays,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TaskStatus =
  | "nao_iniciada"
  | "em_andamento"
  | "pausada"
  | "aguardando_validacao"
  | "aprovada"
  | "reprovada"
  | "concluida"
  | "enviado_cliente";

export interface Task {
  id: string;
  name: string;
  project_id: string;
  discipline: string;
  stage_name: string;
  responsible: string;
  start_date: string;
  end_date: string;
  estimated_hours: number;
  hours_worked: number;
  status: TaskStatus;
  rejection_reason: string | null;
  created_at: string;
}

interface Profile {
  id: string;
  name: string;
  role: string;
  status: string;
}

interface Project {
  id: string;
  name: string;
  discipline: string;
  responsible: string; // coordenador do projeto
  status: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<TaskStatus, string> = {
  nao_iniciada: "Não iniciada",
  em_andamento: "Em andamento",
  pausada: "Pausada",
  aguardando_validacao: "Aguard. Validação",
  aprovada: "Aprovada",
  reprovada: "Reprovada",
  concluida: "Concluída",
  enviado_cliente: "Enviado ao Cliente",
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  nao_iniciada: "bg-slate-100 text-slate-600 border-slate-200",
  em_andamento: "bg-blue-100 text-blue-700 border-blue-200",
  pausada: "bg-orange-100 text-orange-700 border-orange-200",
  aguardando_validacao: "bg-yellow-100 text-yellow-700 border-yellow-200",
  aprovada: "bg-green-100 text-green-700 border-green-200",
  reprovada: "bg-red-100 text-red-700 border-red-200",
  concluida: "bg-emerald-100 text-emerald-700 border-emerald-200",
  enviado_cliente: "bg-purple-100 text-purple-700 border-purple-200",
};

// Roles que podem criar/editar/excluir tarefas
const CAN_MANAGE = ["admin_geral", "admin", "coordenador", "planejamento"];

function canManageTasks(role: string) {
  return CAN_MANAGE.includes(role);
}

function parseLocalDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDateBR(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = parseLocalDate(dateStr);
  if (!d) return "—";
  return d.toLocaleDateString("pt-BR");
}

function isOverdue(task: Task): boolean {
  const end = parseLocalDate(task.end_date);
  if (!end) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return end < today && !["concluida", "aprovada", "enviado_cliente"].includes(task.status);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Tarefas() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { activeTimers, loaded: timersLoaded } = useActiveTimers();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // Timer state
  const [activeTimerTaskId, setActiveTimerTaskId] = useState<string | null>(null);
  const [timerStart, setTimerStart] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Filters
  const [search, setSearch] = useState("");
  const [filterProject, setFilterProject] = useState("all");
  const [filterStatus, setFilterStatus] = useState<TaskStatus | "all">("all");
  const [filterStage, setFilterStage] = useState("all");

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", project_id: "", stage_name: "", responsible: "",
    start_date: "", end_date: "", estimated_hours: "",
  });
  const [saving, setSaving] = useState(false);

  // ─── Data fetching ───────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [tasksRes, projectsRes, profilesRes] = await Promise.all([
      supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("projects").select("id, name, discipline, responsible, status").order("name"),
      supabase.from("profiles").select("id, name, status").eq("status", "active").order("name"),
    ]);
    if (tasksRes.data) setTasks(tasksRes.data as Task[]);
    if (projectsRes.data) setProjects(projectsRes.data as Project[]);
    if (profilesRes.data) setProfiles(profilesRes.data as Profile[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();

    // Realtime subscription
    const channel = supabase
      .channel(`tasks-realtime-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
        fetchAll();
      })
      .subscribe();

    const interval = setInterval(fetchAll, 60000);
    const onVisibility = () => { if (document.visibilityState === "visible") fetchAll(); };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchAll]);

  // ─── Timer sync ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!profile || !timersLoaded) return;
    const myTimer = activeTimers.find(t => t.user_id === profile.id);
    if (myTimer) {
      setActiveTimerTaskId(myTimer.task_id);
      const startedAt = new Date(myTimer.started_at);
      setTimerStart(startedAt);
      setElapsed(Math.floor((Date.now() - startedAt.getTime()) / 1000));
    } else if (activeTimerTaskId) {
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

  const formatTimer = (s: number) => {
    const h = Math.floor(s / 3600).toString().padStart(2, "0");
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${h}:${m}:${sec}`;
  };

  // ─── Filtered tasks (sem filtro que some tarefa por data) ────────────────
  // Regra: só aparece tarefa que tem start_date E end_date definidos.
  // O filtro por papel é feito aqui, sem nenhuma lógica extra que possa
  // esconder tarefas de forma inesperada.

  const visibleTasks = useMemo(() => {
    if (!profile) return [];
    const role = profile.role;

    // 1. Para projetista: mostrar todas as tarefas atribuídas, independente de datas.
    //    Para os demais papéis: manter regra de exigir start_date e end_date.
    let filtered = role === "projetista"
      ? tasks
      : tasks.filter(t => t.start_date && t.end_date);

    // 2. Filtro por papel
    if (role === "projetista") {
      // Projetista só vê as próprias tarefas, exceto as já finalizadas
      filtered = filtered.filter(t =>
        t.responsible === profile.id &&
        !["concluida", "enviado_cliente"].includes(t.status)
      );
    } else if (role === "coordenador") {
      // Coordenador vê tarefas dos projetos onde ele é o responsible
      const myProjectIds = new Set(
        projects.filter(p => p.responsible === profile.id).map(p => p.id)
      );
      if (filterProject !== "all") {
        filtered = filtered.filter(t => t.project_id === filterProject);
      } else {
        filtered = filtered.filter(t =>
          myProjectIds.has(t.project_id) &&
          !["concluida", "enviado_cliente"].includes(t.status)
        );
      }
    } else {
      // Diretor, Gerente, Planejamento — veem tudo (exceto finalizadas na visão padrão)
      if (filterProject !== "all") {
        filtered = filtered.filter(t => t.project_id === filterProject);
      } else {
        filtered = filtered.filter(t =>
          !["concluida", "enviado_cliente"].includes(t.status)
        );
      }
    }

    // 3. Filtros adicionais da UI
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(t => t.name.toLowerCase().includes(s));
    }
    if (filterStatus !== "all") filtered = filtered.filter(t => t.status === filterStatus);
    if (filterStage !== "all") filtered = filtered.filter(t => t.stage_name === filterStage);

    // 4. Ordenação: atrasadas primeiro, depois por end_date
    return filtered.sort((a, b) => {
      const aLate = isOverdue(a);
      const bLate = isOverdue(b);
      if (aLate && !bLate) return -1;
      if (!aLate && bLate) return 1;
      return (a.end_date || "").localeCompare(b.end_date || "");
    });
  }, [tasks, profile, projects, search, filterProject, filterStatus, filterStage]);

  // ─── Create task ─────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!form.name.trim() || !form.project_id || !form.stage_name ||
      !form.responsible || !form.start_date || !form.end_date) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    if (form.start_date > form.end_date) {
      toast.error("A data de início não pode ser maior que a data de fim.");
      return;
    }
    setSaving(true);
    const project = projects.find(p => p.id === form.project_id);
    const { error } = await supabase.from("tasks").insert({
      name: form.name.trim(),
      project_id: form.project_id,
      discipline: project?.discipline || "estrutural",
      stage_name: form.stage_name,
      responsible: form.responsible,
      start_date: form.start_date,
      end_date: form.end_date,
      estimated_hours: Number(form.estimated_hours) || 0,
      hours_worked: 0,
      status: "nao_iniciada",
    });
    setSaving(false);
    if (error) {
      toast.error("Erro ao criar tarefa: " + error.message);
      return;
    }
    setCreateOpen(false);
    setForm({ name: "", project_id: "", stage_name: "", responsible: "", start_date: "", end_date: "", estimated_hours: "" });
    fetchAll();
    toast.success("Tarefa criada com sucesso!");
  };

  // ─── Timer toggle ────────────────────────────────────────────────────────

  const toggleTimer = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!profile) return;

    if (activeTimerTaskId === taskId && timerStart) {
      // Parar timer → status vira "pausada"
      try {
        const result = await stopActiveTimer();
        if (result.stopped) {
          // Atualiza status para "pausada" se estava em_andamento
          await supabase.from("tasks")
            .update({ status: "pausada" })
            .eq("id", taskId)
            .eq("status", "em_andamento");
          setActiveTimerTaskId(null);
          setTimerStart(null);
          setElapsed(0);
          fetchAll();
          toast.success("Timer parado. Tarefa pausada.");
        }
      } catch (err: any) {
        toast.error("Erro ao parar timer: " + err.message);
      }
    } else {
      // Iniciar timer → status vira "em_andamento"
      try {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;
        await startActiveTimer(taskId, task.project_id);
        // Atualiza status para "em_andamento"
        await supabase.from("tasks")
          .update({ status: "em_andamento" })
          .eq("id", taskId)
          .in("status", ["nao_iniciada", "pausada", "reprovada"]);
        setActiveTimerTaskId(taskId);
        setTimerStart(new Date());
        setElapsed(0);
        fetchAll();
      } catch (err: any) {
        toast.error("Erro ao iniciar timer: " + err.message);
      }
    }
  };

  // ─── Helpers ─────────────────────────────────────────────────────────────

  const getProject = (id: string) => projects.find(p => p.id === id);
  const getProfile = (id: string) => profiles.find(p => p.id === id);
  const role = profile?.role || "";
  const canCreate = canManageTasks(role);

  // Stats
  const stats = useMemo(() => ({
    emAndamento: visibleTasks.filter(t => t.status === "em_andamento").length,
    naoIniciadas: visibleTasks.filter(t => t.status === "nao_iniciada").length,
    aguardando: visibleTasks.filter(t => t.status === "aguardando_validacao").length,
    atrasadas: visibleTasks.filter(t => isOverdue(t)).length,
  }), [visibleTasks]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Tarefas</h1>
            <p className="text-muted-foreground mt-1">
              {visibleTasks.length} tarefa{visibleTasks.length !== 1 ? "s" : ""}
            </p>
          </div>
          {canCreate && (
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Nova Tarefa
            </Button>
          )}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Em andamento", value: stats.emAndamento, color: "text-blue-600" },
            { label: "Não iniciadas", value: stats.naoIniciadas, color: "text-slate-500" },
            { label: "Aguard. validação", value: stats.aguardando, color: "text-yellow-600" },
            { label: "Atrasadas", value: stats.atrasadas, color: "text-red-600" },
          ].map(kpi => (
            <Card key={kpi.label} className="shadow-sm">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                <p className={`text-2xl font-bold tabular-nums ${kpi.color}`}>{kpi.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar tarefa..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {role !== "projetista" && (
            <ProjectCombobox
              projects={projects.filter(p => p.status !== "concluido")}
              value={filterProject}
              onValueChange={setFilterProject}
              includeAll
              allLabel="Todos os projetos"
              triggerClassName="h-10 text-sm w-[200px]"
            />
          )}

          <select
            value={filterStage}
            onChange={e => setFilterStage(e.target.value)}
            className="h-10 rounded-md border bg-card px-3 text-sm"
          >
            <option value="all">Todas as etapas</option>
            {STAGE_NAMES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as TaskStatus | "all")}
            className="h-10 rounded-md border bg-card px-3 text-sm"
          >
            <option value="all">Todos os status</option>
            {(Object.keys(STATUS_LABELS) as TaskStatus[]).map(s => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>

        {/* Task List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : visibleTasks.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <ListChecks className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Nenhuma tarefa encontrada.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleTasks.map(task => {
              const project = getProject(task.project_id);
              const responsible = getProfile(task.responsible);
              const overdue = isOverdue(task);
              const hasActiveTimer = getTimerForTask(activeTimers, task.id).length > 0;
              const isMyTimer = activeTimerTaskId === task.id;
              const canPlayTimer = role === "projetista" &&
                ["nao_iniciada", "pausada", "reprovada", "em_andamento"].includes(task.status);

              return (
                <Card
                  key={task.id}
                  className={[
                    "shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-[0.99]",
                    overdue ? "border-red-300" : "",
                    hasActiveTimer ? "border-l-4 border-l-green-500" : "",
                  ].join(" ")}
                  onClick={() => navigate(`/tarefas/${task.id}`)}
                >
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium truncate">{task.name}</p>
                          {overdue && (
                            <Badge variant="destructive" className="text-xs shrink-0">Atrasada</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            {project?.name || "—"}
                          </span>
                          <span>·</span>
                          <span>{task.stage_name}</span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {responsible?.name?.split(" ")[0] || "—"}
                          </span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {formatDateBR(task.end_date)}
                          </span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {task.hours_worked}/{task.estimated_hours}h
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {isMyTimer && (
                          <span className="text-xs font-mono font-bold text-blue-600 tabular-nums">
                            {formatTimer(elapsed)}
                          </span>
                        )}

                        {canPlayTimer && (
                          <Button
                            variant={isMyTimer ? "destructive" : "outline"}
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={e => toggleTimer(task.id, e)}
                          >
                            {isMyTimer
                              ? <Square className="h-3.5 w-3.5" />
                              : <Play className="h-3.5 w-3.5" />}
                          </Button>
                        )}

                        <Badge className={`text-xs border shrink-0 ${STATUS_COLORS[task.status]}`}>
                          {STATUS_LABELS[task.status]}
                        </Badge>

                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Task Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Tarefa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome da Tarefa *</Label>
              <Input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Elaboração das Formas – Térreo"
              />
            </div>

            <div className="space-y-2">
              <Label>Projeto *</Label>
              <ProjectCombobox
                projects={projects.filter(p => p.status !== "concluido")}
                value={form.project_id}
                onValueChange={v => setForm({ ...form, project_id: v, responsible: "" })}
                placeholder="Selecione o projeto..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Etapa *</Label>
                <select
                  value={form.stage_name}
                  onChange={e => setForm({ ...form, stage_name: e.target.value })}
                  className="h-10 w-full rounded-md border bg-card px-3 text-sm"
                >
                  <option value="">Selecione...</option>
                  {STAGE_NAMES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Projetista Responsável *</Label>
                <select
                  value={form.responsible}
                  onChange={e => setForm({ ...form, responsible: e.target.value })}
                  className="h-10 w-full rounded-md border bg-card px-3 text-sm"
                >
                  <option value="">Selecione...</option>
                  {profiles.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data de Início *</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={e => setForm({ ...form, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Data de Término *</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  min={form.start_date}
                  onChange={e => setForm({ ...form, end_date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Horas Estimadas</Label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={form.estimated_hours}
                onChange={e => setForm({ ...form, estimated_hours: e.target.value })}
                placeholder="Ex: 24"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Criar Tarefa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
