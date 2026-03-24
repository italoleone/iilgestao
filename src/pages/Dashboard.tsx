import { useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  projects,
  alerts,
  users,
  getActiveProjects,
  getProjectCost,
  getUserById,
} from "@/data/mockData";
import {
  DISCIPLINE_SHORT,
  STATUS_LABELS,
  type Discipline,
  type ProjectStatus,
} from "@/types";
import {
  FolderKanban,
  AlertTriangle,
  Clock,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const statusColors: Record<ProjectStatus, string> = {
  em_andamento: "bg-info text-info-foreground",
  concluido: "bg-success text-success-foreground",
  atrasado: "bg-destructive text-destructive-foreground",
  pausado: "bg-muted text-muted-foreground",
};

const disciplineColors: Record<Discipline, string> = {
  estrutural: "hsl(0, 0%, 25%)",
  hidraulica: "hsl(200, 60%, 40%)",
  eletrica: "hsl(64, 88%, 44%)",
};

export default function Dashboard() {
  const navigate = useNavigate();
  const activeProjects = getActiveProjects();
  const lateProjects = projects.filter((p) => p.status === "atrasado");
  const totalHoursWorked = projects.reduce((s, p) => s + p.hoursWorked, 0);
  const totalSaleValue = projects.reduce((s, p) => s + p.saleValue, 0);

  const projectsByDiscipline = useMemo(() => {
    const counts: Record<string, number> = { estrutural: 0, hidraulica: 0, eletrica: 0 };
    projects.forEach((p) => { counts[p.discipline]++; });
    return Object.entries(counts).map(([key, value]) => ({
      name: DISCIPLINE_SHORT[key as Discipline],
      value,
      color: disciplineColors[key as Discipline],
    }));
  }, []);

  const hoursChart = useMemo(() => {
    return projects
      .filter((p) => p.status !== "concluido")
      .map((p) => ({
        name: p.name.length > 20 ? p.name.slice(0, 20) + "…" : p.name,
        vendidas: p.hoursSold,
        realizadas: p.hoursWorked,
      }));
  }, []);

  const highAlerts = alerts.filter((a) => a.severity === "high");

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="animate-reveal-up" style={{ animationFillMode: "backwards" }}>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Visão geral da operação</p>
        </div>

        {/* Alert banner */}
        {highAlerts.length > 0 && (
          <div
            className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 animate-reveal-up delay-1"
            style={{ animationFillMode: "backwards" }}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Atenção necessária</p>
                {highAlerts.map((a) => (
                  <p key={a.id} className="text-sm text-muted-foreground">
                    {a.message}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              title: "Projetos Ativos",
              value: activeProjects.length,
              sub: `${lateProjects.length} atrasado(s)`,
              icon: FolderKanban,
              accent: lateProjects.length > 0,
            },
            {
              title: "Horas Realizadas",
              value: totalHoursWorked.toLocaleString("pt-BR"),
              sub: `R$ ${totalSaleValue.toLocaleString("pt-BR")} vendidos`,
              icon: Clock,
            },
            {
              title: "Equipe Ativa",
              value: users.length,
              sub: `3 disciplinas`,
              icon: TrendingUp,
            },
            {
              title: "Alertas",
              value: alerts.length,
              sub: `${highAlerts.length} crítico(s)`,
              icon: AlertTriangle,
              accent: highAlerts.length > 0,
            },
          ].map((kpi, i) => (
            <Card
              key={kpi.title}
              className="animate-reveal-up shadow-sm hover:shadow-md transition-shadow"
              style={{ animationDelay: `${(i + 2) * 60}ms`, animationFillMode: "backwards" }}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {kpi.title}
                </CardTitle>
                <kpi.icon className={`h-4 w-4 ${kpi.accent ? "text-destructive" : "text-muted-foreground"}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums">{kpi.value}</div>
                <p className={`text-xs mt-1 ${kpi.accent ? "text-destructive" : "text-muted-foreground"}`}>
                  {kpi.sub}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Hours chart */}
          <Card
            className="lg:col-span-2 shadow-sm animate-reveal-up"
            style={{ animationDelay: "360ms", animationFillMode: "backwards" }}
          >
            <CardHeader>
              <CardTitle className="text-base">Horas por Projeto</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hoursChart} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid hsl(var(--border))",
                        fontSize: 13,
                      }}
                    />
                    <Bar dataKey="vendidas" name="Vendidas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="realizadas" name="Realizadas" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Discipline pie */}
          <Card
            className="shadow-sm animate-reveal-up"
            style={{ animationDelay: "420ms", animationFillMode: "backwards" }}
          >
            <CardHeader>
              <CardTitle className="text-base">Por Disciplina</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={projectsByDiscipline}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {projectsByDiscipline.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 mt-2">
                {projectsByDiscipline.map((d) => (
                  <div key={d.name} className="flex items-center gap-1.5 text-xs">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                    {d.name}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active projects table */}
        <Card
          className="shadow-sm animate-reveal-up"
          style={{ animationDelay: "480ms", animationFillMode: "backwards" }}
        >
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Projetos Ativos</CardTitle>
            <button
              onClick={() => navigate("/projetos")}
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              Ver todos <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Projeto</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Cliente</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Disciplina</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Prazo</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Progresso</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {activeProjects.map((p) => {
                    const completedStages = p.stages.filter((s) => s.status === "concluido").length;
                    const progress = Math.round((completedStages / p.stages.length) * 100);
                    const responsible = getUserById(p.responsible);

                    return (
                      <tr
                        key={p.id}
                        className="border-b last:border-0 hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => navigate(`/projetos/${p.id}`)}
                      >
                        <td className="py-3 px-2">
                          <div>
                            <p className="font-medium">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{responsible?.name}</p>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-muted-foreground">{p.client}</td>
                        <td className="py-3 px-2">
                          <span
                            className="inline-block h-2 w-2 rounded-full mr-1.5"
                            style={{ backgroundColor: disciplineColors[p.discipline] }}
                          />
                          {DISCIPLINE_SHORT[p.discipline]}
                        </td>
                        <td className="py-3 px-2 tabular-nums text-muted-foreground">
                          {new Date(p.deadline).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="py-3 px-2 w-32">
                          <div className="flex items-center gap-2">
                            <Progress value={progress} className="h-1.5 flex-1" />
                            <span className="text-xs tabular-nums text-muted-foreground">{progress}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <Badge variant="secondary" className={statusColors[p.status]}>
                            {STATUS_LABELS[p.status]}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
