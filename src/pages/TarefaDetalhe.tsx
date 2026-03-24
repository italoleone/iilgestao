import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { tasks as allTasks, projects, getUserById } from "@/data/mockData";
import {
  DISCIPLINE_SHORT,
  TASK_STATUS_LABELS,
  type TaskStatus,
  type TimeRecord,
} from "@/types";
import {
  ArrowLeft,
  Play,
  Square,
  Clock,
  User,
  CalendarDays,
  Paperclip,
  History,
} from "lucide-react";
import { toast } from "sonner";

const taskStatusColors: Record<TaskStatus, string> = {
  nao_iniciada: "bg-muted text-muted-foreground",
  em_andamento: "bg-info text-info-foreground",
  concluida: "bg-success text-success-foreground",
};

// Mock history
const initialHistory: TimeRecord[] = [
  { id: "tr1", userId: "u6", userName: "Juliana Rocha", date: "2026-03-22", startTime: "08:30", endTime: "10:45", durationMinutes: 135 },
  { id: "tr2", userId: "u6", userName: "Juliana Rocha", date: "2026-03-21", startTime: "13:00", endTime: "17:15", durationMinutes: 255 },
  { id: "tr3", userId: "u9", userName: "Thiago Nascimento", date: "2026-03-20", startTime: "09:00", endTime: "12:00", durationMinutes: 180 },
  { id: "tr4", userId: "u6", userName: "Juliana Rocha", date: "2026-03-19", startTime: "08:47", endTime: "09:47", durationMinutes: 60 },
];

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  return m > 0 ? `${h}h ${m.toString().padStart(2, "0")}min` : `${h}h`;
}

export default function TarefaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const task = allTasks.find((t) => t.id === id);
  const project = task ? projects.find((p) => p.id === task.projectId) : null;
  const responsible = task ? getUserById(task.responsible) : null;

  const [timerStart, setTimerStart] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [history, setHistory] = useState<TimeRecord[]>(initialHistory);
  const [currentHoursWorked, setCurrentHoursWorked] = useState(task?.hoursWorked ?? 0);

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

  const totalHistoryMinutes = useMemo(
    () => history.reduce((sum, r) => sum + r.durationMinutes, 0),
    [history]
  );

  const totalHours = currentHoursWorked;
  const hoursProgress = task && task.estimatedHours > 0
    ? Math.round((totalHours / task.estimatedHours) * 100)
    : 0;

  const toggleTimer = () => {
    if (timerStart) {
      // Stop — create record
      const now = new Date();
      const durationMinutes = Math.max(1, Math.round(elapsed / 60));
      const pad = (n: number) => n.toString().padStart(2, "0");
      const newRecord: TimeRecord = {
        id: `tr-${Date.now()}`,
        userId: responsible?.id ?? "",
        userName: responsible?.name ?? "Usuário",
        date: now.toISOString().slice(0, 10),
        startTime: `${pad(timerStart.getHours())}:${pad(timerStart.getMinutes())}`,
        endTime: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
        durationMinutes,
      };
      setHistory((prev) => [newRecord, ...prev]);
      setCurrentHoursWorked((prev) => Math.round((prev + elapsed / 3600) * 100) / 100);
      setTimerStart(null);
      setElapsed(0);
      toast.success("Atividade registrada!");
    } else {
      setTimerStart(new Date());
      setElapsed(0);
    }
  };

  if (!task || !project) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <p>Tarefa não encontrada.</p>
          <Button variant="ghost" className="mt-4" onClick={() => navigate("/tarefas")}>
            Voltar para Tarefas
          </Button>
        </div>
      </AppLayout>
    );
  }

  const isOverdue = new Date(task.endDate) < new Date() && task.status !== "concluida";

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back + Title */}
        <div className="animate-reveal-up" style={{ animationFillMode: "backwards" }}>
          <Button variant="ghost" size="sm" className="gap-1.5 mb-3 -ml-2" onClick={() => navigate("/tarefas")}>
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">{task.name}</h1>
              <p className="text-muted-foreground mt-1">{project.name} · {task.stageName}</p>
            </div>
            <div className="flex items-center gap-2">
              {isOverdue && <Badge variant="destructive">Atrasada</Badge>}
              <Badge variant="secondary" className={taskStatusColors[task.status]}>
                {TASK_STATUS_LABELS[task.status]}
              </Badge>
            </div>
          </div>
        </div>

        {/* Timer Card */}
        {task.status !== "concluida" && (
          <Card className="shadow-sm animate-reveal-up delay-1" style={{ animationFillMode: "backwards" }}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Controle de Tempo</p>
                    <p className="text-xs text-muted-foreground">
                      {timerStart ? "Atividade em andamento..." : "Clique para iniciar uma atividade"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {timerStart && (
                    <span className="text-2xl font-bold font-mono tabular-nums text-primary">
                      {formatTimer(elapsed)}
                    </span>
                  )}
                  <Button
                    variant={timerStart ? "destructive" : "default"}
                    className="gap-2"
                    onClick={toggleTimer}
                  >
                    {timerStart ? (
                      <><Square className="h-4 w-4" /> Parar</>
                    ) : (
                      <><Play className="h-4 w-4" /> Iniciar</>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-reveal-up delay-2" style={{ animationFillMode: "backwards" }}>
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
                <span className="text-muted-foreground">Disciplina</span>
                <span className="font-medium">{DISCIPLINE_SHORT[task.discipline]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Etapa</span>
                <span className="font-medium">{task.stageName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" /> Responsável</span>
                <span className="font-medium">{responsible?.name}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Prazos e Horas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Início</span>
                <span className="font-medium tabular-nums">{new Date(task.startDate).toLocaleDateString("pt-BR")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Término</span>
                <span className={`font-medium tabular-nums ${isOverdue ? "text-destructive" : ""}`}>
                  {new Date(task.endDate).toLocaleDateString("pt-BR")}
                </span>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-muted-foreground">Progresso</span>
                  <span className={`font-medium tabular-nums ${hoursProgress > 100 ? "text-destructive" : ""}`}>
                    {totalHours}h / {task.estimatedHours}h ({hoursProgress}%)
                  </span>
                </div>
                <Progress value={Math.min(hoursProgress, 100)} className={`h-2 ${hoursProgress > 100 ? "[&>div]:bg-destructive" : ""}`} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* History */}
        <Card className="shadow-sm animate-reveal-up delay-3" style={{ animationFillMode: "backwards" }}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4" /> Histórico de Atividades
              <Badge variant="secondary" className="ml-auto font-mono text-xs">
                Total: {formatDuration(totalHistoryMinutes)}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum registro de atividade ainda.</p>
            ) : (
              <div className="space-y-2">
                {history.map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium">{record.userName}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(record.date + "T00:00:00").toLocaleDateString("pt-BR")} — {record.startTime} → {record.endTime}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium tabular-nums">{formatDuration(record.durationMinutes)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Attachments */}
        <Card className="shadow-sm animate-reveal-up delay-4" style={{ animationFillMode: "backwards" }}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Paperclip className="h-4 w-4" /> Arquivos Anexos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {task.attachments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum arquivo anexado.</p>
            ) : (
              <div className="space-y-1">
                {task.attachments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between p-2 rounded border text-sm">
                    <div>
                      <span className="font-medium">{a.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {new Date(a.uploadedAt).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    <Button variant="ghost" size="sm">Download</Button>
                  </div>
                ))}
              </div>
            )}
            <Button variant="outline" size="sm" className="mt-3 gap-1">
              <Paperclip className="h-3 w-3" /> Anexar arquivo
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
