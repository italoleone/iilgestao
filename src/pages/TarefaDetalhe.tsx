import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfiles, getProfileById, useTimeEntries, type DbTimeEntry } from "@/hooks/useSupabaseData";
import { useAuth } from "@/contexts/AuthContext";
import {
  DISCIPLINE_SHORT, TASK_STATUS_LABELS, type TaskStatus, type Discipline,
} from "@/types";
import { ArrowLeft, Play, Square, Clock, User, CalendarDays, Paperclip, History, Loader2, DollarSign, Trash2, CheckCircle2, Send, ThumbsUp, ThumbsDown, Upload, Download, FileText, AlertTriangle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

const taskStatusColors: Record<TaskStatus, string> = {
  nao_iniciada: "bg-muted text-muted-foreground",
  em_andamento: "bg-info text-info-foreground",
  concluida: "bg-success text-success-foreground",
  aguardando_validacao: "bg-warning text-warning-foreground",
  aprovada: "bg-success text-success-foreground",
  reprovada: "bg-destructive text-destructive-foreground",
};

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  return m > 0 ? `${h}h ${m.toString().padStart(2, "0")}min` : `${h}h`;
}

function formatCurrency(value: number) {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface DbTask {
  id: string; name: string; project_id: string; discipline: string; stage_name: string;
  responsible: string; start_date: string; end_date: string; estimated_hours: number;
  hours_worked: number; status: string; parent_task_id: string | null; rejection_reason: string | null;
}

interface DbProject {
  id: string; name: string; client: string; discipline: string; responsible: string;
}

interface TaskAttachment {
  id: string; task_id: string; file_name: string; file_path: string; file_size: number; uploaded_by: string; created_at: string; sheet_title: string;
}

export default function TarefaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, canAccessFinanceiro, isProjetista } = useAuth();
  const { profiles } = useActiveProfiles();
  const { entries: timeEntries, refetch: refetchEntries } = useTimeEntries(id);

  const [task, setTask] = useState<DbTask | null>(null);
  const [project, setProject] = useState<DbProject | null>(null);
  const [parentTask, setParentTask] = useState<DbTask | null>(null);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [timerStart, setTimerStart] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [sheetTitles, setSheetTitles] = useState<Record<number, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchTask = async () => {
    if (!id) return;
    setLoading(true);
    const { data } = await supabase.from("tasks").select("*").eq("id", id).maybeSingle();
    if (data) {
      const t = data as unknown as DbTask;
      setTask(t);
      const { data: proj } = await supabase.from("projects").select("id, name, client, discipline, responsible").eq("id", t.project_id).maybeSingle();
      if (proj) setProject(proj as unknown as DbProject);
      // Fetch parent task if this is a validation task
      if (t.parent_task_id) {
        const { data: parent } = await supabase.from("tasks").select("*").eq("id", t.parent_task_id).maybeSingle();
        if (parent) setParentTask(parent as unknown as DbTask);
      }
    }
    setLoading(false);
  };

  const fetchAttachments = async () => {
    if (!id) return;
    // Fetch attachments for this task and parent task
    const taskIds = [id];
    if (task?.parent_task_id) taskIds.push(task.parent_task_id);
    const { data } = await supabase.from("task_attachments").select("*").in("task_id", taskIds).order("created_at", { ascending: false });
    if (data) setAttachments(data as unknown as TaskAttachment[]);
  };

  useEffect(() => { fetchTask(); }, [id]);
  useEffect(() => { if (task) fetchAttachments(); }, [task?.id, task?.parent_task_id]);

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

  const entriesWithCost = useMemo(() => {
    return timeEntries.map((entry) => {
      const userProfile = getProfileById(profiles, entry.user_id);
      const costPerHour = userProfile?.cost_per_hour || 0;
      const cost = (entry.duration_minutes / 60) * costPerHour;
      return { ...entry, cost, costPerHour };
    });
  }, [timeEntries, profiles]);

  const totalCost = useMemo(() => entriesWithCost.reduce((sum, e) => sum + e.cost, 0), [entriesWithCost]);

  const hoursProgress = task && Number(task.estimated_hours) > 0
    ? Math.round((Number(task.hours_worked) / Number(task.estimated_hours)) * 100) : 0;

  const isValidationTask = !!task?.parent_task_id;
  const isCoordinator = project && profile && project.responsible === profile.id;
  const isTaskResponsible = task && profile && task.responsible === profile.id;
  const isManager = profile?.role === "admin_geral" || profile?.role === "admin" || profile?.role === "planejamento";
  const canExecuteTimer = task && (task.status === "nao_iniciada" || task.status === "em_andamento" || task.status === "reprovada");

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
      const newStatus = task.status === "reprovada" ? "em_andamento" : (task.status === "nao_iniciada" ? "em_andamento" : task.status);
      await supabase.from("tasks").update({ hours_worked: newHours, status: newStatus }).eq("id", task.id);

      setTask(prev => prev ? { ...prev, hours_worked: newHours, status: newStatus } : prev);
      setTimerStart(null);
      setElapsed(0);
      refetchEntries();
      toast.success("Atividade registrada!");
    } else {
      setTimerStart(new Date());
      setElapsed(0);
      if (task.status === "nao_iniciada" || task.status === "reprovada") {
        await supabase.from("tasks").update({ status: "em_andamento" }).eq("id", task.id);
        setTask(prev => prev ? { ...prev, status: "em_andamento" } : prev);
      }
    }
  };

  const handleMarkComplete = async () => {
    if (!task) return;
    await supabase.from("tasks").update({ status: "concluida" }).eq("id", task.id);
    setTask(prev => prev ? { ...prev, status: "concluida" } : prev);
    toast.success("Tarefa marcada como concluída!");
  };

  const handleSendForValidation = async () => {
    if (!task || !project || !profile) return;
    if (attachments.filter(a => a.task_id === task.id).length === 0) {
      toast.error("Anexe pelo menos 1 arquivo antes de enviar para validação.");
      return;
    }

    // Update current task status
    await supabase.from("tasks").update({ status: "aguardando_validacao" }).eq("id", task.id);

    // Create validation task for coordinator
    const { error } = await supabase.from("tasks").insert({
      name: `Validação – ${task.name}`,
      project_id: task.project_id,
      discipline: task.discipline,
      stage_name: task.stage_name,
      responsible: project.responsible,
      start_date: new Date().toISOString().slice(0, 10),
      end_date: task.end_date,
      estimated_hours: 0,
      hours_worked: 0,
      status: "nao_iniciada",
      parent_task_id: task.id,
    });

    if (error) {
      toast.error("Erro ao criar tarefa de validação: " + error.message);
      return;
    }

    setTask(prev => prev ? { ...prev, status: "aguardando_validacao" } : prev);
    toast.success("Tarefa enviada para validação do coordenador!");
  };

  const handleApprove = async () => {
    if (!task || !task.parent_task_id) return;
    // Approve parent task
    await supabase.from("tasks").update({ status: "aprovada" }).eq("id", task.parent_task_id);
    // Mark validation task as done
    await supabase.from("tasks").update({ status: "aprovada" }).eq("id", task.id);
    setTask(prev => prev ? { ...prev, status: "aprovada" } : prev);
    toast.success("Tarefa aprovada com sucesso!");
  };

  const handleReject = async () => {
    if (!task || !task.parent_task_id || !rejectReason.trim()) {
      toast.error("Informe o motivo da reprovação.");
      return;
    }
    // Reject parent task back to em_andamento
    await supabase.from("tasks").update({ status: "reprovada", rejection_reason: rejectReason.trim() }).eq("id", task.parent_task_id);
    // Mark validation task as done
    await supabase.from("tasks").update({ status: "reprovada", rejection_reason: rejectReason.trim() }).eq("id", task.id);
    setTask(prev => prev ? { ...prev, status: "reprovada" } : prev);
    setRejectOpen(false);
    setRejectReason("");
    toast.success("Tarefa reprovada. O projetista foi notificado.");
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setPendingFiles(Array.from(files));
    setSheetTitles({});
    setUploadDialogOpen(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const sanitizeFileName = (name: string) => {
    return name
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_+/g, "_");
  };

  const allTitlesFilled = pendingFiles.length > 0 && pendingFiles.every((_, i) => sheetTitles[i]?.trim());

  const handleConfirmUpload = async () => {
    if (!allTitlesFilled) {
      toast.error("Preencha a descrição de todos os arquivos.");
      return;
    }
    if (!task || !profile || pendingFiles.length === 0) return;
    setUploading(true);
    setUploadDialogOpen(false);

    for (let i = 0; i < pendingFiles.length; i++) {
      const file = pendingFiles[i];
      const safeName = sanitizeFileName(file.name);
      const filePath = `${task.id}/${Date.now()}_${i}_${safeName}`;
      const { error: uploadError } = await supabase.storage.from("task-attachments").upload(filePath, file);
      if (uploadError) {
        toast.error(`Erro ao enviar ${file.name}: ${uploadError.message}`);
        continue;
      }
      await supabase.from("task_attachments").insert({
        task_id: task.id,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        uploaded_by: profile.id,
        sheet_title: sheetTitles[i].trim(),
      });
    }

    setUploading(false);
    setPendingFiles([]);
    setSheetTitles({});
    fetchAttachments();
    toast.success("Arquivo(s) anexado(s) com sucesso!");
  };

  const handleDownload = (att: TaskAttachment) => {
    const { data } = supabase.storage.from("task-attachments").getPublicUrl(att.file_path);
    window.open(data.publicUrl, "_blank");
  };

  const [deletingAttId, setDeletingAttId] = useState<string | null>(null);

  const handleDeleteAttachment = async (att: TaskAttachment) => {
    setDeletingAttId(att.id);
    // Remove from storage
    await supabase.storage.from("task-attachments").remove([att.file_path]);
    // Remove from database
    const { error } = await supabase.from("task_attachments").delete().eq("id", att.id);
    setDeletingAttId(null);
    if (error) {
      toast.error("Erro ao excluir anexo: " + error.message);
    } else {
      setAttachments(prev => prev.filter(a => a.id !== att.id));
      toast.success("Arquivo excluído com sucesso!");
    }
  };

  const canDeleteAttachment = (att: TaskAttachment) => {
    if (!profile) return false;
    if (task?.status === "aprovada") return false;
    return att.uploaded_by === profile.id || isManager || isCoordinator;
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
  const isOverdue = new Date(task.end_date) < new Date() && !["concluida", "aprovada"].includes(task.status);
  const canDelete = profile?.role === "admin_geral" || profile?.role === "admin" || profile?.role === "planejamento";

  const handleDeleteTask = async () => {
    setDeleting(true);
    const { error } = await supabase.from("tasks").delete().eq("id", task.id);
    setDeleting(false);
    if (error) {
      toast.error("Erro ao excluir tarefa: " + error.message);
    } else {
      toast.success("Tarefa excluída com sucesso.");
      navigate("/tarefas");
    }
  };

  const showTimer = canExecuteTimer && !isValidationTask;
  const showCompleteButton = (isTaskResponsible || isManager) && task.status === "em_andamento" && !isValidationTask;
  const showSendValidation = (isTaskResponsible || isManager) && task.status === "concluida" && !isValidationTask;
  const showValidationActions = isValidationTask && (isCoordinator || isManager) && !["aprovada", "reprovada"].includes(task.status);

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="animate-reveal-up" style={{ animationFillMode: "backwards" }}>
          <div className="flex items-center justify-between mb-3">
            <Button variant="ghost" size="sm" className="gap-1.5 -ml-2" onClick={() => navigate("/tarefas")}>
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
            {canDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="gap-1.5" disabled={deleting}>
                    <Trash2 className="h-4 w-4" /> Excluir Tarefa
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja excluir a tarefa <strong>{task.name}</strong>?
                      <br /><br />
                      ⚠️ Todos os registros de horas vinculados também serão excluídos permanentemente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteTask} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Excluir permanentemente
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">{task.name}</h1>
              <p className="text-muted-foreground mt-1">{project.name} · {task.stage_name}</p>
            </div>
            <div className="flex items-center gap-2">
              {isOverdue && <Badge variant="destructive">Atrasada</Badge>}
              <Badge variant="secondary" className={taskStatusColors[task.status as TaskStatus]}>
                {TASK_STATUS_LABELS[task.status as TaskStatus] || task.status}
              </Badge>
            </div>
          </div>
        </div>

        {/* Rejection reason alert */}
        {task.rejection_reason && (task.status === "reprovada") && (
          <Card className="border-destructive/50 bg-destructive/5 shadow-sm animate-reveal-up" style={{ animationFillMode: "backwards" }}>
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-destructive">Tarefa Reprovada</p>
                  <p className="text-sm text-muted-foreground mt-1">{task.rejection_reason}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Validation task: show parent task info */}
        {isValidationTask && parentTask && (
          <Card className="border-primary/30 bg-primary/5 shadow-sm animate-reveal-up" style={{ animationFillMode: "backwards" }}>
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">Tarefa de Validação</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Tarefa original: <strong>{parentTask.name}</strong><br />
                    Projetista: <strong>{getProfileById(profiles, parentTask.responsible)?.name || "—"}</strong>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Timer control */}
        {showTimer && (
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

        {/* Action buttons */}
        {(showCompleteButton || showSendValidation || showValidationActions) && (
          <div className="flex flex-wrap gap-3 animate-reveal-up delay-1" style={{ animationFillMode: "backwards" }}>
            {showCompleteButton && (
              <Button className="gap-2" onClick={handleMarkComplete}>
                <CheckCircle2 className="h-4 w-4" /> Marcar como Concluído
              </Button>
            )}
            {showSendValidation && (
              <Button className="gap-2 bg-primary" onClick={handleSendForValidation}>
                <Send className="h-4 w-4" /> Enviar para Validação do Coordenador
              </Button>
            )}
            {showValidationActions && (
              <>
                <Button className="gap-2 bg-success text-success-foreground hover:bg-success/90" onClick={handleApprove}>
                  <ThumbsUp className="h-4 w-4" /> Aprovar
                </Button>
                <Button variant="destructive" className="gap-2" onClick={() => setRejectOpen(true)}>
                  <ThumbsDown className="h-4 w-4" /> Reprovar
                </Button>
              </>
            )}
          </div>
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
              {canAccessFinanceiro && (
                <div className="flex justify-between pt-1 border-t">
                  <span className="text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" /> Custo acumulado</span>
                  <span className="font-semibold tabular-nums">{formatCurrency(totalCost)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Attachments */}
        <Card className="shadow-sm animate-reveal-up delay-3" style={{ animationFillMode: "backwards" }}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Paperclip className="h-4 w-4" /> Arquivos Anexos
              <Badge variant="secondary" className="ml-auto text-xs">{attachments.length} arquivo(s)</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {attachments.length > 0 ? (
              <div className="space-y-2 mb-4">
                {attachments.map((att) => {
                  const uploader = getProfileById(profiles, att.uploaded_by);
                  return (
                    <div key={att.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-sm font-semibold">{att.sheet_title || att.file_name}</p>
                          <p className="text-xs text-muted-foreground">{att.file_name}</p>
                          <p className="text-xs text-muted-foreground">
                            Enviado por: {uploader?.name || "—"} · {new Date(att.created_at).toLocaleDateString("pt-BR")}
                            {att.file_size > 0 && ` · ${(att.file_size / 1024).toFixed(0)} KB`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => handleDownload(att)}>
                          <Download className="h-4 w-4" /> Baixar
                        </Button>
                        {canDeleteAttachment(att) && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="gap-1 text-destructive hover:text-destructive" disabled={deletingAttId === att.id}>
                                {deletingAttId === att.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir anexo?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Deseja realmente excluir o anexo <strong>"{att.sheet_title || att.file_name}"</strong>? Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteAttachment(att)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4 mb-4">Nenhum arquivo anexado.</p>
            )}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.dwg,.dxf,.xlsx,.xls,.png,.jpg,.jpeg"
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                {uploading ? "Enviando..." : "Anexar arquivo"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Activity history */}
        <Card className="shadow-sm animate-reveal-up delay-4" style={{ animationFillMode: "backwards" }}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4" /> Histórico de Atividades
              <div className="ml-auto flex items-center gap-2">
                {canAccessFinanceiro && totalCost > 0 && (
                  <Badge variant="outline" className="font-mono text-xs gap-1">
                    <DollarSign className="h-3 w-3" /> {formatCurrency(totalCost)}
                  </Badge>
                )}
                <Badge variant="secondary" className="font-mono text-xs">Total: {formatDuration(totalHistoryMinutes)}</Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {entriesWithCost.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum registro de atividade ainda.</p>
            ) : (
              <div className="space-y-2">
                {entriesWithCost.map((record) => (
                  <div key={record.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                    <div>
                      <p className="text-sm font-medium">{record.user_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(record.date + "T00:00:00").toLocaleDateString("pt-BR")} — {record.start_time} → {record.end_time}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium tabular-nums">{formatDuration(record.duration_minutes)}</p>
                      {canAccessFinanceiro && record.cost > 0 && (
                        <p className="text-xs text-muted-foreground tabular-nums">{formatCurrency(record.cost)}</p>
                      )}
                    </div>
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
          <DialogHeader><DialogTitle>Reprovar Tarefa</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Informe o motivo da reprovação. O projetista será notificado.</p>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Descreva o motivo da reprovação..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectReason.trim()}>Confirmar Reprovação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload title dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={(open) => { if (!open) { setPendingFiles([]); setSheetTitle(""); } setUploadDialogOpen(open); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Título da Folha</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Informe o título da folha para identificar o(s) arquivo(s):
            </p>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Arquivo(s): {pendingFiles.map(f => f.name).join(", ")}</p>
            </div>
            <Input
              value={sheetTitle}
              onChange={(e) => setSheetTitle(e.target.value)}
              placeholder="Ex: Planta de Forma – Pavimento Térreo"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUploadDialogOpen(false); setPendingFiles([]); setSheetTitle(""); }}>Cancelar</Button>
            <Button onClick={handleConfirmUpload} disabled={!sheetTitle.trim() || uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              Confirmar Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
