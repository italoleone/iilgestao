import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectCombobox } from "@/components/ProjectCombobox";
import { useProjects, useActiveProfiles, getProfileById, useTimeEntries, useTasks } from "@/hooks/useSupabaseData";
import { DISCIPLINE_SHORT, type Discipline } from "@/types";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { TrendingUp, TrendingDown, DollarSign, Loader2, Percent, Clock } from "lucide-react";
import { formatBRL } from "@/lib/utils";

export default function Financeiro() {
  const { projects, loading } = useProjects();
  const { profiles } = useActiveProfiles();
  const { entries: allTimeEntries } = useTimeEntries();
  const { tasks } = useTasks();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");

  // Calculate real cost per project based on time_entries × user cost_per_hour
  const projectFinancials = useMemo(() => projects.map(p => {
    const projectEntries = allTimeEntries.filter(e => e.project_id === p.id);
    const cost = projectEntries.reduce((sum, entry) => {
      const userProfile = getProfileById(profiles, entry.user_id);
      const costPerHour = userProfile?.cost_per_hour || 0;
      return sum + (entry.duration_minutes / 60) * costPerHour;
    }, 0);
    const revenue = p.saleValue;
    return { ...p, cost, revenue, profit: revenue - cost, entries: projectEntries };
  }), [projects, profiles, allTimeEntries]);

  // Filtered data
  const isFiltered = selectedProjectId !== "all";
  const filteredFinancials = isFiltered
    ? projectFinancials.filter(p => p.id === selectedProjectId)
    : projectFinancials;

  const totalRevenue = filteredFinancials.reduce((s, p) => s + p.revenue, 0);
  const totalCost = filteredFinancials.reduce((s, p) => s + p.cost, 0);
  const totalProfit = totalRevenue - totalCost;
  const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  const byDiscipline = useMemo(() => (["estrutural", "hidraulica", "eletrica"] as Discipline[]).map(d => {
    const dProjects = filteredFinancials.filter(p => p.discipline === d);
    const rev = dProjects.reduce((s, p) => s + p.revenue, 0);
    const cost = dProjects.reduce((s, p) => s + p.cost, 0);
    return { name: DISCIPLINE_SHORT[d], receita: rev, custo: cost, resultado: rev - cost };
  }), [filteredFinancials]);

  const ranked = useMemo(() => [...filteredFinancials].sort((a, b) => b.profit - a.profit), [filteredFinancials]);

  // Time entries for the selected project with cost calculation
  const selectedProjectEntries = useMemo(() => {
    if (!isFiltered) return [];
    const entries = allTimeEntries.filter(e => e.project_id === selectedProjectId);
    return entries.map(entry => {
      const userProfile = getProfileById(profiles, entry.user_id);
      const costPerHour = userProfile?.cost_per_hour || 0;
      const cost = (entry.duration_minutes / 60) * costPerHour;
      const task = tasks.find(t => t.id === entry.task_id);
      return { ...entry, cost, costPerHour, taskName: task?.name || "—" };
    });
  }, [isFiltered, selectedProjectId, allTimeEntries, profiles, tasks]);

  // Total hours for selected project
  const totalHours = useMemo(() => {
    const totalMinutes = filteredFinancials.reduce((sum, p) => 
      sum + p.entries.reduce((s, e) => s + e.duration_minutes, 0), 0);
    return totalMinutes / 60;
  }, [filteredFinancials]);

  if (loading) {
    return (
      <AppLayout><div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-reveal-up" style={{ animationFillMode: "backwards" }}>
          <div>
            <h1 className="text-2xl font-bold">Financeiro</h1>
            <p className="text-muted-foreground mt-1">Visão financeira dos projetos</p>
          </div>
          <div className="w-full sm:w-72">
            <ProjectCombobox
              projects={projects}
              value={selectedProjectId}
              onValueChange={setSelectedProjectId}
              includeAll
              placeholder="Selecionar Projeto"
            />
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { title: "Receita", value: totalRevenue, icon: DollarSign, color: "" },
            { title: "Custo", value: totalCost, icon: TrendingDown, color: "" },
            { title: "Resultado", value: totalProfit, icon: TrendingUp, color: totalProfit >= 0 ? "text-success" : "text-destructive" },
            { title: "Margem", value: margin, icon: Percent, color: margin >= 0 ? "text-success" : "text-destructive", isPercent: true },
          ].map((kpi, i) => (
            <Card key={kpi.title} className="shadow-sm animate-reveal-up" style={{ animationDelay: `${(i + 1) * 60}ms`, animationFillMode: "backwards" }}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.title}</CardTitle>
                <kpi.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold tabular-nums ${kpi.color}`}>
                  {(kpi as any).isPercent ? `${margin.toFixed(1)}%` : `R$ ${formatBRL(kpi.value)}`}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Hours summary when filtered */}
        {isFiltered && (
          <Card className="shadow-sm animate-reveal-up" style={{ animationFillMode: "backwards" }}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Horas Trabalhadas</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">{totalHours.toFixed(1)}h</div>
              <p className="text-xs text-muted-foreground mt-1">{selectedProjectEntries.length} registro(s)</p>
            </CardContent>
          </Card>
        )}

        {/* Chart */}
        <Card className="shadow-sm animate-reveal-up delay-3" style={{ animationFillMode: "backwards" }}>
          <CardHeader><CardTitle className="text-base">Resultado por Disciplina</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byDiscipline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => `R$ ${formatBRL(v)}`} />
                  <Legend />
                  <Bar dataKey="receita" name="Receita" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="custo" name="Custo" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Ranking (only when "all") */}
        {!isFiltered && (
          <Card className="shadow-sm animate-reveal-up delay-4" style={{ animationFillMode: "backwards" }}>
            <CardHeader><CardTitle className="text-base">Ranking de Projetos</CardTitle></CardHeader>
            <CardContent>
              {ranked.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum projeto cadastrado.</p>
              ) : (
                <div className="space-y-2">
                  {ranked.map((p, i) => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-muted-foreground w-6">#{i + 1}</span>
                        <div><p className="text-sm font-medium">{p.name}</p><p className="text-xs text-muted-foreground">{DISCIPLINE_SHORT[p.discipline]}</p></div>
                      </div>
                      <div className="text-right">
                        <span className={`text-sm font-semibold tabular-nums ${p.profit >= 0 ? "text-success" : "text-destructive"}`}>
                          {p.profit >= 0 ? "+" : ""}R$ {formatBRL(p.profit)}
                        </span>
                        <p className="text-xs text-muted-foreground tabular-nums">Custo: R$ {formatBRL(p.cost)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Time entries detail (only when project selected) */}
        {isFiltered && (
          <Card className="shadow-sm animate-reveal-up delay-4" style={{ animationFillMode: "backwards" }}>
            <CardHeader><CardTitle className="text-base">Registro de Horas</CardTitle></CardHeader>
            <CardContent>
              {selectedProjectEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum registro de horas neste projeto.</p>
              ) : (
                <div className="space-y-2">
                  {selectedProjectEntries.map((entry) => {
                    const hours = Math.floor(entry.duration_minutes / 60);
                    const mins = entry.duration_minutes % 60;
                    const dateFormatted = new Date(entry.date + "T00:00:00").toLocaleDateString("pt-BR");
                    return (
                      <div key={entry.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border gap-2">
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium">{entry.user_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {dateFormatted} — {entry.start_time} → {entry.end_time}
                          </p>
                          <p className="text-xs text-muted-foreground">Tarefa: {entry.taskName}</p>
                        </div>
                        <div className="text-right space-y-0.5">
                          <p className="text-sm font-semibold tabular-nums">
                            {hours > 0 ? `${hours}h` : ""}{mins > 0 ? `${String(mins).padStart(2, "0")}min` : hours > 0 ? "" : "0min"}
                          </p>
                          <p className="text-xs text-muted-foreground tabular-nums">
                            R$ {formatBRL(entry.costPerHour)}/h → R$ {formatBRL(entry.cost)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
