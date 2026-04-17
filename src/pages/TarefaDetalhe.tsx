import { useState, useEffect, useMemo, useRef, lazy, Suspense } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { parseLocalDate, formatDateBR } from "@/lib/utils";
import { AppLayout } from "@/components/AppLayout";
import { ProjectCombobox } from "@/components/ProjectCombobox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfiles, getProfileById, useTimeEntries, useProjects, type DbTimeEntry } from "@/hooks/useSupabaseData";
import { useAuth } from "@/contexts/AuthContext";
import {
  DISCIPLINE_SHORT, TASK_STATUS_LABELS, type TaskStatus, type Discipline, STAGE_NAMES,
} from "@/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Play, Square, Clock, User, CalendarDays, Paperclip, History, Loader2, DollarSign, Trash2, CheckCircle2, Send, ThumbsUp, ThumbsDown, Upload, Download, FileText, AlertTriangle, Eye, Radio, Pencil, MessageSquare, ChevronRight } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { PdfViewer } from "@/components/PdfViewer";
import { useActiveTimers, startActiveTimer, stopActiveTimer, getTimerForTask } from "@/hooks/useActiveTimers";

const taskStatusColors: Record<TaskStatus, string> = {
  nao_iniciada: "bg-muted text-muted-foreground",
  em_andamento: "bg-info text-info-foreground",
  concluida: "bg-success text-success-foreground",
  aguardando_validacao: "bg-warning text-warning-foreground",
  aprovada: "bg-success text-success-foreground",
  reprovada: "bg-destructive text-destructive-foreground",
  enviado_cliente: "bg-primary text-primary-foreground",
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

interface EditableEntry {
  id: string;
  task_id: string;
  project_id: string;
  user_id: string;
  user_name: string;
  date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  cost: number;
  costPerHour: number;
}

export default function TarefaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, canAccessFinanceiro, isProjetista } = useAuth();
  const { profiles } = useActiveProfiles();
  const { projects: allProjects } = useProjects();
  const { entries: timeEntries, refetch: refetchEntries } = useTimeEntries(id);
  const { activeTimers, loaded: timersLoaded } = useActiveTimers();
  const timerRestoredRef = useRef(false);

  const [task, setTask] = useState<DbTask | null>(null);
  const [project, setProject] = useState<DbProject | null>(null);
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
  const [pdfViewer, setPdfViewer] = useState<{ url: string; attachmentId: string; fileName: string; sheetTitle: string } | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState<Partial<DbTask>>({});
  const [saving, setSaving] = useState(false);
  const [editingEntry, setEditingEntry] = useState<EditableEntry | null>(null);
  const [editEntryData, setEditEntryData] = useState<{ date: string; start_time: string; end_time: string }>({ date: "", start_time: "", end_time: "" });
  const [savingEntry, setSavingEntry] = useState(false);

  // Comments state
  interface DbComment {
    id: string; task_id: string; author_id: string; title: string; body: string;
    parent_id: string | null; created_at: string;
    author?: { name: string };
    replies?: DbComment[];
  }
  const [comments, setComments] = useState<DbComment[]>([]);
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [selectedComment, setSelectedComment] = useState<DbComment | null>(null);
  const [newCommentTitle, setNewCommentTitle] = useState("");
  const [newCommentBody, setNewCommentBody] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [savingComment, setSavingComment] = useState(false);

  const fetchTask = async () => {
    if (!id) return;
    setLoading(true);
    const { data } = await supabase.from("tasks").select("*").eq("id", id).maybeSingle();
    if (data) {
      const t = data as unknown as DbTask;
      setTask(t);
      const { data: proj } = await supabase.from("projects").select("id, name, client, discipline, responsible").eq("id", t.project_id).maybeSingle();
      if (proj) setProject(proj as unknown as DbProject);
    }
    setLoading(false);
  };

  const fetchAttachments = async () => {
    if (!id) return;
    const { data } = await supabase.from("task_attachments").select("*").eq("task_id", id).order("created_at", { ascending: false });
    if (data) setAttachments(data as unknown as TaskAttachment[]);
  };

  const fetchComments = async () => {
    if (!id) return;
    const { data } = await supabase
      .from("task_comments")
      .select("*, author:profiles!author_id(name)")
      .eq("task_id", id)
      .is("parent_id", null)
      .order("created_at", { ascending: false });
    if (!data) return;
    const withReplies = await Promise.all(
      (data as any[]).map(async (c) => {
        const { data: replies } = await supabase
          .from("task_comments")
          .select("*, author:profiles!author_id(name)")
          .eq("parent_id", c.id)
          .order("created_at", { ascending: true });
        return { ...c, replies: replies || [] };
      })
    );
    setComments(withReplies as DbComment[]);
  };

  useEffect(() => { fetchTask(); fetchComments(); }, [id]);
  useEffect(() => {
    if (task) fetchAttachments();
  }, [task?.id]);

  // Restore timer state from backend on mount
  useEffect(() => {
    if (!profile || !id || !timersLoaded) return;
    const myTimer = activeTimers.find(t => t.user_id === profile.id && t.task_id === id);
    if (myTimer) {
      const startedAt = new Date(myTimer.started_at);
      setTimerStart(startedAt);
      setElapsed(Math.floor((Date.now() - startedAt.getTime()) / 1000));
      timerRestoredRef.current = true;
    } else if (timerRestoredRef.current) {
      // Timer was stopped externally
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

  const isCoordinator = profile?.role === "coordenador" || profile?.role === "admin_geral" || profile?.role === "admin" || (project && profile && project.responsible === profile.id);
  const isTaskResponsible = task && profile && task.responsible === profile.id;
  const isManager = profile?.role === "admin_geral" || profile?.role === "admin" || profile?.role === "planejamento";
  const canEditTimeEntries = profile?.role === "admin_geral" || profile?.role === "admin" || profile?.role === "planejamento" || profile?.role === "coordenador";
  const canExecuteTimer = task && (task.status === "nao_iniciada" || task.status === "em_andamento" || task.status === "reprovada");

  const toggleTimer = async () => {
    if (!task || !profile) return;
    if (timerStart) {
      // Stop timer - all logic handled atomically by backend
      try {
        const result = await stopActiveTimer();
        if (result.stopped) {
          setTask(prev => prev ? {
            ...prev,
            hours_worked: result.new_hours_worked ?? prev.hours_worked,
            status: prev.status === "nao_iniciada" || prev.status === "reprovada" ? "em_andamento" : prev.status,
          } : prev);
          setTimerStart(null);
          setElapsed(0);
          timerRestoredRef.current = false;
          refetchEntries();
          toast.success("Atividade registrada!");
        }
      } catch (err: any) {
        toast.error("Erro ao parar timer: " + err.message);
      }
    } else {
      // Start timer - all logic handled atomically by backend
      try {
        await startActiveTimer(task.id, task.project_id);
        setTimerStart(new Date());
        setElapsed(0);
        if (task.status === "nao_iniciada" || task.status === "reprovada") {
          setTask(prev => prev ? { ...prev, status: "em_andamento" } : prev);
        }
      } catch (err: any) {
        toast.error("Erro ao iniciar timer: " + err.message);
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
    if (!task || !profile) return;
    if (attachments.length === 0) {
      toast.error("Anexe pelo menos 1 arquivo antes de enviar para validação.");
      return;
    }
    const { error } = await supabase.from("tasks").update({ status: "aguardando_validacao" }).eq("id", task.id);
    if (error) {
      toast.error("Erro ao enviar para validação: " + error.message);
      return;
    }
    setTask(prev => prev ? { ...prev, status: "aguardando_validacao" } : prev);
    toast.success("Tarefa enviada para validação do coordenador!");
    navigate("/tarefas");
  };

  const handleAddComment = async () => {
    if (!newCommentTitle.trim() || !newCommentBody.trim() || !profile || !id) return;
    setSavingComment(true);
    const { error } = await supabase.from("task_comments").insert({
      task_id: id, author_id: profile.id,
      title: newCommentTitle.trim(), body: newCommentBody.trim(), parent_id: null,
    } as any);
    setSavingComment(false);
    if (error) { toast.error("Erro ao salvar comentário."); return; }
    setNewCommentTitle(""); setNewCommentBody("");
    fetchComments();
    toast.success("Comentário adicionado!");
  };

  const handleAddReply = async () => {
    if (!replyBody.trim() || !profile || !selectedComment) return;
    setSavingComment(true);
    const { error } = await supabase.from("task_comments").insert({
      task_id: id!, author_id: profile.id,
      title: `Re: ${selectedComment.title}`, body: replyBody.trim(),
      parent_id: selectedComment.id,
    } as any);
    setSavingComment(false);
    if (error) { toast.error("Erro ao salvar resposta."); return; }
    setReplyBody("");
    fetchComments();
    const { data: updatedReplies } = await supabase
      .from("task_comments")
      .select("*, author:profiles!author_id(name)")
      .eq("parent_id", selectedComment.id)
      .order("created_at", { ascending: true });
    setSelectedComment(prev => prev ? { ...prev, replies: (updatedReplies as any[]) || [] } : prev);
    toast.success("Resposta adicionada!");
  };

  const handleApprove = async () => {
    if (!task) return;
    const { error } = await supabase.from("tasks").update({ status: "aprovada" }).eq("id", task.id);
    if (error) { toast.error("Erro ao aprovar: " + error.message); return; }
    setTask(prev => prev ? { ...prev, status: "aprovada" } : prev);
    toast.success("Tarefa aprovada com sucesso!");
    navigate("/tarefas");
  };

  const handleReject = async () => {
    if (!task || !rejectReason.trim()) {
      toast.error("Informe o motivo da reprovação.");
      return;
    }
    const { error } = await supabase.from("tasks").update({ status: "reprovada", rejection_reason: rejectReason.trim() }).eq("id", task.id);
    if (error) { toast.error("Erro ao reprovar: " + error.message); return; }
    setTask(prev => prev ? { ...prev, status: "reprovada", rejection_reason: rejectReason.trim() } : prev);
    setRejectOpen(false);
    setRejectReason("");
    toast.success("Tarefa reprovada. O projetista será notificado.");
    navigate("/tarefas");
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
  };

  const handleSaveEntry = async () => {
    if (!editingEntry || !task) return;
    setSavingEntry(true);
    const [sh, sm] = editEntryData.start_time.split(":").map(Number);
    const [eh, em] = editEntryData.end_time.split(":").map(Number);
    let duration = (eh * 60 + em) - (sh * 60 + sm);
    if (duration <= 0) duration = 1;
    const { error } = await supabase
      .from("time_entries")
      .update({
        date: editEntryData.date,
        start_time: editEntryData.start_time,
        end_time: editEntryData.end_time,
        duration_minutes: duration,
      })
      .eq("id", editingEntry.id);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      setSavingEntry(false);
      return;
    }
    const { data: allEntries } = await supabase
      .from("time_entries")
      .select("duration_minutes")
      .eq("task_id", task.id);
    const totalMinutes = (allEntries || []).reduce((sum: number, e: { duration_minutes: number }) => sum + e.duration_minutes, 0);
    const newHoursWorked = Math.round((totalMinutes / 60) * 100) / 100;
    await supabase.from("tasks").update({ hours_worked: newHoursWorked }).eq("id", task.id);
    setTask(prev => prev ? { ...prev, hours_worked: newHoursWorked } : prev);
    setSavingEntry(false);
    setEditingEntry(null);
    refetchEntries();
    toast.success("Registro de horas atualizado!");
  };
    if (!profile) return false;
    if (task?.status === "aprovada" || task?.status === "enviado_cliente") return false;
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
  const isOverdue = parseLocalDate(task.end_date) < new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()) && !["concluida", "aprovada", "enviado_cliente"].includes(task.status);
  const canDelete = profile?.role === "admin_geral" || profile?.role === "admin" || profile?.role === "planejamento";
  const canEdit = !isProjetista && !["aprovada", "enviado_cliente"].includes(task.status);

  const openEditDialog = () => {
    setEditData({
      name: task.name,
      project_id: task.project_id,
      discipline: task.discipline,
      responsible: task.responsible,
      start_date: task.start_date,
      end_date: task.end_date,
      stage_name: task.stage_name,
      estimated_hours: task.estimated_hours,
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editData.name?.trim()) { toast.error("Nome da tarefa é obrigatório."); return; }
    setSaving(true);
    const { error } = await supabase.from("tasks").update({
      name: editData.name,
      project_id: editData.project_id,
      discipline: editData.discipline,
      responsible: editData.responsible,
      start_date: editData.start_date,
      end_date: editData.end_date,
      stage_name: editData.stage_name,
      estimated_hours: editData.estimated_hours,
    }).eq("id", task.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      setTask(prev => prev ? { ...prev, ...editData } as DbTask : prev);
      // Refresh project info if project changed
      if (editData.project_id && editData.project_id !== task.project_id) {
        const { data: proj } = await supabase.from("projects").select("id, name, client, discipline, responsible").eq("id", editData.project_id).maybeSingle();
        if (proj) setProject(proj as unknown as DbProject);
      }
      setEditOpen(false);
      toast.success("Tarefa atualizada com sucesso!");
    }
  };

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

  const showTimer = canExecuteTimer;
  const showCompleteButton = (isTaskResponsible || isManager) && task.status === "em_andamento";
  const showSendValidation = (isTaskResponsible || isManager) && task.status === "concluida";
  // Coordinator or manager can validate, but NOT the task executor (prevent self-approval)
  const showValidationActions = (isCoordinator || isManager) && task.status === "aguardando_validacao";
  const showSendToClient = (isTaskResponsible || isManager) && task.status === "aprovada";

  const handleSendToClient = async () => {
    if (!task) return;
    await supabase.from("tasks").update({ status: "enviado_cliente" }).eq("id", task.id);
    setTask(prev => prev ? { ...prev, status: "enviado_cliente" } : prev);
    toast.success("Tarefa marcada como enviada ao cliente!");
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="animate-reveal-up" style={{ animationFillMode: "backwards" }}>
          <div className="flex items-center justify-between mb-3">
            <Button variant="ghost" size="sm" className="gap-1.5 -ml-2" onClick={() => navigate("/tarefas")}>
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
            <div className="flex items-center gap-2">
              {canEdit && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={openEditDialog}>
                  <Pencil className="h-4 w-4" /> Editar Tarefa
                </Button>
              )}
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

        {/* Approved - send to client */}
        {task.status === "aprovada" && (
          <Card className="border-success/30 bg-success/5 shadow-sm animate-reveal-up" style={{ animationFillMode: "backwards" }}>
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-success mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-success">Tarefa Aprovada</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Esta tarefa foi aprovada pelo coordenador. Clique em "Enviar para o Cliente" para finalizar.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sent to client */}
        {task.status === "enviado_cliente" && (
          <Card className="border-primary/30 bg-primary/5 shadow-sm animate-reveal-up" style={{ animationFillMode: "backwards" }}>
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <Send className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-primary">Enviado ao Cliente</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Esta tarefa foi enviada ao cliente com sucesso.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Awaiting validation info */}
        {task.status === "aguardando_validacao" && (
          <Card className="border-warning/30 bg-warning/5 shadow-sm animate-reveal-up" style={{ animationFillMode: "backwards" }}>
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <Send className="h-5 w-5 text-warning mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">Aguardando Validação do Coordenador</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Esta tarefa foi enviada para validação e aguarda aprovação.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active users indicator */}
        {(() => {
          const otherActiveTimers = id ? getTimerForTask(activeTimers, id).filter(t => t.user_id !== profile?.id) : [];
          if (otherActiveTimers.length > 0 && !isProjetista) {
            return (
              <Card className="border-success/30 bg-success/5 shadow-sm animate-reveal-up delay-1" style={{ animationFillMode: "backwards" }}>
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <Radio className="h-5 w-5 text-success animate-pulse" />
                    <div>
                      <p className="text-sm font-semibold text-success">Em execução agora</p>
                      <p className="text-sm text-muted-foreground">
                        {otherActiveTimers.map(t => t.user_name).join(", ")} {otherActiveTimers.length === 1 ? "está" : "estão"} trabalhando nesta tarefa
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          }
          return null;
        })()}

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
        {(showCompleteButton || showSendValidation || showValidationActions || showSendToClient) && (
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
            {showSendToClient && (
              <Button className="gap-2 bg-primary" onClick={handleSendToClient}>
                <Send className="h-4 w-4" /> Enviar para o Cliente
              </Button>
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
              <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Início</span><span className="font-medium tabular-nums">{formatDateBR(task.start_date)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Término</span><span className={`font-medium tabular-nums ${isOverdue ? "text-destructive" : ""}`}>{formatDateBR(task.end_date)}</span></div>
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

        {/* Comments */}
        <Card className="shadow-sm animate-reveal-up delay-3" style={{ animationFillMode: "backwards" }}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4" /> Observações / Comentários
              <Badge variant="secondary" className="ml-auto text-xs">{comments.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* New comment form */}
            <div className="space-y-2 p-3 rounded-lg border bg-muted/20">
              <p className="text-xs font-medium text-muted-foreground">Novo comentário</p>
              <Input
                placeholder="Título do comentário..."
                value={newCommentTitle}
                onChange={(e) => setNewCommentTitle(e.target.value)}
                className="text-sm"
              />
              <Textarea
                placeholder="Escreva sua observação aqui..."
                value={newCommentBody}
                onChange={(e) => setNewCommentBody(e.target.value)}
                rows={3}
                className="text-sm resize-none"
              />
              <div className="flex justify-end">
                <Button
                  size="sm" className="gap-1.5"
                  onClick={handleAddComment}
                  disabled={savingComment || !newCommentTitle.trim() || !newCommentBody.trim()}
                >
                  {savingComment ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                  Publicar
                </Button>
              </div>
            </div>

            {/* Comments list */}
            {comments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum comentário ainda.</p>
            ) : (
              <div className="space-y-2">
                {comments.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-start justify-between p-3 rounded-lg border hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => { setSelectedComment(c); setCommentDialogOpen(true); setReplyBody(""); }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{c.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {(c.author as any)?.name || "—"} · {formatDateBR(c.created_at?.split("T")[0] || "")}
                        {c.replies && c.replies.length > 0 && (
                          <span className="ml-2 text-primary font-medium">{c.replies.length} resposta{c.replies.length > 1 ? "s" : ""}</span>
                        )}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

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
                            Enviado por: {uploader?.name || "—"} · {formatDateBR(att.created_at?.split("T")[0] || "")}
                            {att.file_size > 0 && ` · ${(att.file_size / 1024).toFixed(0)} KB`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {att.file_name.toLowerCase().endsWith(".pdf") && (
                          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => {
                            const { data } = supabase.storage.from("task-attachments").getPublicUrl(att.file_path);
                            setPdfViewer({ url: data.publicUrl, attachmentId: att.id, fileName: att.file_name, sheetTitle: att.sheet_title });
                          }}>
                            <Eye className="h-4 w-4" /> Visualizar
                          </Button>
                        )}
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
                        {formatDateBR(record.date)} — {record.start_time} → {record.end_time}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-medium tabular-nums">{formatDuration(record.duration_minutes)}</p>
                        {canAccessFinanceiro && record.cost > 0 && (
                          <p className="text-xs text-muted-foreground tabular-nums">{formatCurrency(record.cost)}</p>
                        )}
                      </div>
                      {canEditTimeEntries && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 text-muted-foreground hover:text-foreground shrink-0"
                          onClick={() => {
                            const entry: EditableEntry = {
                              id: record.id,
                              task_id: record.task_id,
                              project_id: record.project_id,
                              user_id: record.user_id,
                              user_name: record.user_name,
                              date: record.date,
                              start_time: record.start_time,
                              end_time: record.end_time,
                              duration_minutes: record.duration_minutes,
                              cost: record.cost,
                              costPerHour: record.costPerHour,
                            };
                            setEditingEntry(entry);
                            setEditEntryData({
                              date: record.date,
                              start_time: record.start_time,
                              end_time: record.end_time,
                            });
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Comment detail dialog */}
      <Dialog open={commentDialogOpen} onOpenChange={(open) => { if (!open) { setSelectedComment(null); setReplyBody(""); } setCommentDialogOpen(open); }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base">{selectedComment?.title}</DialogTitle>
            <p className="text-xs text-muted-foreground">
              {(selectedComment?.author as any)?.name || "—"} · {formatDateBR(selectedComment?.created_at?.split("T")[0] || "")}
            </p>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-2">
            <div className="p-3 rounded-lg bg-muted/30 text-sm whitespace-pre-wrap">
              {selectedComment?.body}
            </div>

            {selectedComment?.replies && selectedComment.replies.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Respostas</p>
                {selectedComment.replies.map((r) => (
                  <div key={r.id} className="ml-4 p-3 rounded-lg border bg-muted/10 text-sm">
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      {(r.author as any)?.name || "—"} · {formatDateBR(r.created_at?.split("T")[0] || "")}
                    </p>
                    <p className="whitespace-pre-wrap">{r.body}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2 pt-2 border-t">
              <p className="text-xs font-medium text-muted-foreground">Adicionar resposta</p>
              <Textarea
                placeholder="Escreva sua resposta..."
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                rows={3}
                className="text-sm resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCommentDialogOpen(false)}>Fechar</Button>
            <Button size="sm" className="gap-1.5" onClick={handleAddReply} disabled={savingComment || !replyBody.trim()}>
              {savingComment ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              Responder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
      <Dialog open={uploadDialogOpen} onOpenChange={(open) => { if (!open) { setPendingFiles([]); setSheetTitles({}); } setUploadDialogOpen(open); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Descrição dos Arquivos</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            <p className="text-sm text-muted-foreground">
              Informe a descrição (título da folha) para cada arquivo:
            </p>
            {pendingFiles.map((file, idx) => (
              <div key={idx} className="space-y-1.5 p-3 rounded-lg border">
                <p className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  {file.name}
                </p>
                <Input
                  value={sheetTitles[idx] || ""}
                  onChange={(e) => setSheetTitles(prev => ({ ...prev, [idx]: e.target.value }))}
                  placeholder="Ex: Planta de Forma – Pavimento Térreo"
                  autoFocus={idx === 0}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUploadDialogOpen(false); setPendingFiles([]); setSheetTitles({}); }}>Cancelar</Button>
            <Button onClick={handleConfirmUpload} disabled={!allTitlesFilled || uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              Confirmar Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PDF Viewer */}
      {pdfViewer && (
        <PdfViewer
          fileUrl={pdfViewer.url}
          attachmentId={pdfViewer.attachmentId}
          taskId={task.id}
          fileName={pdfViewer.fileName}
          sheetTitle={pdfViewer.sheetTitle}
          onClose={() => setPdfViewer(null)}
        />
      )}

      {/* Edit Task Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar Tarefa</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome da tarefa</Label>
              <Input value={editData.name || ""} onChange={(e) => setEditData(prev => ({ ...prev, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Projeto</Label>
              <ProjectCombobox
                projects={allProjects}
                value={editData.project_id || ""}
                onValueChange={(v) => setEditData(prev => ({ ...prev, project_id: v }))}
                placeholder="Selecionar projeto..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Disciplina</Label>
                <Select value={editData.discipline || ""} onValueChange={(v) => setEditData(prev => ({ ...prev, discipline: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="estrutural">Estrutural</SelectItem>
                    <SelectItem value="hidraulica">Hidráulica</SelectItem>
                    <SelectItem value="eletrica">Elétrica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Responsável</Label>
                <Select value={editData.responsible || ""} onValueChange={(v) => setEditData(prev => ({ ...prev, responsible: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {profiles.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Etapa</Label>
              <Select value={editData.stage_name || ""} onValueChange={(v) => setEditData(prev => ({ ...prev, stage_name: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAGE_NAMES.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data de início</Label>
                <Input type="date" value={editData.start_date || ""} onChange={(e) => setEditData(prev => ({ ...prev, start_date: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Data de término</Label>
                <Input type="date" value={editData.end_date || ""} onChange={(e) => setEditData(prev => ({ ...prev, end_date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Horas estimadas</Label>
              <Input type="number" min={0} step={0.5} value={editData.estimated_hours ?? 0} onChange={(e) => setEditData(prev => ({ ...prev, estimated_hours: Number(e.target.value) }))} />
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

      <Dialog open={!!editingEntry} onOpenChange={(open) => { if (!open) setEditingEntry(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar Registro de Horas</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Usuário: <span className="font-medium text-foreground">{editingEntry?.user_name}</span>
            </p>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input
                type="date"
                value={editEntryData.date}
                onChange={(e) => setEditEntryData(prev => ({ ...prev, date: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Início (Play)</Label>
                <Input
                  type="time"
                  value={editEntryData.start_time}
                  onChange={(e) => setEditEntryData(prev => ({ ...prev, start_time: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Término (Pause)</Label>
                <Input
                  type="time"
                  value={editEntryData.end_time}
                  onChange={(e) => setEditEntryData(prev => ({ ...prev, end_time: e.target.value }))}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">A duração será recalculada automaticamente.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingEntry(null)}>Cancelar</Button>
            <Button onClick={handleSaveEntry} disabled={savingEntry}>
              {savingEntry && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
