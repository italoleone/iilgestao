import { useState, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useCommercialProposals,
  useCommercialClients,
  PROPOSAL_STATUS_LABELS,
  type ProposalStatus,
  type ProposalDisciplines,
  type CommercialProposal,
} from "@/hooks/useCommercialData";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend,
} from "recharts";
import {
  DollarSign, FileText, TrendingUp, Target, BarChart3, Handshake, XCircle, ArrowDown,
  Pencil, Check, ArrowUpRight, ArrowDownRight, Clock,
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const STATUS_COLORS: Record<string, string> = {
  lead: "#94a3b8",
  contato_feito: "#60a5fa",
  em_elaboracao: "#fbbf24",
  enviada: "#a78bfa",
  em_negociacao: "#fb923c",
  aprovada: "#34d399",
  reprovada: "#f87171",
};

const FORECAST_WEIGHTS: Record<string, number> = {
  lead: 0.1,
  contato_feito: 0.25,
  em_elaboracao: 0.4,
  enviada: 0.5,
  em_negociacao: 0.7,
};

const DISC_KEYS = ["estrutural", "hidraulica", "eletrica", "fundacoes"] as const;
const DISC_LABELS: Record<string, string> = {
  estrutural: "Estrutural",
  hidraulica: "Hidráulica",
  eletrica: "Elétrica",
  fundacoes: "Fundações",
};

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ComercialDashboard() {
  const { data: proposals = [], isLoading } = useCommercialProposals();
  const { data: clients = [] } = useCommercialClients();

  const [editingMeta, setEditingMeta] = useState(false);
  const [metaInput, setMetaInput] = useState("");

  const meta = useMemo(() => {
    const stored = localStorage.getItem("meta_comercial_mensal");
    return stored ? Number(stored) : 0;
  }, [editingMeta]); // re-read after save

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const thisMonthProposals = useMemo(
    () =>
      proposals.filter((p) => {
        const d = new Date(p.proposal_date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      }),
    [proposals, currentMonth, currentYear]
  );

  const prevMonthApproved = useMemo(() => {
    const pm = currentMonth === 0 ? 11 : currentMonth - 1;
    const py = currentMonth === 0 ? currentYear - 1 : currentYear;
    return proposals.filter((p) => {
      if (p.status !== "aprovada") return false;
      const d = new Date(p.updated_at);
      return d.getMonth() === pm && d.getFullYear() === py;
    });
  }, [proposals, currentMonth, currentYear]);

  const approved = proposals.filter((p) => p.status === "aprovada");
  const approvedThisMonth = thisMonthProposals.filter((p) => p.status === "aprovada");

  // KPIs
  const totalProposals = thisMonthProposals.length;
  const totalValue = thisMonthProposals.reduce((s, p) => s + p.total_value, 0);
  const approvedValue = approved.reduce(
    (s, p) => s + (p.final_total_value > 0 ? p.final_total_value : p.total_value),
    0
  );
  const approvedValueMonth = approvedThisMonth.reduce(
    (s, p) => s + (p.final_total_value > 0 ? p.final_total_value : p.total_value),
    0
  );
  const conversionRate =
    proposals.length > 0 ? ((approved.length / proposals.length) * 100).toFixed(1) : "0";
  const avgTicket = approved.length > 0 ? approvedValue / approved.length : 0;

  const inNegotiation = proposals.filter((p) => p.status === "em_negociacao");
  const negotiationValue = inNegotiation.reduce((s, p) => s + p.total_value, 0);

  const rejectedMonth = thisMonthProposals.filter((p) => p.status === "reprovada");
  const rejectedCount = rejectedMonth.length;
  const rejectedValue = rejectedMonth.reduce((s, p) => s + p.total_value, 0);

  // Meta progress
  const metaProgress = meta > 0 ? Math.min((approvedValueMonth / meta) * 100, 150) : 0;
  const metaProgressClamped = Math.min(metaProgress, 100);

  // Funnel with avg time
  const funnelData = useMemo(() => {
    const nowMs = now.getTime();
    return Object.entries(PROPOSAL_STATUS_LABELS).map(([key, label]) => {
      const items = proposals.filter((p) => p.status === key);
      const totalVal = items.reduce((s, p) => s + p.total_value, 0);
      const avgDays =
        items.length > 0
          ? Math.round(
              items.reduce((s, p) => {
                const diff = (nowMs - new Date(p.updated_at).getTime()) / 86400000;
                return s + Math.max(0, diff);
              }, 0) / items.length
            )
          : 0;
      return {
        name: label,
        count: items.length,
        value: totalVal,
        avgDays,
        fill: STATUS_COLORS[key] || "#94a3b8",
      };
    });
  }, [proposals]);

  // Forecast 30/60/90
  const forecast = useMemo(() => {
    const openProposals = proposals.filter(
      (p) => !["aprovada", "reprovada"].includes(p.status)
    );
    const weighted = openProposals.reduce(
      (s, p) => s + p.total_value * (FORECAST_WEIGHTS[p.status] || 0),
      0
    );
    return { d30: weighted, d60: weighted * 1.15, d90: weighted * 1.3 };
  }, [proposals]);

  // R$/m² by discipline
  const disciplineMetrics = useMemo(
    () =>
      DISC_KEYS.map((disc) => {
        const relevantProposals = approved.filter((p) => {
          const finalVal = (p.final_disciplines as ProposalDisciplines)?.[disc];
          const origVal = (p.disciplines as ProposalDisciplines)?.[disc];
          const val = finalVal && finalVal > 0 ? finalVal : origVal;
          return val && val > 0 && p.area_m2 > 0;
        });
        const values = relevantProposals.map((p) => {
          const finalVal = (p.final_disciplines as ProposalDisciplines)?.[disc];
          const origVal = (p.disciplines as ProposalDisciplines)?.[disc];
          const val = finalVal && finalVal > 0 ? finalVal : origVal!;
          return val / p.area_m2;
        });
        const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        const min = values.length > 0 ? Math.min(...values) : 0;
        const max = values.length > 0 ? Math.max(...values) : 0;
        return { discipline: DISC_LABELS[disc], avg, min, max };
      }),
    [approved]
  );

  // Ranking clientes
  const clientRanking = useMemo(() => {
    const clientMap = new Map<
      string,
      { name: string; count: number; total: number; lastDate: string }
    >();
    for (const p of approved) {
      const cid = p.client_id;
      const cname = p.client?.name || "—";
      const val = p.final_total_value > 0 ? p.final_total_value : p.total_value;
      const existing = clientMap.get(cid);
      if (existing) {
        existing.count++;
        existing.total += val;
        if (p.proposal_date > existing.lastDate) existing.lastDate = p.proposal_date;
      } else {
        clientMap.set(cid, { name: cname, count: 1, total: val, lastDate: p.proposal_date });
      }
    }
    return Array.from(clientMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [approved]);

  // Discipline analysis (month)
  const disciplineAnalysis = useMemo(() => {
    return DISC_KEYS.map((disc) => {
      const proposed = thisMonthProposals.reduce(
        (s, p) => s + ((p.disciplines as ProposalDisciplines)?.[disc] || 0),
        0
      );
      const approvedVal = approvedThisMonth.reduce((s, p) => {
        const fv = (p.final_disciplines as ProposalDisciplines)?.[disc];
        const ov = (p.disciplines as ProposalDisciplines)?.[disc];
        return s + (fv && fv > 0 ? fv : ov || 0);
      }, 0);
      return { discipline: DISC_LABELS[disc], proposto: proposed, aprovado: approvedVal };
    });
  }, [thisMonthProposals, approvedThisMonth]);

  // Lost proposals
  const lostProposals = useMemo(() => {
    return proposals
      .filter((p) => p.status === "reprovada")
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 5);
  }, [proposals]);

  // Avg closing time
  const closingStats = useMemo(() => {
    const calc = (list: CommercialProposal[]) => {
      const days = list.map((p) => {
        const start = new Date(p.proposal_date).getTime();
        const end = new Date(p.updated_at).getTime();
        return Math.max(1, Math.round((end - start) / 86400000));
      });
      return days.length > 0 ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : 0;
    };
    const currentAvg = calc(approvedThisMonth);
    const prevAvg = calc(prevMonthApproved);
    return { current: currentAvg, previous: prevAvg };
  }, [approvedThisMonth, prevMonthApproved]);

  const saveMeta = () => {
    const val = parseFloat(metaInput.replace(",", "."));
    if (!isNaN(val) && val > 0) {
      localStorage.setItem("meta_comercial_mensal", String(val));
    }
    setEditingMeta(false);
  };

  const kpis = [
    { label: "Propostas no Mês", value: totalProposals, icon: FileText },
    { label: "Valor em Propostas", value: fmt(totalValue), icon: DollarSign },
    { label: "Valor Aprovado", value: fmt(approvedValue), icon: TrendingUp },
    { label: "Taxa de Conversão", value: `${conversionRate}%`, icon: Target },
    { label: "Ticket Médio", value: fmt(avgTicket), icon: BarChart3 },
    { label: "Valor em Negociação", value: fmt(negotiationValue), icon: Handshake },
    { label: "Perdidas no Mês", value: rejectedCount, icon: XCircle },
    { label: "Valor Perdido", value: fmt(rejectedValue), icon: ArrowDown },
  ];

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Dashboard Comercial</h1>

        {/* BLOCO 1 — KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpis.map((kpi) => (
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

        {/* BLOCO 2 — Meta Mensal */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Meta Mensal</CardTitle>
              {!editingMeta ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => {
                    setMetaInput(meta > 0 ? String(meta) : "");
                    setEditingMeta(true);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    className="h-7 w-40 text-sm"
                    placeholder="Ex: 500000"
                    value={metaInput}
                    onChange={(e) => setMetaInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveMeta()}
                  />
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={saveMeta}>
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {meta > 0 ? (
              <div className="space-y-2">
                <div className="relative">
                  <Progress
                    value={metaProgressClamped}
                    className="h-5"
                    style={
                      {
                        "--progress-color":
                          metaProgress >= 100 ? "hsl(142, 71%, 45%)" : "hsl(66, 100%, 44%)",
                      } as React.CSSProperties
                    }
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  {fmt(approvedValueMonth)} aprovado de {fmt(meta)} de meta (
                  {metaProgress.toFixed(1)}%)
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Defina uma meta mensal clicando no ícone de lápis.
              </p>
            )}
          </CardContent>
        </Card>

        {/* BLOCO 3 & 4 — Funil + Previsão */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-base">Funil de Vendas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {funnelData.map((item) => {
                  const maxVal = Math.max(...funnelData.map((d) => d.value), 1);
                  const barWidth = Math.max(2, (item.value / maxVal) * 100);
                  return (
                    <div key={item.name} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-foreground">{item.name}</span>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{item.count} prop.</span>
                          <span>{fmt(item.value)}</span>
                          <span>~{item.avgDays}d</span>
                        </div>
                      </div>
                      <div className="h-3 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${barWidth}%`, backgroundColor: item.fill }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Previsão de Receita</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-4">Previsão conservadora</p>
              <div className="grid grid-cols-3 gap-4 text-center">
                {[
                  { label: "30 dias", value: forecast.d30 },
                  { label: "60 dias", value: forecast.d60 },
                  { label: "90 dias", value: forecast.d90 },
                ].map((f) => (
                  <div key={f.label} className="space-y-1">
                    <p className="text-xs text-muted-foreground">{f.label}</p>
                    <p className="text-lg font-bold text-foreground">{fmt(f.value)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* BLOCO 5 & 7 — R$/m² + Análise por Disciplina */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">R$/m² por Disciplina (Aprovadas)</CardTitle>
            </CardHeader>
            <CardContent>
              {disciplineMetrics.every((d) => d.avg === 0) ? (
                <p className="text-sm text-muted-foreground">Sem dados suficientes.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {disciplineMetrics.map((d) => (
                    <Card key={d.discipline} className="bg-muted/30">
                      <CardContent className="p-3 text-center">
                        <p className="text-xs font-medium text-muted-foreground">
                          {d.discipline}
                        </p>
                        <p className="text-xl font-bold text-foreground mt-1">
                          {d.avg > 0 ? `R$ ${d.avg.toFixed(2)}/m²` : "—"}
                        </p>
                        {d.avg > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Mín: R$ {d.min.toFixed(2)} | Máx: R$ {d.max.toFixed(2)}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Análise por Disciplina (Mês)</CardTitle>
            </CardHeader>
            <CardContent>
              {disciplineAnalysis.every((d) => d.proposto === 0 && d.aprovado === 0) ? (
                <p className="text-sm text-muted-foreground">Sem propostas no mês.</p>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={disciplineAnalysis}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="discipline" tick={{ fontSize: 12 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) =>
                        v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                      }
                    />
                    <Tooltip
                      formatter={(value: number) => fmt(value)}
                    />
                    <Legend />
                    <Bar dataKey="proposto" name="Proposto" fill="#fbbf24" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="aprovado" name="Aprovado" fill="#D2E100" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* BLOCO 6 & 8 — Ranking Clientes + Perdidas */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-base">Ranking de Clientes</CardTitle>
            </CardHeader>
            <CardContent>
              {clientRanking.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma proposta aprovada.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-center">Propostas</TableHead>
                      <TableHead className="text-right">Valor Total</TableHead>
                      <TableHead className="text-right">Ticket Médio</TableHead>
                      <TableHead className="text-right">Última</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientRanking.map((c, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-center">{c.count}</TableCell>
                        <TableCell className="text-right">{fmt(c.total)}</TableCell>
                        <TableCell className="text-right">
                          {fmt(c.total / c.count)}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {new Date(c.lastDate).toLocaleDateString("pt-BR")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Propostas Perdidas</CardTitle>
            </CardHeader>
            <CardContent>
              {lostProposals.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma proposta reprovada.</p>
              ) : (
                <div className="space-y-3">
                  {lostProposals.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between border-b border-border pb-2 last:border-0"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">{p.project_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.client?.name || "—"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-foreground">
                          {fmt(p.total_value)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(p.updated_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* BLOCO 9 — Tempo Médio de Fechamento */}
        <Card>
          <CardContent className="p-4 flex items-center gap-6">
            <Clock className="h-8 w-8 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm text-muted-foreground">Tempo Médio de Fechamento</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-2xl font-bold text-foreground">
                  {closingStats.current > 0 ? `${closingStats.current} dias` : "—"}
                </span>
                {closingStats.previous > 0 && closingStats.current > 0 && (
                  <span
                    className={`flex items-center gap-1 text-sm font-medium ${
                      closingStats.current <= closingStats.previous
                        ? "text-green-500"
                        : "text-red-500"
                    }`}
                  >
                    {closingStats.current <= closingStats.previous ? (
                      <ArrowDownRight className="h-4 w-4" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4" />
                    )}
                    vs {closingStats.previous}d mês anterior
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
