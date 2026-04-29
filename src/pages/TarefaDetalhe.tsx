import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { ProjectCombobox } from "@/components/ProjectCombobox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useActiveTimers, startActiveTimer, stopActiveTimer } from "@/hooks/useActiveTimers";
import { useTimeEntries } from "@/hooks/useSupabaseData";
import { useAuth } from "@/contexts/AuthContext";
import { STAGE_NAMES } from "@/types";
import {
  ArrowLeft, Play, Square, Clock, User, CalendarDays,
  Loader2, Trash2, Pencil, Send, ThumbsUp, ThumbsDown,
  CheckCircle2, AlertTriangle, History, XCircle,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type TaskStatus =
  | "nao_iniciada"
  | "em_andamento"
  | "pausada"
  | "aguardando_validacao"
  | "aprovada"
  | "reprovada"
  | "concluida"
  | "enviado_cliente";

interface Task {
  id: string;
  name: string;
  project_id: string;
  discipline: string;
  stage_name: string;
  responsible: string;
  start_date: string | null;
  end_date: string | null;
  estimated_hours: number;
  hours_worked: number;
  status: TaskStatus;
  rejection_reason: string | null;
  created_at: string;
}

interface Project {
  id: string;
  name: string;
  client: string;
  discipline: string;
  responsible: string; // coordenador
}

interface Profile {
  id: string;
  name: string;
  cost_per_hour: number | null;
  status: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<TaskStatus, string> = {
  nao_iniciada: "Não iniciada",
  em_andamento: "Em andamento",
  pausada: "Pausada",
  aguardando_validacao: "Aguardando Validação",
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

const CAN_MANAGE = ["admin_geral", "admin", "coordenador", "planejamento"];

function formatDateBR(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR");
}

function parseLocalDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function isOverdue(task: Task): boolean {
  const end = parseLocalDate(task.end_date);
  if (!end) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return end < today && !["concluida", "enviado_cliente", "aprovada", "cancelada"].includes(task.status);
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  return m > 0 ? `${h}h ${m.toString().padStart(2, "0")}min` : `${h}h`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TarefaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, canAccessFinanceiro } = useAuth();
  const { activeTimers, loaded: timersLoaded } = useActiveTimers();
  const { entries: timeEntries, refetch: refetchEntries } = useTimeEntries(id);
  const timerRestoredRef = useRef(false);

  const [task, setTask] = useState<Task | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Timer state
  const [timerStart, setTimerStart] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Dialog states
  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState<Partial<Task>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // ─── Fetch data ────────────────────────────────────────────────────────

  const fetchTask = async () => {
    if (!id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("tasks").select("*").eq("id", id).maybeSingle();
    if (error || !data) {
      setTask(null);
      setLoading(false);
      return;
    }
    const t = data as Task;
    setTask(t);
    const { data: proj } = await supabase
      .from("projects")
      .select("id, name, client, discipline, responsible")
      .eq("id", t.project_id)
      .maybeSingle();
    if (proj) setProject(proj as Project);
    setLoading(false);
  };

  useEffect(() => {
    fetchTask();
    supabase.from("profiles").select("id, name, cost_per_hour, status")
      .eq("status", "active").order("name")
      .then(({ data }) => { if (data) setProfiles(data as Profile[]); });
    supabase.from("projects").select("id, name, client, discipline, responsible")
      .order("name")
      .then(({ data }) => { if (data) setAllProjects(data as Project[]); });
  }, [id]);

  // ─── Timer sync ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!profile || !id || !timersLoaded) return;
    const myTimer = activeTimers.find(t => t.user_id === profile.id && t.task_id === id);
    if (myTimer) {
      const startedAt = new Date(myTimer.started_at);
      setTimerStart(startedAt);
      setElapsed(Math.floor((Date.now() - startedAt.getTime()) / 1000));
      timerRestoredRef.current = true;
    } else if (timerRestoredRef.current) {
      setTimerStart(null);
      setElapsed(0);
    }
  }, [activeTimers, profile, id, timersLoaded]);

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

  // ─── Computed permissions ──────────────────────────────────────────────

  const role = profile?.role || "";
  const canManage = CAN_MANAGE.includes(role);
  const isProjetista = role === "projetista";
  const isTaskResponsible = task?.responsible === profile?.id;
  // Coordenador do projeto = quem está em projects.responsible (independente do role).
  // Planejamento NÃO valida tarefas — apenas acompanha.
  // Admin e Diretor (admin_geral) podem validar qualquer tarefa como exceção.
  const isProjectCoordinator = !!project?.responsible && project?.responsible === profile?.id;
  const canValidate = isProjectCoordinator || role === "admin_geral" || role === "admin";

  // O que cada status permite
  const canPlay = isTaskResponsible &&
    ["nao_iniciada", "pausada", "reprovada", "em_andamento"].includes(task?.status || "");
  const canSendValidation = isTaskResponsible && task?.status === "pausada";
  const canApproveReject = canValidate && task?.status === "aguardando_validacao";
  const canMarkConcluida = isTaskResponsible && task?.status === "aprovada";
  const canSendToClient = isTaskResponsible && task?.status === "concluida";

  // ─── Actions ───────────────────────────────────────────────────────────

  const toggleTimer = async () => {
    if (!task || !profile) return;
    if (timerStart) {
      // Parar → status "pausada"
      try {
        const result = await stopActiveTimer();
        if (result.stopped) {
          const { error } = await supabase.from("tasks")
            .update({ status: "pausada" })
            .eq("id", task.id)
            .eq("status", "em_andamento");
          if (error) { toast.error("Erro ao atualizar status: " + error.message); return; }
          setTask(prev => prev ? { ...prev, status: "pausada", hours_worked: result.new_hours_worked ?? prev.hours_worked } : prev);
          setTimerStart(null);
          setElapsed(0);
          timerRestoredRef.current = false;
          refetchEntries();
          toast.success("Timer parado. Tarefa pausada.");
        }
      } catch (err: any) {
        toast.error("Erro ao parar timer: " + err.message);
      }
    } else {
      // Iniciar → status "em_andamento"
      try {
        await startActiveTimer(task.id, task.project_id);
        const { error } = await supabase.from("tasks")
          .update({ status: "em_andamento" })
          .eq("id", task.id)
          .in("status", ["nao_iniciada", "pausada", "reprovada"]);
        if (error) { toast.error("Erro ao atualizar status: " + error.message); return; }
        setTask(prev => prev ? { ...prev, status: "em_andamento" } : prev);
        setTimerStart(new Date());
        setElapsed(0);
        toast.success("Timer iniciado!");
      } catch (err: any) {
        toast.error("Erro ao iniciar timer: " + err.message);
      }
    }
  };

  const handleSendForValidation = async () => {
    if (!task) return;
    const { error } = await supabase.from("tasks")
      .update({ status: "aguardando_validacao" })
      .eq("id", task.id);
    if (error) { toast.error("Erro: " + error.message); return; }
    setTask(prev => prev ? { ...prev, status: "aguardando_validacao" } : prev);
    toast.success("Tarefa enviada para validação do coordenador!");
    navigate("/tarefas");
  };

  const handleApprove = async () => {
    if (!task) return;
    const { error } = await supabase.from("tasks")
      .update({ status: "aprovada", rejection_reason: null })
      .eq("id", task.id);
    if (error) { toast.error("Erro ao aprovar: " + error.message); return; }
    setTask(prev => prev ? { ...prev, status: "aprovada", rejection_reason: null } : prev);
    toast.success("Tarefa aprovada!");
    navigate("/tarefas");
  };

  const handleReject = async () => {
    if (!task || !rejectReason.trim()) {
      toast.error("Informe o motivo da reprovação.");
      return;
    }
    const { error } = await supabase.from("tasks")
      .update({ status: "reprovada", rejection_reason: rejectReason.trim() })
      .eq("id", task.id);
    if (error) { toast.error("Erro ao reprovar: " + error.message); return; }
    setTask(prev => prev ? { ...prev, status: "reprovada", rejection_reason: rejectReason.trim() } : prev);
    setRejectOpen(false);
    setRejectReason("");
    toast.success("Tarefa reprovada. O projetista será notificado.");
    navigate("/tarefas");
  };

  const handleMarkConcluida = async () => {
    if (!task) return;
    const { error } = await supabase.from("tasks")
      .update({ status: "concluida" })
      .eq("id", task.id);
    if (error) { toast.error("Erro: " + error.message); return; }
    setTask(prev => prev ? { ...prev, status: "concluida" } : prev);
    toast.success("Tarefa marcada como concluída!");
  };

  const handleSendToClient = async () => {
    if (!task) return;
    const { error } = await supabase.from("tasks")
      .update({ status: "enviado_cliente" })
      .eq("id", task.id);
    if (error) { toast.error("Erro: " + error.message); return; }
    setTask(prev => prev ? { ...prev, status: "enviado_cliente" } : prev);
    toast.success("Tarefa marcada como enviada ao cliente!");
    navigate("/tarefas");
  };

  const handleDeleteTask = async () => {
    if (!task) return;
    setDeleting(true);
    const { error } = await supabase.from("tasks").delete().eq("id", task.id);
    setDeleting(false);
    if (error) { toast.error("Erro ao excluir: " + error.message); return; }
    toast.success("Tarefa excluída.");
    navigate("/tarefas");
  };

  const openEdit = () => {
    if (!task) return;
    setEditData({
      name: task.name,
      project_id: task.project_id,
      stage_name: task.stage_name,
      responsible: task.responsible,
      start_date: task.start_date || "",
      end_date: task.end_date || "",
      estimated_hours: task.estimated_hours,
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!task) return;
    if (!editData.name?.trim()) { toast.error("Nome é obrigatório."); return; }
    if (!editData.start_date || !editData.end_date) {
      toast.error("Datas de início e término são obrigatórias.");
      return;
    }
    if (editData.start_date > editData.end_date) {
      toast.error("A data de início não pode ser maior que a de término.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("tasks").update({
      name: editData.name,
      project_id: editData.project_id,
      stage_name: editData.stage_name,
      responsible: editData.responsible,
      start_date: editData.start_date,
      end_date: editData.end_date,
      estimated_hours: editData.estimated_hours,
    }).eq("id", task.id);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    setTask(prev => prev ? { ...prev, ...editData } as Task : prev);
    if (editData.project_id && editData.project_id !== task.project_id) {
      const { data: proj } = await supabase.from("projects")
        .select("id, name, client, discipline, responsible")
        .eq("id", editData.project_id).maybeSingle();
      if (proj) setProject(proj as Project);
    }
    setEditOpen(false);
    toast.success("Tarefa atualizada!");
  };

  // ─── Computed values ───────────────────────────────────────────────────

  const hoursProgress = task && Number(task.estimated_hours) > 0
    ? Math.round((Number(task.hours_worked) / Number(task.estimated_hours)) * 100) : 0;

  const totalHistoryMinutes = useMemo(
    () => timeEntries.reduce((sum, r) => sum + r.duration_minutes, 0),
    [timeEntries]
  );

  const responsible = profiles.find(p => p.id === task?.responsible);
  const overdue = task ? isOverdue(task) : false;

  // ─── Render ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!task || !project) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <XCircle className="h-10 w-10 mb-3 opacity-40" />
          <p className="font-medium">Tarefa não encontrada.</p>
          <Button variant="ghost" className="mt-4" onClick={() => navigate("/tarefas")}>
            Voltar para Tarefas
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <Button variant="ghost" size="sm" className="gap-1.5 -ml-2" onClick={() => navigate("/tarefas")}>
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
            <div className="flex items-center gap-2">
              {canManage && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={openEdit}>
                  <Pencil className="h-4 w-4" /> Editar
                </Button>
              )}
              {canManage && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="gap-1.5" disabled={deleting}>
                      <Trash2 className="h-4 w-4" /> Excluir
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja excluir <strong>{task.name}</strong>?
                        Todos os registros de horas vinculados também serão excluídos.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteTask}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Excluir permanentemente
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">{task.name}</h1>
              <p className="text-muted-foreground mt-1">{project.name} · {task.stage_name}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {overdue && <Badge variant="destructive">Atrasada</Badge>}
              <Badge className={`border ${STATUS_COLORS[task.status]}`}>
                {STATUS_LABELS[task.status]}
              </Badge>
            </div>
          </div>
        </div>

        {/* Reprovada alert */}
        {task.status === "reprovada" && task.rejection_reason && (
          <Card className="border-red-300 bg-red-50">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-700">Tarefa Reprovada</p>
                  <p className="text-sm text-red-600 mt-1">{task.rejection_reason}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Awaiting validation */}
        {task.status === "aguardando_validacao" && (
          <Card className="border-yellow-300 bg-yellow-50">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-yellow-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">Aguardando Validação do Coordenador</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Esta tarefa foi enviada para revisão e aguarda aprovação.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Approved */}
        {task.status === "aprovada" && (
          <Card className="border-green-300 bg-green-50">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                <p className="text-sm font-semibold text-green-700">Tarefa Aprovada pelo Coordenador</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Timer control — only for task responsible */}
        {canPlay && (
          <Card className="shadow-sm">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Controle de Tempo</p>
                    <p className="text-xs text-muted-foreground">
                      {timerStart ? "Atividade em andamento..." : "Clique para iniciar"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {timerStart && (
                    <span className="text-2xl font-bold font-mono tabular-nums text-blue-600">
                      {formatTimer(elapsed)}
                    </span>
                  )}
                  <Button
                    variant={timerStart ? "destructive" : "default"}
                    className="gap-2"
                    onClick={toggleTimer}
                  >
                    {timerStart
                      ? <><Square className="h-4 w-4" /> Parar</>
                      : <><Play className="h-4 w-4" /> Iniciar</>}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3">
          {canSendValidation && (
            <Button className="gap-2" onClick={handleSendForValidation}>
              <Send className="h-4 w-4" /> Enviar para Validação
            </Button>
          )}
          {canApproveReject && (
            <>
              <Button
                className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                onClick={handleApprove}
              >
                <ThumbsUp className="h-4 w-4" /> Aprovar
              </Button>
              <Button variant="destructive" className="gap-2" onClick={() => setRejectOpen(true)}>
                <ThumbsDown className="h-4 w-4" /> Reprovar
              </Button>
            </>
          )}
          {canMarkConcluida && (
            <Button className="gap-2" onClick={handleMarkConcluida}>
              <CheckCircle2 className="h-4 w-4" /> Marcar como Concluída
            </Button>
          )}
          {canSendToClient && (
            <Button className="gap-2 bg-purple-600 hover:bg-purple-700 text-white" onClick={handleSendToClient}>
              <Send className="h-4 w-4" /> Enviar ao Cliente
            </Button>
          )}
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Informações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Projeto</span>
                <span className="font-medium">{project.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cliente</span>
                <span className="font-medium">{project.client}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Etapa</span>
                <span className="font-medium">{task.stage_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" /> Responsável
                </span>
                <span className="font-medium">{responsible?.name || "—"}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Prazos e Horas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" /> Início
                </span>
                <span className="font-medium tabular-nums">{formatDateBR(task.start_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" /> Término
                </span>
                <span className={`font-medium tabular-nums ${overdue ? "text-red-600" : ""}`}>
                  {formatDateBR(task.end_date)}
                </span>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-muted-foreground">Progresso</span>
                  <span className={`font-medium tabular-nums ${hoursProgress > 100 ? "text-red-600" : ""}`}>
                    {Number(task.hours_worked)}h / {Number(task.estimated_hours)}h ({hoursProgress}%)
                  </span>
                </div>
                <Progress
                  value={Math.min(hoursProgress, 100)}
                  className={`h-2 ${hoursProgress > 100 ? "[&>div]:bg-red-500" : ""}`}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Activity history */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4" /> Histórico de Atividades
              <Badge variant="secondary" className="ml-auto font-mono text-xs">
                Total: {formatDuration(totalHistoryMinutes)}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {timeEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhum registro de atividade ainda.
              </p>
            ) : (
              <div className="space-y-2">
                {timeEntries.map(record => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium">{record.user_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateBR(record.date)} — {record.start_time} → {record.end_time}
                      </p>
                    </div>
                    <p className="text-sm font-medium tabular-nums">
                      {formatDuration(record.duration_minutes)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Reject dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reprovar Tarefa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Informe o motivo da reprovação. O projetista verá este motivo ao abrir a tarefa.
            </p>
            <Textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Descreva o motivo da reprovação..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectReason.trim()}
            >
              Confirmar Reprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Task Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Tarefa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome da tarefa *</Label>
              <Input
                value={editData.name || ""}
                onChange={e => setEditData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Projeto *</Label>
              <ProjectCombobox
                projects={allProjects}
                value={editData.project_id || ""}
                onValueChange={v => setEditData(prev => ({ ...prev, project_id: v }))}
                placeholder="Selecionar projeto..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Etapa *</Label>
                <Select
                  value={editData.stage_name || ""}
                  onValueChange={v => setEditData(prev => ({ ...prev, stage_name: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STAGE_NAMES.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Responsável *</Label>
                <Select
                  value={editData.responsible || ""}
                  onValueChange={v => setEditData(prev => ({ ...prev, responsible: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {profiles.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data de início *</Label>
                <Input
                  type="date"
                  value={editData.start_date || ""}
                  onChange={e => setEditData(prev => ({ ...prev, start_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Data de término *</Label>
                <Input
                  type="date"
                  value={editData.end_date || ""}
                  min={editData.start_date || ""}
                  onChange={e => setEditData(prev => ({ ...prev, end_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Horas estimadas</Label>
              <Input
                type="number"
                min={0}
                step={0.5}
                value={editData.estimated_hours ?? 0}
                onChange={e => setEditData(prev => ({ ...prev, estimated_hours: Number(e.target.value) }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
