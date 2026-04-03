import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCommercialProposals, PROPOSAL_STATUS_LABELS, type ProposalStatus, type ProposalDisciplines } from "@/hooks/useCommercialData";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { DollarSign, FileText, TrendingUp, Clock, Target, BarChart3 } from "lucide-react";
import { DISCIPLINE_SHORT } from "@/types";

const STATUS_COLORS: Record<string, string> = {
  lead: "#94a3b8",
  contato_feito: "#60a5fa",
  em_elaboracao: "#fbbf24",
  enviada: "#a78bfa",
  em_negociacao: "#fb923c",
  aprovada: "#34d399",
  reprovada: "#f87171",
};

export default function ComercialDashboard() {
  const { data: proposals = [], isLoading } = useCommercialProposals();

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const thisMonthProposals = proposals.filter((p) => {
    const d = new Date(p.proposal_date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const totalProposals = thisMonthProposals.length;
  const totalValue = thisMonthProposals.reduce((s, p) => s + p.total_value, 0);
  const approved = proposals.filter((p) => p.status === "aprovada");

  // Use final values for approved proposals
  const approvedValue = approved.reduce((s, p) => s + (p.final_total_value > 0 ? p.final_total_value : p.total_value), 0);
  const conversionRate = proposals.length > 0 ? ((approved.length / proposals.length) * 100).toFixed(1) : "0";
  const avgTicket = approved.length > 0 ? approvedValue / approved.length : 0;

  const closingDays = approved.map((p) => {
    const start = new Date(p.proposal_date).getTime();
    const end = new Date(p.updated_at).getTime();
    return Math.max(1, Math.round((end - start) / 86400000));
  });
  const avgClosingTime = closingDays.length > 0 ? Math.round(closingDays.reduce((a, b) => a + b, 0) / closingDays.length) : 0;

  const funnelData = Object.entries(PROPOSAL_STATUS_LABELS).map(([key, label]) => ({
    name: label,
    value: proposals.filter((p) => p.status === key).length,
    fill: STATUS_COLORS[key] || "#94a3b8",
  }));

  const statusPie = funnelData.filter((d) => d.value > 0);

  // R$/m² by discipline — uses FINAL values when available
  const disciplineMetrics = (["estrutural", "hidraulica", "eletrica"] as const).map((disc) => {
    const relevantProposals = approved.filter((p) => {
      const finalVal = (p.final_disciplines as ProposalDisciplines)?.[disc];
      const origVal = (p.disciplines as ProposalDisciplines)?.[disc];
      const val = (finalVal && finalVal > 0) ? finalVal : origVal;
      return val && val > 0 && p.area_m2 > 0;
    });
    const values = relevantProposals.map((p) => {
      const finalVal = (p.final_disciplines as ProposalDisciplines)?.[disc];
      const origVal = (p.disciplines as ProposalDisciplines)?.[disc];
      const val = (finalVal && finalVal > 0) ? finalVal : origVal!;
      return val / p.area_m2;
    });
    const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    const min = values.length > 0 ? Math.min(...values) : 0;
    const max = values.length > 0 ? Math.max(...values) : 0;
    return {
      discipline: DISCIPLINE_SHORT[disc] || disc,
      avg: Number(avg.toFixed(2)),
      min: Number(min.toFixed(2)),
      max: Number(max.toFixed(2)),
    };
  });

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Dashboard Comercial</h1>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: "Propostas no Mês", value: totalProposals, icon: FileText },
            { label: "Valor em Propostas", value: fmt(totalValue), icon: DollarSign },
            { label: "Valor Aprovado", value: fmt(approvedValue), icon: TrendingUp },
            { label: "Taxa de Conversão", value: `${conversionRate}%`, icon: Target },
            { label: "Ticket Médio", value: fmt(avgTicket), icon: BarChart3 },
            { label: "Tempo Médio (dias)", value: avgClosingTime, icon: Clock },
          ].map((kpi) => (
            <Card key={kpi.label}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <kpi.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{kpi.label}</span>
                </div>
                <p className="text-lg font-bold text-foreground">{kpi.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">R$/m² por Disciplina (Propostas Aprovadas)</CardTitle></CardHeader>
          <CardContent>
            {disciplineMetrics.every((d) => d.avg === 0) ? (
              <p className="text-sm text-muted-foreground">Nenhuma proposta aprovada com dados suficientes.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {disciplineMetrics.map((d) => (
                  <Card key={d.discipline} className="bg-muted/30">
                    <CardContent className="p-4 text-center">
                      <p className="text-sm font-medium text-muted-foreground">{d.discipline}</p>
                      <p className="text-2xl font-bold text-foreground mt-1">{d.avg > 0 ? `R$ ${d.avg.toFixed(2)}/m²` : "—"}</p>
                      {d.avg > 0 && <p className="text-xs text-muted-foreground mt-1">Mín: R$ {d.min.toFixed(2)} | Máx: R$ {d.max.toFixed(2)}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Funil de Vendas</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={funnelData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" name="Propostas">
                    {funnelData.map((entry, i) => (<Cell key={i} fill={entry.fill} />))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Propostas por Status</CardTitle></CardHeader>
            <CardContent>
              {statusPie.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma proposta registrada.</p>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={statusPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                      {statusPie.map((entry, i) => (<Cell key={i} fill={entry.fill} />))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
