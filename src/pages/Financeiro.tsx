import { useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useProjects, useActiveProfiles, getProfileById, useTimeEntries } from "@/hooks/useSupabaseData";
import { DISCIPLINE_SHORT, type Discipline } from "@/types";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown, DollarSign, Loader2 } from "lucide-react";
import { formatBRL } from "@/lib/utils";

export default function Financeiro() {
  const { projects, loading } = useProjects();
  const { profiles } = useActiveProfiles();
  const { entries: allTimeEntries } = useTimeEntries();

  // Calculate real cost per project based on time_entries × user cost_per_hour
  const projectFinancials = useMemo(() => projects.map(p => {
    const projectEntries = allTimeEntries.filter(e => e.project_id === p.id);
    const cost = projectEntries.reduce((sum, entry) => {
      const userProfile = getProfileById(profiles, entry.user_id);
      const costPerHour = userProfile?.cost_per_hour || 0;
      return sum + (entry.duration_minutes / 60) * costPerHour;
    }, 0);
    const revenue = p.saleValue;
    return { ...p, cost, revenue, profit: revenue - cost };
  }), [projects, profiles, allTimeEntries]);

  const totalRevenue = projectFinancials.reduce((s, p) => s + p.revenue, 0);
  const totalCost = projectFinancials.reduce((s, p) => s + p.cost, 0);
  const totalProfit = totalRevenue - totalCost;

  const byDiscipline = useMemo(() => (["estrutural", "hidraulica", "eletrica"] as Discipline[]).map(d => {
    const dProjects = projectFinancials.filter(p => p.discipline === d);
    const rev = dProjects.reduce((s, p) => s + p.revenue, 0);
    const cost = dProjects.reduce((s, p) => s + p.cost, 0);
    return { name: DISCIPLINE_SHORT[d], receita: rev, custo: cost, resultado: rev - cost };
  }), [projectFinancials]);

  const ranked = useMemo(() => [...projectFinancials].sort((a, b) => b.profit - a.profit), [projectFinancials]);

  if (loading) {
    return (
      <AppLayout><div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="animate-reveal-up" style={{ animationFillMode: "backwards" }}>
          <h1 className="text-2xl font-bold">Financeiro</h1>
          <p className="text-muted-foreground mt-1">Visão financeira dos projetos</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { title: "Receita Total", value: totalRevenue, icon: DollarSign },
            { title: "Custo Total", value: totalCost, icon: TrendingDown },
            { title: "Resultado", value: totalProfit, icon: TrendingUp },
          ].map((kpi, i) => (
            <Card key={kpi.title} className="shadow-sm animate-reveal-up" style={{ animationDelay: `${(i + 1) * 60}ms`, animationFillMode: "backwards" }}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.title}</CardTitle>
                <kpi.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold tabular-nums ${kpi.title === "Resultado" ? (kpi.value >= 0 ? "text-success" : "text-destructive") : ""}`}>
                  R$ {formatBRL(kpi.value)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

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
                  <Bar dataKey="receita" name="Receita" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="custo" name="Custo" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

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
      </div>
    </AppLayout>
  );
}
