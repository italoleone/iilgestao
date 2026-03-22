import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { projects, currentUser, getUserById } from "@/data/mockData";
import { Play, Square, Clock } from "lucide-react";

interface ActiveTimer {
  projectId: string;
  stageId: string;
  startTime: Date;
}

export default function Horas() {
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedStage, setSelectedStage] = useState("");

  const userProjects = projects.filter(
    (p) => p.team.includes(currentUser.id) && p.status !== "concluido"
  );

  const selectedProjectData = projects.find((p) => p.id === selectedProject);
  const availableStages = selectedProjectData?.stages.filter(
    (s) => s.status !== "concluido"
  ) || [];

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
    if (!selectedProject || !selectedStage) return;
    setActiveTimer({
      projectId: selectedProject,
      stageId: selectedStage,
      startTime: new Date(),
    });
    setElapsed(0);
  };

  const stopTimer = () => {
    setActiveTimer(null);
    setElapsed(0);
  };

  // Mock recent entries
  const recentEntries = [
    { project: "Edifício Panorama Tower", stage: "Executivo", duration: "2h 34min", date: "22/03/2026" },
    { project: "Galpão Industrial Progresso", stage: "Estudo Preliminar", duration: "4h 12min", date: "21/03/2026" },
    { project: "Edifício Panorama Tower", stage: "Executivo", duration: "3h 48min", date: "21/03/2026" },
    { project: "Galpão Industrial Progresso", stage: "Estudo Preliminar", duration: "1h 55min", date: "20/03/2026" },
    { project: "Edifício Panorama Tower", stage: "Pré-executivo", duration: "5h 20min", date: "20/03/2026" },
  ];

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="animate-reveal-up" style={{ animationFillMode: "backwards" }}>
          <h1 className="text-2xl font-bold">Controle de Horas</h1>
          <p className="text-muted-foreground mt-1">Registre suas atividades</p>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select
                    value={selectedProject}
                    onChange={(e) => {
                      setSelectedProject(e.target.value);
                      setSelectedStage("");
                    }}
                    className="h-10 rounded-md border bg-card px-3 text-sm w-full"
                  >
                    <option value="">Selecione o projeto</option>
                    {userProjects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <select
                    value={selectedStage}
                    onChange={(e) => setSelectedStage(e.target.value)}
                    className="h-10 rounded-md border bg-card px-3 text-sm w-full"
                    disabled={!selectedProject}
                  >
                    <option value="">Selecione a etapa</option>
                    {availableStages.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <Button
                  onClick={startTimer}
                  disabled={!selectedProject || !selectedStage}
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
                    {projects.find((p) => p.id === activeTimer.projectId)?.name} ·{" "}
                    {selectedProjectData?.stages.find((s) => s.id === activeTimer.stageId)?.name}
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
                    <p className="text-sm font-medium">{entry.project}</p>
                    <p className="text-xs text-muted-foreground">{entry.stage}</p>
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
