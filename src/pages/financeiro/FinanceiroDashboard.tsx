import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  DollarSign, TrendingUp, TrendingDown, Clock, CheckCircle,
  ChevronDown, ChevronUp, ChevronsUpDown, Check, CalendarClock, XCircle,
  Repeat, ArrowUp, ArrowDown,
} from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useReceivables, usePayables, useMarkReceived, useMarkPaid, useProjetoCusto } from "@/hooks/useFinanceiroData";
import { useAllBillingSchedules, useAllInstallmentProposals, MONTH_LABELS } from "@/hooks/useCommercialData";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, ComposedChart, Line,
} from "recharts";
import { format, subMonths, startOfMonth, endOfMonth, addDays, isWithinInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

const fmt = (v: number | undefined | null) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pago: { label: "Pago", cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
    recebido: { label: "Recebido", cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
    pendente: { label: "Pendente", cls: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30" },
    vencido: { label: "Vencido", cls: "bg-orange-500/15 text-orange-500 border-orange-500/30" },
    em_aberto: { label: "Em aberto", cls: "bg-muted text-muted-foreground border-border" },
  };
  const s = map[status] || { label: status, cls: "bg-muted text-muted-foreground border-border" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-medium ${s.cls}`}>{s.label}</span>;
}

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

const BILLING_STATUS_LABELS: Record<string, string> = {
  previsto: "Previsto",
  faturado: "Faturado",
  recebido: "Recebido",
};

const BILLING_STATUS_COLORS: Record<string, string> = {
  previsto: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  faturado: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  recebido: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function FinanceiroDashboard() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const [accumulated, setAccumulated] = useState(false);

  const { data: allReceivables = [] } = useReceivables();
  const { data: allPayables = [] } = usePayables();
  const { data: allBillingSchedules = [] } = useAllBillingSchedules();
  const { data: installmentProposals = [] } = useAllInstallmentProposals();
  const markReceived = useMarkReceived();
  const markPaid = useMarkPaid();

  const monthStart = startOfMonth(new Date(selectedYear, selectedMonth));
  const monthEnd = endOfMonth(new Date(selectedYear, selectedMonth));
  const kpiStart = accumulated ? startOfMonth(new Date(selectedYear, 0)) : monthStart;
  const kpiEnd = monthEnd;

  const years = useMemo(() => {
    const y: number[] = [];
    for (let i = now.getFullYear() - 2; i <= now.getFullYear(); i++) y.push(i);
    return y;
  }, []);

  // KPIs
  const recebidoMes = useMemo(() =>
    allReceivables
      .filter(r => r.received_date && isWithinInterval(parseISO(r.received_date), { start: kpiStart, end: kpiEnd }))
      .reduce((s, r) => s + Number(r.amount), 0),
    [allReceivables, selectedMonth, selectedYear, accumulated]);

  const faturadoMes = useMemo(() =>
    allReceivables
      .filter(r => (r as any).competence_date && isWithinInterval(parseISO((r as any).competence_date), { start: kpiStart, end: kpiEnd }))
      .reduce((s, r) => s + Number(r.amount), 0),
    [allReceivables, selectedMonth, selectedYear, accumulated]);

  const despesaMes = useMemo(() =>
    allPayables
      .filter(p => p.paid_date && isWithinInterval(parseISO(p.paid_date), { start: kpiStart, end: kpiEnd }))
      .reduce((s, p) => s + Number(p.amount), 0),
    [allPayables, selectedMonth, selectedYear, accumulated]);

  const resultado = faturadoMes - despesaMes;

  const aReceber30 = useMemo(() => {
    if (accumulated) {
      return allReceivables
        .filter(r => r.status === "pendente" && isWithinInterval(parseISO(r.due_date), { start: kpiStart, end: kpiEnd }))
        .reduce((s, r) => s + Number(r.amount), 0);
    }
    const limit = addDays(monthEnd, 30);
    return allReceivables
      .filter(r => r.status === "pendente" && isWithinInterval(parseISO(r.due_date), { start: monthStart, end: limit }))
      .reduce((s, r) => s + Number(r.amount), 0);
  }, [allReceivables, selectedMonth, selectedYear, accumulated]);

  // ── Fluxo de Caixa Real — 12 meses do ano selecionado ──────────────────
  // Usa exatamente os mesmos registros gravados na tabela `payables`/`receivables`.
  // Parcelas recorrentes já existem como linhas independentes no banco, então
  // não há mais projeção em runtime — o que aparece aqui é o que está em Contas a Pagar.
  const realCashFlowData = useMemo(() => {
    return MONTH_NAMES.map((label, idx) => {
      const ms = startOfMonth(new Date(selectedYear, idx));
      const me = endOfMonth(new Date(selectedYear, idx));
      const recebido = allReceivables
        .filter(r =>
          (r.status === "pago" || r.status === "recebido") &&
          r.received_date &&
          isWithinInterval(parseISO(r.received_date), { start: ms, end: me })
        )
        .reduce((s, r) => s + Number(r.amount), 0);
      const pago = allPayables
        .filter(p => p.status === "pago" && p.paid_date && isWithinInterval(parseISO(p.paid_date), { start: ms, end: me }))
        .reduce((s, p) => s + Number(p.amount), 0);
      const pendente = allPayables
        .filter(p =>
          (p.status === "pendente" || p.status === "em_aberto") &&
          isWithinInterval(parseISO(p.due_date), { start: ms, end: me })
        )
        .reduce((s, p) => s + Number(p.amount), 0);
      return {
        name: label.slice(0, 3),
        recebido,
        pago,
        pendente,
        resultado: recebido - pago,
      };
    });
  }, [allReceivables, allPayables, selectedYear]);

  // Expenses by category
  const catData = useMemo(() => {
    const map: Record<string, number> = {};
    allPayables
      .filter(p => p.paid_date && isWithinInterval(parseISO(p.paid_date), { start: monthStart, end: monthEnd }))
      .forEach(p => { map[p.category] = (map[p.category] || 0) + Number(p.amount); });
    return Object.entries(map).map(([k, v]) => ({ name: CAT_LABELS[k] || k, value: v, color: PIE_COLORS[k] || PIE_COLORS.outros }));
  }, [allPayables, selectedMonth, selectedYear]);

  // ── Upcoming: filtros independentes ───────────────────────────────────────
  const [recPeriod, setRecPeriod] = useState<string>("30");
  const [recStatus, setRecStatus] = useState<string>("todos");
  const [recCategory, setRecCategory] = useState<string>("todos");
  const [recClient, setRecClient] = useState<string>("todos");
  const [recSortDesc, setRecSortDesc] = useState<boolean>(true);

  const [payPeriod, setPayPeriod] = useState<string>("30");
  const [payStatus, setPayStatus] = useState<string>("todos");
  const [payCategory, setPayCategory] = useState<string>("todos");
  const [paySortDesc, setPaySortDesc] = useState<boolean>(true);

  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");

  // Categorias dinâmicas
  const recCategories = useMemo(() => {
    const set = new Set<string>();
    allReceivables.forEach(r => r.category && set.add(r.category));
    return Array.from(set).sort();
  }, [allReceivables]);

  const payCategories = useMemo(() => {
    const set = new Set<string>();
    allPayables.forEach(p => p.category && set.add(p.category));
    return Array.from(set).sort();
  }, [allPayables]);

  // Lista de clientes únicos do bloco a receber
  const recClients = useMemo(() => {
    const set = new Set<string>();
    allReceivables.forEach(r => r.client_name && set.add(r.client_name));
    return Array.from(set).sort();
  }, [allReceivables]);

  // Status efetivo (calcula "vencido" no front)
  const computeStatus = (status: string, dueDate: string, paidOrReceived: string | null) => {
    if (status === "pago" || status === "recebido") return "pago";
    if (status === "em_aberto") {
      if (dueDate < todayStr) return "vencido";
      return "em_aberto";
    }
    if (status === "pendente") {
      if (dueDate < todayStr && !paidOrReceived) return "vencido";
      return "pendente";
    }
    return status;
  };

  const periodLimit = (days: string): Date | null => {
    if (days === "all") return null;
    return addDays(today, Number(days));
  };

  // Receivables expandido (sem expansão recorrente — receivables não são recorrentes no schema)
  const upcomingRecRows = useMemo(() => {
    const limit = periodLimit(recPeriod);
    let rows = allReceivables.map(r => ({
      id: r.id,
      name: r.client_name,
      description: r.description,
      category: r.category,
      due_date: r.due_date,
      amount: Number(r.amount),
      status: computeStatus(r.status, r.due_date, r.received_date),
      rawStatus: r.status,
      isRecurrent: false,
      type: "rec" as const,
    }));
    if (limit) {
      rows = rows.filter(r => parseISO(r.due_date) <= limit);
    }
    if (recStatus !== "todos") rows = rows.filter(r => r.status === recStatus);
    if (recCategory !== "todos") rows = rows.filter(r => r.category === recCategory);
    if (recClient !== "todos") rows = rows.filter(r => r.name === recClient);
    rows.sort((a, b) => recSortDesc ? b.amount - a.amount : a.amount - b.amount);
    return rows;
  }, [allReceivables, recPeriod, recStatus, recCategory, recClient, recSortDesc, todayStr]);

  // Payables expandido com parcelas recorrentes
  const upcomingPayRows = useMemo(() => {
    const limit = periodLimit(payPeriod);
    // Parcelas recorrentes já estão gravadas como linhas independentes em `payables`,
    // então não há mais expansão em runtime — apenas listamos o que existe no DB.
    const expanded: Array<{
      id: string;
      name: string;
      description: string;
      category: string;
      due_date: string;
      amount: number;
      status: string;
      rawStatus: string;
      isRecurrent: boolean;
      type: "pay";
    }> = [];

    allPayables.forEach(p => {
      expanded.push({
        id: p.id,
        name: p.supplier || p.description,
        description: p.description,
        category: p.category,
        due_date: p.due_date,
        amount: Number(p.amount),
        status: computeStatus(p.status, p.due_date, p.paid_date),
        rawStatus: p.status,
        isRecurrent: !!p.recurrent,
        type: "pay",
      });
    });

    let rows = expanded;
    if (limit) rows = rows.filter(r => parseISO(r.due_date) <= limit);
    if (payStatus !== "todos") rows = rows.filter(r => r.status === payStatus);
    if (payCategory !== "todos") rows = rows.filter(r => r.category === payCategory);
    rows.sort((a, b) => paySortDesc ? b.amount - a.amount : a.amount - b.amount);
    return rows;
  }, [allPayables, payPeriod, payStatus, payCategory, paySortDesc, todayStr]);

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
    { title: accumulated ? "Receita Acumulada" : "Receita do Mês", value: fmt(receitaMes), icon: TrendingUp, color: "text-emerald-400" },
    { title: accumulated ? "Despesas Acumuladas" : "Despesas do Mês", value: fmt(despesaMes), icon: TrendingDown, color: "text-red-400" },
    { title: accumulated ? "Resultado Acumulado" : "Resultado do Mês", value: fmt(resultado), icon: DollarSign, color: resultado >= 0 ? "text-emerald-400" : "text-red-400" },
    { title: accumulated ? "A Receber (acumulado)" : "A Receber (período)", value: fmt(aReceber30), icon: Clock, color: "text-accent" },
  ];

  // ── Fluxo de Caixa Previsto (Billing Schedule) ────────────────────────────
  const [billingViewYear, setBillingViewYear] = useState(now.getFullYear());

  // Meses com itens agendados para o ano selecionado
  // Inclui: (a) entradas por etapa do modo "medicao"; (b) parcelas geradas das propostas em modo "parcelado"
  type BillingItem = (typeof allBillingSchedules)[number] & { __synthetic?: boolean };

  const billingByMonth = useMemo(() => {
    const map: Record<number, BillingItem[]> = {};
    for (let m = 1; m <= 12; m++) map[m] = [];

    // (a) Entradas reais por etapa — apenas para propostas que NÃO estão em modo parcelado
    allBillingSchedules
      .filter(e => {
        if (e.billing_year !== billingViewYear) return false;
        const mode = (e as any).commercial_proposals?.billing_mode;
        return mode !== "parcelado";
      })
      .forEach(e => {
        if (!map[e.billing_month]) map[e.billing_month] = [];
        map[e.billing_month].push(e as BillingItem);
      });

    // (b) Parcelas sintéticas — uma entrada por mês para cada parcela
    for (const p of installmentProposals) {
      const count = p.installment_count || 0;
      const startM = p.installment_start_month || 0;
      const startY = p.installment_start_year || 0;
      const total = Number(p.final_total_value || p.total_value || 0);
      if (count <= 0 || startM <= 0 || startY <= 0 || total <= 0) continue;
      const valor = total / count;
      for (let i = 0; i < count; i++) {
        const m = ((startM - 1 + i) % 12) + 1;
        const y = startY + Math.floor((startM - 1 + i) / 12);
        if (y !== billingViewYear) continue;
        const synthetic: any = {
          id: `installment-${p.id}-${i}`,
          proposal_id: p.id,
          stage_label: `Parcela ${i + 1}/${count}`,
          amount: valor,
          status: "previsto",
          billing_month: m,
          billing_year: y,
          is_installment: true,
          installment_count: count,
          commercial_proposals: {
            project_name: p.project_name,
            client_id: p.client_id,
            billing_mode: "parcelado",
            commercial_clients: p.commercial_clients,
          },
          __synthetic: true,
        };
        if (!map[m]) map[m] = [];
        map[m].push(synthetic);
      }
    }
    return map;
  }, [allBillingSchedules, installmentProposals, billingViewYear]);

  const billingChartData = useMemo(() => {
    return MONTH_LABELS.map((label, idx) => {
      const entries = billingByMonth[idx + 1] || [];
      const previsto = entries.filter(e => e.status === "previsto").reduce((s, e) => s + Number(e.amount), 0);
      const faturado = entries.filter(e => e.status === "faturado").reduce((s, e) => s + Number(e.amount), 0);
      const recebido = entries.filter(e => e.status === "recebido").reduce((s, e) => s + Number(e.amount), 0);
      return { name: label.slice(0, 3), previsto, faturado, recebido, total: previsto + faturado + recebido };
    });
  }, [billingByMonth]);

  const totalPrevistoAno = billingChartData.reduce((s, d) => s + d.previsto + d.faturado + d.recebido, 0);

  // Itens do mês selecionado no fluxo previsto
  const [billingDetailMonth, setBillingDetailMonth] = useState<number | null>(null);
  const billingDetailItems = billingDetailMonth ? (billingByMonth[billingDetailMonth] || []) : [];

  // ── Análise por Projeto ──────────────────────────────────────────────────
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [projectPopoverOpen, setProjectPopoverOpen] = useState(false);

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

  const billingYearOptions = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1, now.getFullYear() + 2];

  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">Dashboard Financeiro</h1>
          <div className="flex items-center gap-2">
            <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((m, i) => (
                  <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={accumulated ? "default" : "outline"}
              onClick={() => setAccumulated(v => !v)}
              className="gap-2"
            >
              Acumulado
            </Button>
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

        {/* Despesas por Categoria + Upcoming header */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Despesas por Categoria — {MONTH_NAMES[selectedMonth]}/{selectedYear}</CardTitle></CardHeader>
          <CardContent>
            {catData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-16">Sem despesas pagas neste mês</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={catData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {catData.map((c, i) => <Cell key={i} fill={c.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Upcoming */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── A RECEBER ───────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Próximos Vencimentos — A Receber</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Filtros */}
              <div className="flex flex-wrap gap-2">
                <Select value={recPeriod} onValueChange={setRecPeriod}>
                  <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Próximos 7 dias</SelectItem>
                    <SelectItem value="15">Próximos 15 dias</SelectItem>
                    <SelectItem value="30">Próximos 30 dias</SelectItem>
                    <SelectItem value="60">Próximos 60 dias</SelectItem>
                    <SelectItem value="all">Todos</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={recStatus} onValueChange={setRecStatus}>
                  <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos status</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="pago">Recebido</SelectItem>
                    <SelectItem value="em_aberto">Em aberto</SelectItem>
                    <SelectItem value="vencido"><span className="text-orange-500 font-medium">Vencido</span></SelectItem>
                  </SelectContent>
                </Select>
                <Select value={recCategory} onValueChange={setRecCategory}>
                  <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Categorias</SelectItem>
                    {recCategories.map(c => (
                      <SelectItem key={c} value={c}>{CAT_LABELS[c] || c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={recClient} onValueChange={setRecClient}>
                  <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos clientes</SelectItem>
                    {recClients.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" className="h-8 px-2 text-xs"
                  onClick={() => setRecSortDesc(!recSortDesc)}
                  title="Ordenar por valor"
                >
                  Valor {recSortDesc ? <ArrowDown className="h-3 w-3 ml-1" /> : <ArrowUp className="h-3 w-3 ml-1" />}
                </Button>
              </div>

              {/* Tabela com altura fixa */}
              <div className="border rounded-md overflow-hidden">
                <div className="overflow-y-auto" style={{ maxHeight: "calc(6 * 44px + 36px)" }}>
                  <Table>
                    <TableHeader className="sticky top-0 bg-card z-10">
                      <TableRow>
                        <TableHead className="text-xs h-9">Cliente</TableHead>
                        <TableHead className="text-xs h-9">Categoria</TableHead>
                        <TableHead className="text-xs h-9">Vencimento</TableHead>
                        <TableHead className="text-xs h-9 text-right">Valor</TableHead>
                        <TableHead className="text-xs h-9">Status</TableHead>
                        <TableHead className="text-xs h-9 w-[40px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {upcomingRecRows.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground text-xs py-6">
                            Nenhum lançamento encontrado
                          </TableCell>
                        </TableRow>
                      )}
                      {upcomingRecRows.map(r => (
                        <TableRow key={r.id} className="h-11">
                          <TableCell className="text-xs font-medium truncate max-w-[160px]">{r.name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{CAT_LABELS[r.category] || r.category}</TableCell>
                          <TableCell className="text-xs">{format(parseISO(r.due_date), "dd/MM/yy")}</TableCell>
                          <TableCell className="text-xs text-right font-semibold">{fmt(r.amount)}</TableCell>
                          <TableCell><StatusBadge status={r.status} /></TableCell>
                          <TableCell>
                            {r.status !== "pago" && (
                              <Popover open={datePickerFor?.id === r.id && datePickerFor?.type === "rec"} onOpenChange={(o) => !o && setDatePickerFor(null)}>
                                <PopoverTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Marcar como recebido"
                                    onClick={() => { setDatePickerFor({ type: "rec", id: r.id }); setSelectedDate(new Date()); }}>
                                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="end">
                                  <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} className={cn("p-3 pointer-events-auto")} />
                                  <div className="p-2 border-t flex justify-end"><Button size="sm" onClick={handleConfirmDate}>Confirmar</Button></div>
                                </PopoverContent>
                              </Popover>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── A PAGAR ─────────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Próximos Vencimentos — A Pagar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Filtros */}
              <div className="flex flex-wrap gap-2">
                <Select value={payPeriod} onValueChange={setPayPeriod}>
                  <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Próximos 7 dias</SelectItem>
                    <SelectItem value="15">Próximos 15 dias</SelectItem>
                    <SelectItem value="30">Próximos 30 dias</SelectItem>
                    <SelectItem value="60">Próximos 60 dias</SelectItem>
                    <SelectItem value="all">Todos</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={payStatus} onValueChange={setPayStatus}>
                  <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos status</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="em_aberto">Em aberto</SelectItem>
                    <SelectItem value="vencido">
                      <span className="text-orange-500 font-semibold">Vencido</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Select value={payCategory} onValueChange={setPayCategory}>
                  <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Categorias</SelectItem>
                    {payCategories.map(c => (
                      <SelectItem key={c} value={c}>{CAT_LABELS[c] || c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" className="h-8 px-2 text-xs"
                  onClick={() => setPaySortDesc(!paySortDesc)}
                  title="Ordenar por valor"
                >
                  Valor {paySortDesc ? <ArrowDown className="h-3 w-3 ml-1" /> : <ArrowUp className="h-3 w-3 ml-1" />}
                </Button>
              </div>

              {/* Tabela */}
              <div className="border rounded-md overflow-hidden">
                <div className="overflow-y-auto" style={{ maxHeight: "calc(6 * 44px + 36px)" }}>
                  <Table>
                    <TableHeader className="sticky top-0 bg-card z-10">
                      <TableRow>
                        <TableHead className="text-xs h-9">Fornecedor</TableHead>
                        <TableHead className="text-xs h-9">Categoria</TableHead>
                        <TableHead className="text-xs h-9">Vencimento</TableHead>
                        <TableHead className="text-xs h-9 text-right">Valor</TableHead>
                        <TableHead className="text-xs h-9">Status</TableHead>
                        <TableHead className="text-xs h-9 w-[40px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {upcomingPayRows.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground text-xs py-6">
                            Nenhum lançamento encontrado
                          </TableCell>
                        </TableRow>
                      )}
                      {upcomingPayRows.map(p => (
                        <TableRow key={p.id} className="h-11">
                          <TableCell className="text-xs font-medium truncate max-w-[160px]">
                            <div className="flex items-center gap-1">
                              {p.isRecurrent && <Repeat className="h-3 w-3 text-muted-foreground shrink-0" />}
                              <span className="truncate">{p.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{CAT_LABELS[p.category] || p.category}</TableCell>
                          <TableCell className="text-xs">{format(parseISO(p.due_date), "dd/MM/yy")}</TableCell>
                          <TableCell className="text-xs text-right font-semibold">{fmt(p.amount)}</TableCell>
                          <TableCell><StatusBadge status={p.status} /></TableCell>
                          <TableCell>
                            {p.status !== "pago" && !p.id.includes("-20") && (
                              <Popover open={datePickerFor?.id === p.id && datePickerFor?.type === "pay"} onOpenChange={(o) => !o && setDatePickerFor(null)}>
                                <PopoverTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Marcar como pago"
                                    onClick={() => { setDatePickerFor({ type: "pay", id: p.id }); setSelectedDate(new Date()); }}>
                                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="end">
                                  <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} className={cn("p-3 pointer-events-auto")} />
                                  <div className="p-2 border-t flex justify-end"><Button size="sm" onClick={handleConfirmDate}>Confirmar</Button></div>
                                </PopoverContent>
                              </Popover>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ════════════════════════════════════════════════════════════════
            FLUXO DE CAIXA PREVISTO — Cronograma de Propostas Aprovadas
        ════════════════════════════════════════════════════════════════ */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-blue-400" />
                Fluxo de Caixa Previsto — Propostas Aprovadas
              </CardTitle>
              <div className="flex items-center gap-2">
                <Select value={String(billingViewYear)} onValueChange={(v) => { setBillingViewYear(Number(v)); setBillingDetailMonth(null); }}>
                  <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {billingYearOptions.map(y => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {totalPrevistoAno === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarClock className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nenhum faturamento previsto para {billingViewYear}.</p>
                <p className="text-xs mt-1">Configure o cronograma de faturamento nas Propostas Aprovadas.</p>
              </div>
            ) : (
              <>
                {/* KPI total do ano — apenas orientativo */}
                <div className="flex gap-4 flex-wrap items-center">
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg px-4 py-3">
                    <p className="text-xs text-muted-foreground">Total Previsto {billingViewYear}</p>
                    <p className="text-xl font-bold text-blue-400">{fmt(totalPrevistoAno)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground italic">
                    ℹ️ Valores orientativos — baseados no cronograma de propostas aprovadas.
                  </p>
                </div>

                {/* Gráfico de barras */}
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={billingChartData}
                    onClick={(data) => {
                      if (data?.activeTooltipIndex !== undefined) {
                        const month = data.activeTooltipIndex + 1;
                        setBillingDetailMonth(billingDetailMonth === month ? null : month);
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <Tooltip
                      formatter={(v: number) => fmt(v)}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                      cursor={{ fill: "hsl(var(--accent))", opacity: 0.15 }}
                    />
                    <Legend />
                    <Bar dataKey="previsto" name="Previsto" fill="hsl(220, 70%, 55%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>

                <p className="text-xs text-muted-foreground text-center">
                  Clique em um mês no gráfico para ver o detalhamento dos faturamentos previstos.
                </p>

                {/* Detalhamento do mês clicado */}
                {billingDetailMonth !== null && (
                  <Card className="border-blue-500/30 bg-blue-500/5">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">
                          Detalhamento — {MONTH_LABELS[billingDetailMonth - 1]}/{billingViewYear}
                        </CardTitle>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setBillingDetailMonth(null)}
                          title="Fechar detalhamento"
                        >
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {billingDetailItems.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhum faturamento previsto neste mês.</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Projeto</TableHead>
                              <TableHead>Cliente</TableHead>
                              <TableHead>Etapa</TableHead>
                              <TableHead>Parcelado</TableHead>
                              <TableHead className="text-right">Valor</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {billingDetailItems.map((entry) => (
                              <TableRow key={entry.id}>
                                <TableCell className="font-medium text-sm">
                                  {(entry as any).commercial_proposals?.project_name || "—"}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {(entry as any).commercial_proposals?.commercial_clients?.name || "—"}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">{entry.stage_label}</Badge>
                                </TableCell>
                                <TableCell className="text-sm">
                                  {(entry as any).__synthetic ? (
                                    <span className="text-blue-400">
                                      {entry.installment_count}× de {fmt(Number(entry.amount))}
                                    </span>
                                  ) : entry.is_installment ? (
                                    <span className="text-blue-400">
                                      {entry.installment_count}× de {fmt(Number(entry.amount) / (entry.installment_count || 1))}
                                    </span>
                                  ) : "—"}
                                </TableCell>
                                <TableCell className="text-right font-semibold">{fmt(Number(entry.amount))}</TableCell>
                                <TableCell>
                                  <Badge className={BILLING_STATUS_COLORS[entry.status] || ""}>
                                    {BILLING_STATUS_LABELS[entry.status] || entry.status}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* ════════════════════════════════════════════════════════════════
            FLUXO DE CAIXA REAL — Contas a Receber / Contas a Pagar
        ════════════════════════════════════════════════════════════════ */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
                Fluxo de Caixa Real — {selectedYear}
              </CardTitle>
              <p className="text-xs text-muted-foreground italic">Baseado nos lançamentos de Contas a Receber e Contas a Pagar</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* KPIs do ano */}
            <div className="flex gap-4 flex-wrap">
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-3">
                <p className="text-xs text-muted-foreground">Total Recebido {selectedYear}</p>
                <p className="text-xl font-bold text-emerald-400">
                  {fmt(realCashFlowData.reduce((s, d) => s + d.recebido, 0))}
                </p>
              </div>
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
                <p className="text-xs text-muted-foreground">Total Pago {selectedYear}</p>
                <p className="text-xl font-bold text-red-400">
                  {fmt(realCashFlowData.reduce((s, d) => s + d.pago, 0))}
                </p>
              </div>
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg px-4 py-3">
                <p className="text-xs text-muted-foreground">Total Pendente {selectedYear}</p>
                <p className="text-xl font-bold text-orange-400">
                  {fmt(realCashFlowData.reduce((s, d) => s + d.pendente, 0))}
                </p>
              </div>
              <div className={cn(
                "rounded-lg px-4 py-3 border",
                realCashFlowData.reduce((s, d) => s + d.resultado, 0) >= 0
                  ? "bg-emerald-500/10 border-emerald-500/30"
                  : "bg-red-500/10 border-red-500/30"
              )}>
                <p className="text-xs text-muted-foreground">Resultado Acumulado {selectedYear}</p>
                <p className={cn("text-xl font-bold",
                  realCashFlowData.reduce((s, d) => s + d.resultado, 0) >= 0 ? "text-emerald-400" : "text-red-400"
                )}>
                  {fmt(realCashFlowData.reduce((s, d) => s + d.resultado, 0))}
                </p>
              </div>
            </div>

            {/* Gráfico barras + linha resultado */}
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={realCashFlowData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <Tooltip
                  formatter={(v: number) => fmt(v)}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                />
                <Legend />
                <Bar dataKey="recebido" name="Recebido" fill="hsl(150, 60%, 45%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pago" name="Pago" fill="hsl(0, 60%, 50%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pendente" name="Pendente de Pagamento" fill="hsl(30, 90%, 55%)" radius={[4, 4, 0, 0]} />
                <Line
                  type="monotone"
                  dataKey="resultado"
                  name="Resultado"
                  stroke="hsl(50, 95%, 55%)"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

                {/* ════ Análise por Projeto ════ */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Análise por Projeto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Popover open={projectPopoverOpen} onOpenChange={setProjectPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full max-w-md justify-between font-normal text-sm h-10">
                    {selectedProjectId
                      ? (() => { const p = projetos.find((p: any) => p.id === selectedProjectId); return p ? `${p.name} — ${p.client}` : "Selecione um projeto..."; })()
                      : "Selecione um projeto para ver a análise de custo detalhada"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command filter={(value, search) => {
                    const p = projetos.find((p: any) => p.id === value);
                    if (!p) return 0;
                    const haystack = `${p.name} ${p.client} ${p.discipline}`.toLowerCase();
                    return haystack.includes(search.toLowerCase()) ? 1 : 0;
                  }}>
                    <CommandInput placeholder="Buscar por nome, cliente ou disciplina..." />
                    <CommandList>
                      <CommandEmpty>Nenhum projeto encontrado.</CommandEmpty>
                      <CommandGroup>
                        {projetos.map((p: any) => (
                          <CommandItem
                            key={p.id}
                            value={p.id}
                            onSelect={(val) => {
                              setSelectedProjectId(val === selectedProjectId ? null : val);
                              setShowAllTasks(false);
                              setProjectPopoverOpen(false);
                            }}
                          >
                            <Check className={`mr-2 h-4 w-4 ${selectedProjectId === p.id ? "opacity-100" : "opacity-0"}`} />
                            {p.name} — {p.client}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {!selectedProjectId && (
              <p className="text-sm text-muted-foreground text-center py-8">Selecione um projeto para ver a análise de custo detalhada</p>
            )}

            {selectedProjectId && loadingProjeto && (
              <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
            )}

            {projetoCusto && (
              <>
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

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                              {showAllTasks
                                ? <><ChevronUp className="h-4 w-4 mr-1" /> Mostrar menos</>
                                : <><ChevronDown className="h-4 w-4 mr-1" /> Ver todas ({projetoCusto.detalhesPorTarefa.length})</>}
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
