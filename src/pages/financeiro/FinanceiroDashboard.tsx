import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { DollarSign, TrendingUp, TrendingDown, Clock, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useReceivables, usePayables, useMarkReceived, useMarkPaid, useProjetoCusto } from "@/hooks/useFinanceiroData";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, Line, ComposedChart } from "recharts";
import { format, subMonths, startOfMonth, endOfMonth, addDays, isWithinInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const PIE_COLORS: Record<string, string> = {
  salario: "hsl(220, 70%, 55%)",
  prolabore: "hsl(270, 60%, 55%)",
  aluguel: "hsl(30, 80%, 55%)",
  software: "hsl(190, 70%, 50%)",
  impostos: "hsl(0, 65%, 55%)",
  marketing: "hsl(330, 65%, 55%)",
  equipamento: "hsl(50, 80%, 50%)",
  outros: "hsl(0, 0%, 55%)",
};

const CAT_LABELS: Record<string, string> = {
  salario: "Salário", prolabore: "Pró-labore", aluguel: "Aluguel",
  software: "Software", impostos: "Impostos", marketing: "Marketing",
  equipamento: "Equipamento", outros: "Outros",
};

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default function FinanceiroDashboard() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const { data: allReceivables = [] } = useReceivables();
  const { data: allPayables = [] } = usePayables();
  const markReceived = useMarkReceived();
  const markPaid = useMarkPaid();

  const monthStart = startOfMonth(new Date(selectedYear, selectedMonth));
  const monthEnd = endOfMonth(new Date(selectedYear, selectedMonth));

  const years = useMemo(() => {
    const y: number[] = [];
    for (let i = now.getFullYear() - 2; i <= now.getFullYear(); i++) y.push(i);
    return y;
  }, []);

  // KPIs
  const receitaMes = useMemo(() =>
    allReceivables.filter(r => r.received_date && isWithinInterval(parseISO(r.received_date), { start: monthStart, end: monthEnd }))
      .reduce((s, r) => s + Number(r.amount), 0), [allReceivables, selectedMonth, selectedYear]);

  const despesaMes = useMemo(() =>
    allPayables.filter(p => p.paid_date && isWithinInterval(parseISO(p.paid_date), { start: monthStart, end: monthEnd }))
      .reduce((s, p) => s + Number(p.amount), 0), [allPayables, selectedMonth, selectedYear]);

  const resultado = receitaMes - despesaMes;

  const aReceber30 = useMemo(() => {
    const limit = addDays(monthEnd, 30);
    return allReceivables
      .filter(r => r.status === "pendente" && isWithinInterval(parseISO(r.due_date), { start: monthStart, end: limit }))
      .reduce((s, r) => s + Number(r.amount), 0);
  }, [allReceivables, selectedMonth, selectedYear]);

  // Cash flow: 6 months ending at selected month
  const cashFlowData = useMemo(() => {
    const ref = new Date(selectedYear, selectedMonth, 15);
    const months: any[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(ref, i);
      const ms = startOfMonth(d); const me = endOfMonth(d);
      const rec = allReceivables.filter(r => r.received_date && isWithinInterval(parseISO(r.received_date), { start: ms, end: me }))
        .reduce((s, r) => s + Number(r.amount), 0);
      const desp = allPayables.filter(p => p.paid_date && isWithinInterval(parseISO(p.paid_date), { start: ms, end: me }))
        .reduce((s, p) => s + Number(p.amount), 0);
      months.push({ name: format(d, "MMM/yy", { locale: ptBR }), receitas: rec, despesas: desp, resultado: rec - desp });
    }
    return months;
  }, [allReceivables, allPayables, selectedMonth, selectedYear]);

  // Expenses by category (selected month)
  const catData = useMemo(() => {
    const map: Record<string, number> = {};
    allPayables.filter(p => p.paid_date && isWithinInterval(parseISO(p.paid_date), { start: monthStart, end: monthEnd }))
      .forEach(p => { map[p.category] = (map[p.category] || 0) + Number(p.amount); });
    return Object.entries(map).map(([k, v]) => ({ name: CAT_LABELS[k] || k, value: v, color: PIE_COLORS[k] || PIE_COLORS.outros }));
  }, [allPayables, selectedMonth, selectedYear]);

  // Upcoming receivables (15 days from month start)
  const upcoming15Rec = useMemo(() => {
    const limit = addDays(monthStart, 15);
    return allReceivables.filter(r => r.status === "pendente" && isWithinInterval(parseISO(r.due_date), { start: monthStart, end: addDays(monthEnd, 15) })).slice(0, 8);
  }, [allReceivables, selectedMonth, selectedYear]);

  // Upcoming payables (15 days)
  const upcoming15Pay = useMemo(() => {
    return allPayables.filter(p => p.status === "pendente" && isWithinInterval(parseISO(p.due_date), { start: monthStart, end: addDays(monthEnd, 15) })).slice(0, 8);
  }, [allPayables, selectedMonth, selectedYear]);

  const [datePickerFor, setDatePickerFor] = useState<{ type: "rec" | "pay"; id: string } | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const handleConfirmDate = () => {
    if (!datePickerFor || !selectedDate) return;
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    if (datePickerFor.type === "rec") markReceived.mutate({ id: datePickerFor.id, date: dateStr });
    else markPaid.mutate({ id: datePickerFor.id, date: dateStr });
    setDatePickerFor(null);
  };

  const kpis = [
    { title: "Receita do Mês", value: fmt(receitaMes), icon: TrendingUp, color: "text-emerald-400" },
    { title: "Despesas do Mês", value: fmt(despesaMes), icon: TrendingDown, color: "text-red-400" },
    { title: "Resultado do Mês", value: fmt(resultado), icon: DollarSign, color: resultado >= 0 ? "text-emerald-400" : "text-red-400" },
    { title: "A Receber (período)", value: fmt(aReceber30), icon: Clock, color: "text-accent" },
  ];

  // ---- Análise por Projeto ----
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showAllTasks, setShowAllTasks] = useState(false);

  const { data: projetos = [] } = useQuery({
    queryKey: ["projects-list"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id, name, client, discipline").order("name");
      return data || [];
    },
  });

  const { data: projetoCusto, isLoading: loadingProjeto } = useProjetoCusto(selectedProjectId);

  const custoPercent = projetoCusto && projetoCusto.receita > 0
    ? Math.min(100, Math.round((projetoCusto.custoAcumulado / projetoCusto.receita) * 100))
    : 0;

  const margemColor = (pct: number) => pct > 40 ? "text-emerald-400" : pct >= 20 ? "text-yellow-400" : "text-red-400";
  const margemBadge = (pct: number) => pct > 40 ? "bg-emerald-500/20 text-emerald-400" : pct >= 20 ? "bg-yellow-500/20 text-yellow-400" : "bg-red-500/20 text-red-400";

  const visibleTasks = projetoCusto?.detalhesPorTarefa
    ? showAllTasks ? projetoCusto.detalhesPorTarefa : projetoCusto.detalhesPorTarefa.slice(0, 10)
    : [];

  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        {/* Header with filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">Dashboard Financeiro</h1>
          <div className="flex items-center gap-2">
            <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((m, i) => (
                  <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map(k => (
            <Card key={k.title}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{k.title}</p>
                    <p className={cn("text-xl font-bold mt-1", k.color)}>{k.value}</p>
                  </div>
                  <k.icon className={cn("h-8 w-8", k.color)} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-sm">Fluxo de Caixa — Últimos 6 Meses</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={cashFlowData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <Legend />
                  <Bar dataKey="receitas" name="Receitas" fill="hsl(150, 60%, 45%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesas" name="Despesas" fill="hsl(0, 60%, 50%)" radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="resultado" name="Resultado" stroke="hsl(65, 80%, 45%)" strokeWidth={2} dot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Despesas por Categoria — {MONTH_NAMES[selectedMonth]}/{selectedYear}</CardTitle></CardHeader>
            <CardContent>
              {catData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-16">Sem despesas pagas neste mês</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={catData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {catData.map((c, i) => <Cell key={i} fill={c.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Upcoming */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-sm">Próximos Vencimentos — A Receber</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {upcoming15Rec.length === 0 && <p className="text-sm text-muted-foreground">Nenhum vencimento próximo</p>}
              {upcoming15Rec.map(r => (
                <div key={r.id} className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.client_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.description}</p>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <div>
                      <p className="text-sm font-semibold">{fmt(Number(r.amount))}</p>
                      <p className="text-xs text-muted-foreground">{format(parseISO(r.due_date), "dd/MM")}</p>
                    </div>
                    <Popover open={datePickerFor?.id === r.id && datePickerFor?.type === "rec"} onOpenChange={(o) => !o && setDatePickerFor(null)}>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" title="Marcar como recebido" onClick={() => { setDatePickerFor({ type: "rec", id: r.id }); setSelectedDate(new Date()); }}>
                          <CheckCircle className="h-4 w-4 text-emerald-400" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end">
                        <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} className={cn("p-3 pointer-events-auto")} />
                        <div className="p-2 border-t flex justify-end"><Button size="sm" onClick={handleConfirmDate}>Confirmar</Button></div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Próximos Vencimentos — A Pagar</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {upcoming15Pay.length === 0 && <p className="text-sm text-muted-foreground">Nenhum vencimento próximo</p>}
              {upcoming15Pay.map(p => (
                <div key={p.id} className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.supplier || p.description}</p>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="text-[10px]">{CAT_LABELS[p.category] || p.category}</Badge>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <div>
                      <p className="text-sm font-semibold">{fmt(Number(p.amount))}</p>
                      <p className="text-xs text-muted-foreground">{format(parseISO(p.due_date), "dd/MM")}</p>
                    </div>
                    <Popover open={datePickerFor?.id === p.id && datePickerFor?.type === "pay"} onOpenChange={(o) => !o && setDatePickerFor(null)}>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" title="Marcar como pago" onClick={() => { setDatePickerFor({ type: "pay", id: p.id }); setSelectedDate(new Date()); }}>
                          <CheckCircle className="h-4 w-4 text-emerald-400" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end">
                        <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} className={cn("p-3 pointer-events-auto")} />
                        <div className="p-2 border-t flex justify-end"><Button size="sm" onClick={handleConfirmDate}>Confirmar</Button></div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* ---- Análise por Projeto ---- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Análise por Projeto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Select value={selectedProjectId || ""} onValueChange={(v) => { setSelectedProjectId(v || null); setShowAllTasks(false); }}>
                <SelectTrigger className="w-full max-w-md">
                  <SelectValue placeholder="Selecione um projeto para ver a análise de custo detalhada" />
                </SelectTrigger>
                <SelectContent>
                  {projetos.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} — {p.client}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!selectedProjectId && (
              <p className="text-sm text-muted-foreground text-center py-8">Selecione um projeto para ver a análise de custo detalhada</p>
            )}

            {selectedProjectId && loadingProjeto && (
              <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
            )}

            {projetoCusto && (
              <>
                {/* Project KPIs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-xs text-muted-foreground">Receita Contratada</p>
                      <p className="text-xl font-bold mt-1 text-emerald-400">{fmt(projetoCusto.receita)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-xs text-muted-foreground">Custo Horas</p>
                      <p className="text-xl font-bold mt-1 text-red-400">{fmt(projetoCusto.custoHoras)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-xs text-muted-foreground">Custo NF</p>
                      <p className="text-xl font-bold mt-1 text-orange-400">{fmt(projetoCusto.custoNF)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-xs text-muted-foreground">Margem Atual</p>
                      <p className={cn("text-xl font-bold mt-1", projetoCusto.margemRs >= 0 ? "text-emerald-400" : "text-red-400")}>{fmt(projetoCusto.margemRs)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-xs text-muted-foreground">Margem %</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className={cn("text-xl font-bold", margemColor(projetoCusto.margemPct))}>{projetoCusto.margemPct}%</p>
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", margemBadge(projetoCusto.margemPct))}>
                          {projetoCusto.margemPct > 40 ? "Saudável" : projetoCusto.margemPct >= 20 ? "Atenção" : "Crítico"}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Progress bar */}
                <Card>
                  <CardContent className="pt-6 space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Consumo do Valor Contratado</span>
                      <span>{custoPercent}%</span>
                    </div>
                    <div className="w-full h-4 rounded-full bg-emerald-500/20 overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", custoPercent > 80 ? "bg-red-500" : custoPercent > 60 ? "bg-yellow-500" : "bg-red-400")}
                        style={{ width: `${custoPercent}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {fmt(projetoCusto.custoAcumulado)} consumido de {fmt(projetoCusto.receita)} contratado
                      {" · "}{projetoCusto.horasGastas}h gastas
                    </p>
                  </CardContent>
                </Card>

                {/* Two tables side by side */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* By User */}
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Custo por Colaborador</CardTitle></CardHeader>
                    <CardContent>
                      {projetoCusto.detalhesPorUsuario.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Sem lançamentos de horas</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Colaborador</TableHead>
                              <TableHead className="text-right">Horas</TableHead>
                              <TableHead className="text-right">Custo (R$)</TableHead>
                              <TableHead className="text-right">% do Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {projetoCusto.detalhesPorUsuario.map(u => (
                              <TableRow key={u.userId}>
                                <TableCell className="font-medium">{u.userName}</TableCell>
                                <TableCell className="text-right">{u.horasGastas}h</TableCell>
                                <TableCell className="text-right">{fmt(u.custo)}</TableCell>
                                <TableCell className="text-right">
                                  {projetoCusto.custoAcumulado > 0 ? Math.round((u.custo / projetoCusto.custoAcumulado) * 100) : 0}%
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>

                  {/* By Task */}
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Custo por Tarefa</CardTitle></CardHeader>
                    <CardContent>
                      {projetoCusto.detalhesPorTarefa.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Sem lançamentos de horas</p>
                      ) : (
                        <>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Fase</TableHead>
                                <TableHead>Tarefa</TableHead>
                                <TableHead>Responsável</TableHead>
                                <TableHead className="text-right">Horas</TableHead>
                                <TableHead className="text-right">Custo</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {visibleTasks.map(t => (
                                <TableRow key={t.taskId}>
                                  <TableCell className="text-xs text-muted-foreground">{t.stageName}</TableCell>
                                  <TableCell className="font-medium">{t.taskName}</TableCell>
                                  <TableCell className="text-xs">{t.responsavelNome}</TableCell>
                                  <TableCell className="text-right">{t.horasGastas}h</TableCell>
                                  <TableCell className="text-right">{fmt(t.custo)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                          {projetoCusto.detalhesPorTarefa.length > 10 && (
                            <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => setShowAllTasks(!showAllTasks)}>
                              {showAllTasks ? <><ChevronUp className="h-4 w-4 mr-1" /> Mostrar menos</> : <><ChevronDown className="h-4 w-4 mr-1" /> Ver todas ({projetoCusto.detalhesPorTarefa.length})</>}
                            </Button>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
