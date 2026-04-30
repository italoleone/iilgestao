import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProjectCombobox } from "@/components/ProjectCombobox";
import { useProjects, useTasks, useActiveProfiles, useTimeEntries, getProfileById } from "@/hooks/useSupabaseData";
import { useActiveTimers, getTimerForTask } from "@/hooks/useActiveTimers";
import { useAuth } from "@/contexts/AuthContext";
import {
  AlertTriangle, Clock, CheckCircle2, Play, Radio, TrendingUp, Users, BarChart3, Timer, CalendarClock, Zap, CalendarCheck, Filter, History, ChevronDown, ChevronRight, FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell,
} from "recharts";

function daysFromNow(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function startOfWeek() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d;
}

export default function DashboardPlanejamento() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { projects } = useProjects();
  const { tasks } = useTasks();
  const { profiles } = useActiveProfiles();
  const { activeTimers } = useActiveTimers();
  const { entries: allTimeEntries } = useTimeEntries();

  const [filterDiscipline, setFilterDiscipline] = useState<string>("all");
  const [filterProject, setFilterProject] = useState<string>("all");

  const projectMap = useMemo(() => {
    const m: Record<string, string> = {};
    projects.forEach(p => { m[p.id] = p.name; });
    return m;
  }, [projects]);

  const profileMap = useMemo(() => {
    const m: Record<string, string> = {};
    profiles.forEach(p => { m[p.id] = p.name; });
    return m;
  }, [profiles]);

  // Get unique disciplines from tasks
  const disciplines = useMemo(() => {
    const set = new Set(tasks.map(t => t.discipline));
    return Array.from(set).sort();
  }, [tasks]);

  // Base filter: role-based. Validação usa vínculo direto task → project → responsible.
  const roleFilteredTasks = useMemo(() => {
    if (!profile) return tasks;

    const myProjectIds = new Set(
      projects.filter(p => p.responsible === profile.id).map(p => p.id)
    );

    if (profile.role === "coordenador") {
      return tasks.filter(t => myProjectIds.has(t.projectId));
    }

    if (profile.role === "planejamento") {
      return tasks.filter(t => t.status !== "aguardando_validacao" || myProjectIds.has(t.projectId));
    }

    return tasks;
  }, [tasks, profile, projects]);

  // Apply user-selected filters on top
  const filteredTasks = useMemo(() => {
    let result = roleFilteredTasks;
    if (filterDiscipline !== "all") {
      result = result.filter(t => t.discipline === filterDiscipline);
    }
    if (filterProject !== "all") {
      result = result.filter(t => t.projectId === filterProject);
    }
    return result;
  }, [roleFilteredTasks, filterDiscipline, filterProject]);

  const now = new Date();
  const weekStart = startOfWeek();

  // Status que NÃO contam como atrasado/pendente, independentemente da data
  const CLOSED_STATUSES = ["concluida", "enviado_cliente", "aprovada", "cancelada"];

  // 1. Overdue tasks
  const overdueTasks = useMemo(() =>
    filteredTasks.filter(t => {
      const d = daysFromNow(t.endDate);
      return d !== null && d < 0 && !CLOSED_STATUSES.includes(t.status);
    }).sort((a, b) => (daysFromNow(a.endDate) ?? 0) - (daysFromNow(b.endDate) ?? 0)),
    [filteredTasks]
  );

  // Due today
  const dueTodayTasks = useMemo(() =>
    filteredTasks.filter(t => {
      const d = daysFromNow(t.endDate);
      return d !== null && d === 0 && !CLOSED_STATUSES.includes(t.status);
    }),
    [filteredTasks]
  );

  // 2. Due within 15 days (exclude today)
  const dueSoonTasks = useMemo(() =>
    filteredTasks.filter(t => {
      const d = daysFromNow(t.endDate);
      return d !== null && d > 0 && d <= 15 && !["aprovada", "concluida"].includes(t.status);
    }).sort((a, b) => (daysFromNow(a.endDate) ?? 0) - (daysFromNow(b.endDate) ?? 0)),
    [filteredTasks]
  );

  // 3. Starting within 7 days
  const startingSoonTasks = useMemo(() =>
    filteredTasks.filter(t => {
      const d = daysFromNow(t.startDate);
      return d !== null && d >= 0 && d <= 7;
    }).sort((a, b) => (daysFromNow(a.startDate) ?? 0) - (daysFromNow(b.startDate) ?? 0)),
    [filteredTasks]
  );

  // 4. Active timers
  const activeTaskIds = useMemo(() => new Set(activeTimers.map(t => t.task_id)), [activeTimers]);
  const activeTasks = useMemo(() =>
    tasks.filter(t => activeTaskIds.has(t.id)),
    [tasks, activeTaskIds]
  );

  // 5. Week stats
  const weekTasks = useMemo(() =>
    filteredTasks.filter(t => {
      if (!t.startDate && !t.endDate) return false;
      const sd = t.startDate ? new Date(t.startDate) : null;
      const ed = t.endDate ? new Date(t.endDate) : null;
      return (ed && ed >= weekStart) || (sd && sd >= weekStart);
    }),
    [filteredTasks, weekStart]
  );

  const completedThisWeek = useMemo(() =>
    filteredTasks.filter(t => ["aprovada", "concluida"].includes(t.status)),
    [filteredTasks]
  );

  // 6. Productivity per user (hours this week)
  const weekEntries = useMemo(() =>
    allTimeEntries.filter(e => new Date(e.date) >= weekStart),
    [allTimeEntries, weekStart]
  );

  const userProductivity = useMemo(() => {
    const map: Record<string, { name: string; minutes: number }> = {};
    weekEntries.forEach(e => {
      if (!map[e.user_id]) map[e.user_id] = { name: e.user_name, minutes: 0 };
      map[e.user_id].minutes += e.duration_minutes;
    });
    return Object.values(map)
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 10);
  }, [weekEntries]);

  // 7. Tasks per user (workload)
  const userWorkload = useMemo(() => {
    const map: Record<string, { name: string; count: number }> = {};
    filteredTasks
      .filter(t => !["aprovada", "concluida"].includes(t.status))
      .forEach(t => {
        const name = profileMap[t.responsible] || "—";
        if (!map[t.responsible]) map[t.responsible] = { name, count: 0 };
        map[t.responsible].count++;
      });
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [filteredTasks, profileMap]);

  // 8. Bottlenecks by discipline
  const disciplineBottlenecks = useMemo(() => {
    const map: Record<string, number> = {};
    overdueTasks.forEach(t => {
      map[t.discipline] = (map[t.discipline] || 0) + 1;
    });
    return Object.entries(map)
      .map(([disc, count]) => ({ discipline: disc, count }))
      .sort((a, b) => b.count - a.count);
  }, [overdueTasks]);

  // 9. Approval rate
  const approvalStats = useMemo(() => {
    const approved = filteredTasks.filter(t => t.status === "aprovada").length;
    const rejected = filteredTasks.filter(t => t.status === "reprovada").length;
    const total = approved + rejected;
    return {
      approved,
      rejected,
      rate: total > 0 ? Math.round((approved / total) * 100) : 0,
    };
  }, [filteredTasks]);

  // 10. Efficiency (estimated vs actual)
  const efficiencyData = useMemo(() => {
    return filteredTasks
      .filter(t => t.hoursWorked > 0 && t.estimatedHours > 0)
      .map(t => ({
        name: t.name.length > 20 ? t.name.slice(0, 20) + "…" : t.name,
        estimado: Number(t.estimatedHours),
        real: Number(t.hoursWorked),
        exceeded: Number(t.hoursWorked) > Number(t.estimatedHours),
      }))
      .sort((a, b) => (b.real / b.estimado) - (a.real / a.estimado))
      .slice(0, 8);
  }, [filteredTasks]);

  const chartColors = {
    primary: "hsl(var(--primary))",
    destructive: "hsl(var(--destructive))",
    success: "hsl(142 76% 36%)",
    warning: "hsl(38 92% 50%)",
    muted: "hsl(var(--muted-foreground))",
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">Dashboard de Planejamento</h1>
            <p className="text-sm text-muted-foreground">Visão operacional de tarefas e produtividade</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filterDiscipline} onValueChange={setFilterDiscipline}>
                <SelectTrigger className="w-[160px] h-9 text-sm">
                  <SelectValue placeholder="Disciplina" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas disciplinas</SelectItem>
                  {disciplines.map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ProjectCombobox
              projects={projects}
              value={filterProject}
              onValueChange={setFilterProject}
              includeAll
              placeholder="Projeto"
              triggerClassName="w-[200px] h-9 text-sm"
            />
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold text-destructive">{overdueTasks.length}</p>
                <p className="text-xs text-muted-foreground">Atrasadas</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <CalendarCheck className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-warning">{dueTodayTasks.length}</p>
                <p className="text-xs text-muted-foreground">Vencem hoje</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-success/30 bg-success/5">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <Play className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-success">{activeTasks.length}</p>
                <p className="text-xs text-muted-foreground">Em execução</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <CalendarClock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{weekTasks.length}</p>
                <p className="text-xs text-muted-foreground">Tarefas da semana</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-success/30">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{completedThisWeek.length}</p>
                <p className="text-xs text-muted-foreground">Concluídas</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active tasks in real-time */}
        {activeTasks.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Radio className="h-4 w-4 text-success animate-pulse" />
                Em Execução Agora
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {activeTasks.map(task => {
                  const timers = getTimerForTask(activeTimers, task.id);
                  return (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-success/5 border border-success/20 cursor-pointer hover:bg-success/10 transition-colors"
                      onClick={() => navigate(`/tarefas/${task.id}`)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{task.name}</p>
                        <p className="text-xs text-muted-foreground">{projectMap[task.projectId] || "—"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {timers.map(t => (
                          <Badge key={t.id} variant="outline" className="bg-success/10 text-success animate-pulse text-xs">
                            <Radio className="h-3 w-3 mr-1" />
                            {t.user_name.split(" ")[0]}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Due Today */}
        <Card className="border-warning/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-warning" />
              Tarefas com Entrega Hoje
              <Badge variant="outline" className="ml-auto border-warning/50 text-warning">{dueTodayTasks.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dueTodayTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma tarefa vence hoje</p>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
                {dueTodayTasks.map(task => (
                  <div
                    key={task.id}
                    className="p-3 rounded-lg border border-warning/20 bg-warning/5 cursor-pointer hover:bg-warning/10 transition-colors"
                    onClick={() => navigate(`/tarefas/${task.id}`)}
                  >
                    <p className="text-sm font-medium truncate">{task.name}</p>
                    <p className="text-xs text-muted-foreground">{projectMap[task.projectId] || "—"}</p>
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-xs text-muted-foreground">{profileMap[task.responsible] || "—"}</p>
                      <Badge variant="outline" className="text-xs">{task.discipline}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Overdue + Due Soon side by side */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Overdue */}
          <Card className="border-destructive/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Tarefas Atrasadas
                <Badge variant="destructive" className="ml-auto">{overdueTasks.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {overdueTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma tarefa atrasada 🎉</p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {overdueTasks.map(task => (
                    <div
                      key={task.id}
                      className="p-3 rounded-lg border border-destructive/20 bg-destructive/5 cursor-pointer hover:bg-destructive/10 transition-colors"
                      onClick={() => navigate(`/tarefas/${task.id}`)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{task.name}</p>
                          <p className="text-xs text-muted-foreground">{projectMap[task.projectId] || "—"}</p>
                          <p className="text-xs text-muted-foreground">{profileMap[task.responsible] || "—"}</p>
                        </div>
                        <Badge variant="destructive" className="text-xs shrink-0">
                          {Math.abs(daysFromNow(task.endDate))}d atraso
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Due Soon */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-warning" />
                A Vencer (15 dias)
                <Badge variant="outline" className="ml-auto">{dueSoonTasks.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dueSoonTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma tarefa próxima do vencimento</p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {dueSoonTasks.map(task => (
                    <div
                      key={task.id}
                      className="p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => navigate(`/tarefas/${task.id}`)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{task.name}</p>
                          <p className="text-xs text-muted-foreground">{profileMap[task.responsible] || "—"}</p>
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {daysFromNow(task.endDate)}d restantes
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Starting soon */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              A Iniciar (7 dias)
              <Badge variant="outline" className="ml-auto">{startingSoonTasks.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {startingSoonTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma tarefa para iniciar nos próximos 7 dias</p>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
                {startingSoonTasks.map(task => (
                  <div
                    key={task.id}
                    className="p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => navigate(`/tarefas/${task.id}`)}
                  >
                    <p className="text-sm font-medium truncate">{task.name}</p>
                    <p className="text-xs text-muted-foreground">{projectMap[task.projectId] || "—"}</p>
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-xs text-muted-foreground">{profileMap[task.responsible] || "—"}</p>
                      <Badge variant="outline" className="text-xs">
                        {daysFromNow(task.startDate) === 0 ? "Hoje" : `em ${daysFromNow(task.startDate)}d`}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Charts Row */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Productivity Ranking */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Produtividade da Semana (horas)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {userProductivity.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Sem registros esta semana</p>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={userProductivity} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={100}
                      tick={{ fontSize: 11 }}
                      tickFormatter={v => v.split(" ")[0]}
                    />
                    <Tooltip
                      formatter={(v: number) => [`${(v / 60).toFixed(1)}h`, "Horas"]}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Bar dataKey="minutes" radius={[0, 4, 4, 0]}>
                      {userProductivity.map((_, i) => (
                        <Cell key={i} fill={i === 0 ? chartColors.success : chartColors.primary} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Workload */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Carga por Usuário (tarefas ativas)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {userWorkload.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Sem tarefas ativas</p>
              ) : (
                <div className="space-y-3">
                  {userWorkload.map((u, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="truncate">{u.name}</span>
                        <span className="font-medium">{u.count}</span>
                      </div>
                      <Progress
                        value={Math.min((u.count / Math.max(...userWorkload.map(w => w.count))) * 100, 100)}
                        className="h-2"
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Efficiency + Bottlenecks + Approval */}
        <div className="grid md:grid-cols-3 gap-4">
          {/* Bottlenecks by discipline */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-destructive" />
                Gargalos por Disciplina
              </CardTitle>
            </CardHeader>
            <CardContent>
              {disciplineBottlenecks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Sem gargalos identificados</p>
              ) : (
                <div className="space-y-3">
                  {disciplineBottlenecks.map((d, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-destructive/5">
                      <span className="text-sm font-medium">{d.discipline}</span>
                      <Badge variant="destructive">{d.count} atrasadas</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Approval rate */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Taxa de Aprovação
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-4 gap-3">
              <div className="relative w-24 h-24">
                <svg className="w-24 h-24 -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="stroke-muted"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none" strokeWidth="3"
                  />
                  <path
                    className="stroke-success"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none" strokeWidth="3"
                    strokeDasharray={`${approvalStats.rate}, 100`}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-lg font-bold">
                  {approvalStats.rate}%
                </span>
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>✅ {approvalStats.approved} aprovadas</span>
                <span>❌ {approvalStats.rejected} reprovadas</span>
              </div>
            </CardContent>
          </Card>

          {/* Efficiency */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Timer className="h-4 w-4 text-warning" />
                Eficiência (Estimado vs Real)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {efficiencyData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Sem dados de eficiência</p>
              ) : (
                <div className="space-y-2 max-h-[250px] overflow-y-auto">
                  {efficiencyData.map((d, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="truncate max-w-[120px]">{d.name}</span>
                        <span className={d.exceeded ? "text-destructive font-medium" : "text-muted-foreground"}>
                          {d.real.toFixed(1)}h / {d.estimado.toFixed(1)}h
                        </span>
                      </div>
                      <div className="flex gap-1 h-2">
                        <div
                          className="rounded-sm bg-primary"
                          style={{ width: `${Math.min((d.estimado / Math.max(d.estimado, d.real)) * 100, 100)}%` }}
                        />
                        <div
                          className={`rounded-sm ${d.exceeded ? "bg-destructive" : "bg-success"}`}
                          style={{ width: `${Math.min((d.real / Math.max(d.estimado, d.real)) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <ProjectWorkHistoryBlock
          allTimeEntries={allTimeEntries}
          tasks={tasks}
          projects={projects}
        />
      </div>
    </AppLayout>
  );
}

// ============================================================
// Histórico de Projetos Trabalhados
// ============================================================
type HistEntry = { id: string; task_id: string; project_id: string; user_name: string; date: string; start_time: string; duration_minutes: number };

function ProjectWorkHistoryBlock({
  allTimeEntries,
  tasks,
  projects,
}: {
  allTimeEntries: HistEntry[];
  tasks: { id: string; name: string; projectId: string }[];
  projects: { id: string; name: string }[];
}) {
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  const [mode, setMode] = useState<"day" | "month">("day");
  const [day, setDay] = useState<string>(todayStr);
  const [month, setMonth] = useState<number>(today.getMonth() + 1);
  const [year, setYear] = useState<number>(today.getFullYear());
  const [discipline, setDiscipline] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const DISCIPLINES = ["Estrutural", "Hidráulica", "Elétrica", "Fundações"];

  const taskMap = useMemo(() => {
    const m: Record<string, { name: string; projectId: string }> = {};
    tasks.forEach((t) => { m[t.id] = { name: t.name, projectId: t.projectId }; });
    return m;
  }, [tasks]);

  const projectMap = useMemo(() => {
    const m: Record<string, string> = {};
    projects.forEach((p) => { m[p.id] = p.name; });
    return m;
  }, [projects]);

  const detectDiscipline = (projectName: string): string | null => {
    const lower = projectName.toLowerCase();
    for (const d of DISCIPLINES) {
      if (lower.includes(d.toLowerCase())) return d;
    }
    return null;
  };

  const periodFiltered = useMemo(() => {
    return allTimeEntries.filter((e) => {
      if (!e.date) return false;
      if (mode === "day") return e.date === day;
      const [y, mo] = e.date.split("-").map(Number);
      return y === year && mo === month;
    });
  }, [allTimeEntries, mode, day, month, year]);

  const usersInPeriod = useMemo(() => {
    const set = new Set<string>();
    periodFiltered.forEach((e) => { if (e.user_name) set.add(e.user_name); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [periodFiltered]);

  const filtered = useMemo(() => {
    return periodFiltered.filter((e) => {
      if (userFilter !== "all" && e.user_name !== userFilter) return false;
      if (discipline !== "all") {
        const t = taskMap[e.task_id];
        const pname = t ? projectMap[t.projectId] || "" : "";
        if (detectDiscipline(pname) !== discipline) return false;
      }
      return true;
    });
  }, [periodFiltered, userFilter, discipline, taskMap, projectMap]);

  const grouped = useMemo(() => {
    const byProject: Record<string, { totalMin: number; taskIds: Set<string>; entries: HistEntry[] }> = {};
    filtered.forEach((e) => {
      const t = taskMap[e.task_id];
      const pid = t?.projectId || "unknown";
      if (!byProject[pid]) byProject[pid] = { totalMin: 0, taskIds: new Set(), entries: [] };
      byProject[pid].totalMin += e.duration_minutes || 0;
      byProject[pid].taskIds.add(e.task_id);
      byProject[pid].entries.push(e);
    });
    return Object.entries(byProject)
      .map(([pid, v]) => ({
        projectId: pid,
        projectName: projectMap[pid] || "Projeto desconhecido",
        totalMin: v.totalMin,
        taskCount: v.taskIds.size,
        entries: v.entries,
      }))
      .sort((a, b) => b.totalMin - a.totalMin);
  }, [filtered, taskMap, projectMap]);

  const periodLabel = mode === "day"
    ? day
    : `${String(month).padStart(2, "0")}-${year}`;

  const handleExport = () => {
    const rows: Record<string, string | number>[] = [];
    grouped.forEach((g) => {
      const disc = detectDiscipline(g.projectName) || "";
      g.entries
        .slice()
        .sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time))
        .forEach((e) => {
          const tn = taskMap[e.task_id]?.name || "Tarefa removida";
          rows.push({
            Projeto: g.projectName,
            Disciplina: disc,
            Tarefa: tn,
            "Usuário": e.user_name || "",
            Horas: Number(((e.duration_minutes || 0) / 60).toFixed(2)),
            "Data/Período": mode === "day" ? `${e.date}${e.start_time ? " " + e.start_time : ""}` : e.date,
          });
        });
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Histórico");
    XLSX.writeFile(wb, `historico-projetos-${periodLabel}.xlsx`);
  };

  const fmtH = (min: number) => `${(min / 60).toFixed(1)}h`;

  const years = useMemo(() => {
    const cy = new Date().getFullYear();
    return [cy - 2, cy - 1, cy, cy + 1];
  }, []);
  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];

  return (
    <Card className="mt-6">
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          Histórico de Projetos Trabalhados
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={grouped.length === 0}
          className="h-8 text-xs gap-1.5"
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          Exportar Excel
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="inline-flex rounded-md border bg-muted p-0.5">
            <button
              onClick={() => setMode("day")}
              className={`px-3 py-1 text-xs rounded ${mode === "day" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
            >
              Dia específico
            </button>
            <button
              onClick={() => setMode("month")}
              className={`px-3 py-1 text-xs rounded ${mode === "month" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
            >
              Mês
            </button>
          </div>

          {mode === "day" ? (
            <Input
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="w-auto h-8 text-xs"
            />
          ) : (
            <div className="flex gap-2">
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {months.map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="h-8 w-[100px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {grouped.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum lançamento de horas no período selecionado.
          </p>
        ) : (
          <div className="space-y-2">
            {grouped.map((g) => {
              const isOpen = !!expanded[g.projectId];
              // group entries by task
              const byTask: Record<string, { taskName: string; entries: HistEntry[]; totalMin: number }> = {};
              g.entries.forEach((e) => {
                const tn = taskMap[e.task_id]?.name || "Tarefa removida";
                if (!byTask[e.task_id]) byTask[e.task_id] = { taskName: tn, entries: [], totalMin: 0 };
                byTask[e.task_id].entries.push(e);
                byTask[e.task_id].totalMin += e.duration_minutes || 0;
              });
              const taskRows = Object.entries(byTask).sort((a, b) => b[1].totalMin - a[1].totalMin);

              return (
                <div key={g.projectId} className="border rounded-md">
                  <button
                    onClick={() => setExpanded((p) => ({ ...p, [g.projectId]: !p[g.projectId] }))}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                      <span className="font-medium text-sm truncate">{g.projectName}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                      <span>{g.taskCount} {g.taskCount === 1 ? "tarefa" : "tarefas"}</span>
                      <Badge variant="secondary" className="font-mono">{fmtH(g.totalMin)}</Badge>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="border-t bg-muted/30 px-3 py-2 space-y-2">
                      {taskRows.map(([tid, tv]) => (
                        <div key={tid} className="text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium truncate">{tv.taskName}</span>
                            <Badge variant="outline" className="font-mono shrink-0">{fmtH(tv.totalMin)}</Badge>
                          </div>
                          <div className="mt-1 ml-2 space-y-0.5 text-muted-foreground">
                            {tv.entries
                              .sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time))
                              .map((e) => (
                                <div key={e.id} className="flex items-center justify-between gap-2">
                                  <span className="truncate">
                                    {e.user_name || "—"}
                                    {mode === "day" && e.start_time ? ` · ${e.start_time}` : ` · ${e.date}`}
                                  </span>
                                  <span className="font-mono">{fmtH(e.duration_minutes || 0)}</span>
                                </div>
                              ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
