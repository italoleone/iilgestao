import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { projects, tasks, getUserById, users } from "@/data/mockData";
import { useAuth } from "@/contexts/AuthContext";
import { TASK_STATUS_LABELS } from "@/types";
import { Play, Square, Clock } from "lucide-react";
import { startActiveTimer, stopActiveTimer } from "@/hooks/useActiveTimers";

interface ActiveTimer {
  taskId: string;
  projectId: string;
  startTime: Date;
}

export default function Horas() {
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [selectedTask, setSelectedTask] = useState("");
  const { profile } = useAuth();

  // Show all tasks from active projects (user selects which to track)
  const userTasks = tasks.filter(
    (t) =>
      t.status !== "concluida" &&
      projects.find((p) => p.id === t.projectId)?.status !== "concluido"
  );

  const selectedTaskData = tasks.find((t) => t.id === selectedTask);
  const selectedProjectData = selectedTaskData
    ? projects.find((p) => p.id === selectedTaskData.projectId)
    : null;

  useEffect(() => {
    if (!activeTimer) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - activeTimer.startTime.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [activeTimer]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const startTimer = () => {
    if (!selectedTaskData) return;
    setActiveTimer({
      taskId: selectedTaskData.id,
      projectId: selectedTaskData.projectId,
      startTime: new Date(),
    });
    setElapsed(0);
  };

  const stopTimer = () => {
    setActiveTimer(null);
    setElapsed(0);
  };

  // Group recent entries by task
  const recentEntries = [
    { task: "Armação de Lajes do Térreo", project: "Edifício Panorama Tower", stage: "Executivo", duration: "2h 34min", date: "22/03/2026" },
    { task: "Dimensionamento da Rede de Esgoto", project: "Residencial Villa Serena", stage: "Pré-executivo", duration: "4h 12min", date: "21/03/2026" },
    { task: "Armação de Lajes do Térreo", project: "Edifício Panorama Tower", stage: "Executivo", duration: "3h 48min", date: "21/03/2026" },
    { task: "Levantamento de Cargas", project: "Galpão Industrial Progresso", stage: "Estudo Preliminar", duration: "1h 55min", date: "20/03/2026" },
    { task: "Armação de Vigas V1 a V12", project: "Edifício Panorama Tower", stage: "Executivo", duration: "5h 20min", date: "20/03/2026" },
  ];

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="animate-reveal-up" style={{ animationFillMode: "backwards" }}>
          <h1 className="text-2xl font-bold">Controle de Horas</h1>
          <p className="text-muted-foreground mt-1">Registre suas atividades por tarefa</p>
        </div>

        {/* Timer */}
        <Card className="shadow-sm animate-reveal-up delay-1" style={{ animationFillMode: "backwards" }}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" /> Timer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!activeTimer ? (
              <>
                <div>
                  <select
                    value={selectedTask}
                    onChange={(e) => setSelectedTask(e.target.value)}
                    className="h-10 rounded-md border bg-card px-3 text-sm w-full"
                  >
                    <option value="">Selecione a tarefa</option>
                    {userTasks.map((t) => {
                      const p = projects.find((pr) => pr.id === t.projectId);
                      return (
                        <option key={t.id} value={t.id}>
                          {t.name} — {p?.name} ({t.stageName})
                        </option>
                      );
                    })}
                  </select>
                </div>

                {selectedTaskData && (
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-3 bg-muted/50 rounded-lg p-3">
                    <span>Projeto: <strong>{selectedProjectData?.name}</strong></span>
                    <span>Etapa: <strong>{selectedTaskData.stageName}</strong></span>
                    <span>Horas: <strong>{selectedTaskData.hoursWorked}/{selectedTaskData.estimatedHours}h</strong></span>
                  </div>
                )}

                <Button
                  onClick={startTimer}
                  disabled={!selectedTask}
                  className="w-full sm:w-auto gap-2"
                >
                  <Play className="h-4 w-4" /> Iniciar Atividade
                </Button>
              </>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="text-center sm:text-left flex-1">
                  <div className="text-4xl font-bold tabular-nums tracking-tight">
                    {formatTime(elapsed)}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedTaskData?.name} · {selectedProjectData?.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedTaskData?.stageName}
                  </p>
                </div>
                <Button variant="destructive" onClick={stopTimer} className="gap-2">
                  <Square className="h-4 w-4" /> Parar Atividade
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent entries */}
        <Card className="shadow-sm animate-reveal-up delay-2" style={{ animationFillMode: "backwards" }}>
          <CardHeader>
            <CardTitle className="text-base">Registros Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentEntries.map((entry, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">{entry.task}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.project} · {entry.stage}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium tabular-nums">{entry.duration}</p>
                    <p className="text-xs text-muted-foreground">{entry.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
