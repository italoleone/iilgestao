import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { projects, users, getProjectCost, getUserById } from "@/data/mockData";
import { DISCIPLINE_SHORT, type Discipline } from "@/types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";

export default function Financeiro() {
  const projectFinancials = projects.map((p) => {
    const cost = getProjectCost(p);
    const revenue = p.saleValue;
    const profit = revenue - cost;
    return { ...p, cost, revenue, profit };
  });

  const totalRevenue = projectFinancials.reduce((s, p) => s + p.revenue, 0);
  const totalCost = projectFinancials.reduce((s, p) => s + p.cost, 0);
  const totalProfit = totalRevenue - totalCost;

  const byDiscipline = (["estrutural", "hidraulica", "eletrica"] as Discipline[]).map((d) => {
    const dProjects = projectFinancials.filter((p) => p.discipline === d);
    const rev = dProjects.reduce((s, p) => s + p.revenue, 0);
    const cost = dProjects.reduce((s, p) => s + p.cost, 0);
    return {
      name: DISCIPLINE_SHORT[d],
      receita: rev,
      custo: cost,
      resultado: rev - cost,
    };
  });

  const ranked = [...projectFinancials].sort((a, b) => b.profit - a.profit);

  const costByUser = users.map((u) => {
    const total = projects.reduce((sum, p) => {
      if (!p.team.includes(u.id)) return sum;
      const hours = p.stages
        .filter((s) => s.responsible === u.id)
        .reduce((h, s) => h + s.hoursSpent, 0);
      return sum + hours * u.costPerHour;
    }, 0);
    return { name: u.name.split(" ")[0], custo: total };
  }).filter((u) => u.custo > 0).sort((a, b) => b.custo - a.custo);

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="animate-reveal-up" style={{ animationFillMode: "backwards" }}>
          <h1 className="text-2xl font-bold">Financeiro</h1>
          <p className="text-muted-foreground mt-1">Visão financeira dos projetos</p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { title: "Receita Total", value: totalRevenue, icon: DollarSign },
            { title: "Custo Total", value: totalCost, icon: TrendingDown },
            { title: "Resultado", value: totalProfit, icon: TrendingUp },
          ].map((kpi, i) => (
            <Card
              key={kpi.title}
              className="shadow-sm animate-reveal-up"
              style={{ animationDelay: `${(i + 1) * 60}ms`, animationFillMode: "backwards" }}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.title}</CardTitle>
                <kpi.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold tabular-nums ${kpi.title === "Resultado" ? (kpi.value >= 0 ? "text-success" : "text-destructive") : ""}`}>
                  R$ {kpi.value.toLocaleString("pt-BR")}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Chart by discipline */}
        <Card className="shadow-sm animate-reveal-up delay-3" style={{ animationFillMode: "backwards" }}>
          <CardHeader>
            <CardTitle className="text-base">Resultado por Disciplina</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byDiscipline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString("pt-BR")}`} />
                  <Bar dataKey="receita" name="Receita" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="custo" name="Custo" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Ranking + Cost by user */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-sm animate-reveal-up delay-4" style={{ animationFillMode: "backwards" }}>
            <CardHeader>
              <CardTitle className="text-base">Ranking de Projetos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {ranked.map((p, i) => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-muted-foreground w-6">#{i + 1}</span>
                      <div>
                        <p className="text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{DISCIPLINE_SHORT[p.discipline]}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-semibold tabular-nums ${p.profit >= 0 ? "text-success" : "text-destructive"}`}>
                      {p.profit >= 0 ? "+" : ""}R$ {p.profit.toLocaleString("pt-BR")}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm animate-reveal-up delay-5" style={{ animationFillMode: "backwards" }}>
            <CardHeader>
              <CardTitle className="text-base">Custo por Colaborador</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={costByUser} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={80} />
                    <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString("pt-BR")}`} />
                    <Bar dataKey="custo" name="Custo" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
