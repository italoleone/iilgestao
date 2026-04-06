import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, TrendingUp, TrendingDown, Clock, CheckCircle } from "lucide-react";
import { useReceivables, usePayables, useMarkReceived, useMarkPaid } from "@/hooks/useFinanceiroData";
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

export default function FinanceiroDashboard() {
  const { data: allReceivables = [] } = useReceivables();
  const { data: allPayables = [] } = usePayables();
  const markReceived = useMarkReceived();
  const markPaid = useMarkPaid();

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const receitaMes = useMemo(() =>
    allReceivables.filter(r => r.received_date && isWithinInterval(parseISO(r.received_date), { start: monthStart, end: monthEnd }))
      .reduce((s, r) => s + Number(r.amount), 0), [allReceivables]);

  const despesaMes = useMemo(() =>
    allPayables.filter(p => p.paid_date && isWithinInterval(parseISO(p.paid_date), { start: monthStart, end: monthEnd }))
      .reduce((s, p) => s + Number(p.amount), 0), [allPayables]);

  const resultado = receitaMes - despesaMes;

  const aReceber30 = useMemo(() => {
    const limit = addDays(now, 30);
    return allReceivables.filter(r => r.status === "pendente" && parseISO(r.due_date) <= limit)
      .reduce((s, r) => s + Number(r.amount), 0);
  }, [allReceivables]);

  // Cash flow last 6 months
  const cashFlowData = useMemo(() => {
    const months: any[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(now, i);
      const ms = startOfMonth(d); const me = endOfMonth(d);
      const rec = allReceivables.filter(r => r.received_date && isWithinInterval(parseISO(r.received_date), { start: ms, end: me }))
        .reduce((s, r) => s + Number(r.amount), 0);
      const desp = allPayables.filter(p => p.paid_date && isWithinInterval(parseISO(p.paid_date), { start: ms, end: me }))
        .reduce((s, p) => s + Number(p.amount), 0);
      months.push({ name: format(d, "MMM/yy", { locale: ptBR }), receitas: rec, despesas: desp, resultado: rec - desp });
    }
    return months;
  }, [allReceivables, allPayables]);

  // Expenses by category (current month)
  const catData = useMemo(() => {
    const map: Record<string, number> = {};
    allPayables.filter(p => p.paid_date && isWithinInterval(parseISO(p.paid_date), { start: monthStart, end: monthEnd }))
      .forEach(p => { map[p.category] = (map[p.category] || 0) + Number(p.amount); });
    return Object.entries(map).map(([k, v]) => ({ name: CAT_LABELS[k] || k, value: v, color: PIE_COLORS[k] || PIE_COLORS.outros }));
  }, [allPayables]);

  // Upcoming receivables (15 days)
  const upcoming15Rec = useMemo(() => {
    const limit = addDays(now, 15);
    return allReceivables.filter(r => r.status === "pendente" && parseISO(r.due_date) <= limit).slice(0, 8);
  }, [allReceivables]);

  // Upcoming payables (15 days)
  const upcoming15Pay = useMemo(() => {
    const limit = addDays(now, 15);
    return allPayables.filter(p => p.status === "pendente" && parseISO(p.due_date) <= limit).slice(0, 8);
  }, [allPayables]);

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
    { title: "A Receber (30 dias)", value: fmt(aReceber30), icon: Clock, color: "text-accent" },
  ];

  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        <h1 className="text-2xl font-bold">Dashboard Financeiro</h1>

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
            <CardHeader><CardTitle className="text-sm">Despesas por Categoria — Mês Atual</CardTitle></CardHeader>
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
      </div>
    </AppLayout>
  );
}
