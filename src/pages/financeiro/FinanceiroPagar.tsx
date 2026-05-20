import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Plus, CheckCircle, Pencil, Trash2, Search, RefreshCw, ChevronLeft, ChevronRight, Trash, ChevronDown } from "lucide-react";
import { usePayables, useCreatePayable, useUpdatePayable, useDeletePayable, useMarkPaid, Payable } from "@/hooks/useFinanceiroData";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtNum = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CAT_COLORS: Record<string, string> = {
  salario: "bg-blue-500/20 text-blue-400", prolabore: "bg-purple-500/20 text-purple-400",
  aluguel: "bg-orange-500/20 text-orange-400", software: "bg-cyan-500/20 text-cyan-400",
  impostos: "bg-red-500/20 text-red-400", marketing: "bg-pink-500/20 text-pink-400",
  equipamento: "bg-yellow-500/20 text-yellow-400", outros: "bg-muted text-muted-foreground",
};
const CAT_LABELS: Record<string, string> = {
  salario: "Salário", prolabore: "Pró-labore", aluguel: "Aluguel",
  software: "Software", impostos: "Impostos", marketing: "Marketing",
  equipamento: "Equipamento", outros: "Outros",
};
const CATEGORIES = ["salario", "prolabore", "aluguel", "software", "impostos", "marketing", "equipamento", "outros"];

const now = new Date();

type TabKey = "todos" | "vencidos" | "vencem_hoje" | "a_vencer" | "pagos";

export default function FinanceiroPagar() {
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [activeTab, setActiveTab] = useState<TabKey>("todos");
  const [catFilter, setCatFilter] = useState("todos");
  const [supplierFilter, setSupplierFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [dueDateFilter, setDueDateFilter] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Payable | null>(null);

  // Buscamos só pelo mês/ano + busca textual; o resto filtramos no client p/ as abas funcionarem.
  const queryFilters = useMemo(() => ({ month, year, search }), [month, year, search]);
  const { data: payablesAll = [] } = usePayables(queryFilters);
  const createPay = useCreatePayable();
  const updatePay = useUpdatePayable();
  const deletePay = useDeletePayable();
  const markPaid = useMarkPaid();

  const todayStr = format(now, "yyyy-MM-dd");

  // Lista de fornecedores únicos do período (para o dropdown "Conta")
  const suppliers = useMemo(() => {
    const set = new Set<string>();
    payablesAll.forEach(p => { if (p.supplier) set.add(p.supplier); });
    return Array.from(set).sort();
  }, [payablesAll]);

  // Filtros adicionais (categoria/status/fornecedor) aplicados no client
  const baseFiltered = useMemo(() => {
    return payablesAll.filter(p => {
      if (catFilter !== "todos" && p.category !== catFilter) return false;
      if (supplierFilter !== "todos" && (p.supplier || "") !== supplierFilter) return false;
      if (statusFilter !== "todos") {
        // status efetivo (com "atrasado" computado dinamicamente)
        const eff = p.status === "pago" ? "pago"
          : p.due_date < todayStr ? "atrasado" : "pendente";
        if (eff !== statusFilter) return false;
      }
      return true;
    });
  }, [payablesAll, catFilter, supplierFilter, statusFilter, todayStr]);

  // Totais por aba (calculados sobre baseFiltered, antes da aba)
  const totals = useMemo(() => {
    let vencidos = 0, vencemHoje = 0, aVencer = 0, pagos = 0, total = 0;
    baseFiltered.forEach(p => {
      const v = Number(p.amount);
      total += v;
      if (p.status === "pago") { pagos += v; return; }
      if (p.due_date < todayStr) vencidos += v;
      else if (p.due_date === todayStr) vencemHoje += v;
      else aVencer += v;
    });
    return { vencidos, vencemHoje, aVencer, pagos, total };
  }, [baseFiltered, todayStr]);

  // Lista exibida segundo a aba
  const payables = useMemo(() => {
    return baseFiltered.filter(p => {
      switch (activeTab) {
        case "vencidos": return p.status !== "pago" && p.due_date < todayStr;
        case "vencem_hoje": return p.status !== "pago" && p.due_date === todayStr;
        case "a_vencer": return p.status !== "pago" && p.due_date > todayStr;
        case "pagos": return p.status === "pago";
        default: return true;
      }
    });
  }, [baseFiltered, activeTab, todayStr]);

  const empty = { description: "", supplier: "", amount: 0, due_date: format(now, "yyyy-MM-dd"), category: "outros", recurrent: false, recurrent_day: null as number | null, installments: 12, notes: "" };
  const [form, setForm] = useState(empty);

  const openNew = () => { setEditing(null); setForm(empty); setDialogOpen(true); };
  const openEdit = (p: Payable) => {
    setEditing(p);
    setForm({ description: p.description, supplier: p.supplier || "", amount: Number(p.amount), due_date: p.due_date, category: p.category, recurrent: p.recurrent, recurrent_day: p.recurrent_day, installments: 1, notes: p.notes || "" });
    setDialogOpen(true);
  };

  const handleSave = () => {
    const { installments, ...rest } = form;
    const payload: any = { ...rest, amount: Number(form.amount), paid_date: null, status: "pendente", recurrent_day: form.recurrent ? form.recurrent_day : null };
    if (editing) {
      updatePay.mutate({ id: editing.id, ...payload }, { onSuccess: () => setDialogOpen(false) });
    } else {
      createPay.mutate({ ...payload, installments: form.recurrent ? installments : 1 }, { onSuccess: () => setDialogOpen(false) });
    }
  };

  const [datePickerFor, setDatePickerFor] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const monthLabel = format(new Date(year, month, 1), "MMMM 'de' yyyy", { locale: ptBR });
  const monthLabelCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  const navMonth = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setMonth(d.getMonth());
    setYear(d.getFullYear());
  };

  const clearFilters = () => {
    setActiveTab("todos");
    setCatFilter("todos");
    setSupplierFilter("todos");
    setStatusFilter("todos");
    setSearch("");
    setMonth(now.getMonth());
    setYear(now.getFullYear());
  };

  const filtersActive = activeTab !== "todos" || catFilter !== "todos" || supplierFilter !== "todos" || statusFilter !== "todos" || search !== "";

  // Tabs config
  const tabs: { key: TabKey; label: string; value: number; color: string }[] = [
    { key: "vencidos", label: "Vencidos (R$)", value: totals.vencidos, color: "text-red-500" },
    { key: "vencem_hoje", label: "Vencem hoje (R$)", value: totals.vencemHoje, color: "text-orange-500" },
    { key: "a_vencer", label: "A vencer (R$)", value: totals.aVencer, color: "text-blue-500" },
    { key: "pagos", label: "Pagos (R$)", value: totals.pagos, color: "text-emerald-500" },
    { key: "todos", label: "Total do período (R$)", value: totals.total, color: "text-blue-500" },
  ];

  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Contas a Pagar</h1>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nova Conta</Button>
        </div>

        {/* Filtros — novo layout */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            {/* Vencimento (mês/ano com setas) */}
            <div className="md:col-span-3">
              <Label className="text-xs text-muted-foreground">Vencimento</Label>
              <div className="flex items-center border rounded-md h-10 overflow-hidden">
                <button type="button" onClick={() => navMonth(-1)} className="px-2 h-full hover:bg-muted transition-colors" aria-label="Mês anterior">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="flex-1 text-center text-sm font-medium flex items-center justify-center gap-1">
                  {monthLabelCap}
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </div>
                <button type="button" onClick={() => navMonth(1)} className="px-2 h-full hover:bg-muted transition-colors" aria-label="Próximo mês">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Buscar */}
            <div className="md:col-span-4">
              <Label className="text-xs text-muted-foreground">Pesquisar no período selecionado</Label>
              <div className="relative">
                <Input placeholder="Pesquisar" value={search} onChange={e => setSearch(e.target.value)} className="pr-9" />
                <Search className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            {/* Conta (fornecedor) */}
            <div className="md:col-span-3">
              <Label className="text-xs text-muted-foreground">Conta</Label>
              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger><SelectValue placeholder="Selecionar todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Selecionar todas</SelectItem>
                  {suppliers.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Mais filtros */}
            <div className="md:col-span-2">
              <Button variant="outline" className="w-full justify-between" onClick={() => setShowMore(v => !v)}>
                Mais filtros <ChevronDown className={cn("h-4 w-4 transition-transform", showMore && "rotate-180")} />
              </Button>
            </div>
          </div>

          {showMore && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 border rounded-md bg-muted/30">
              <div>
                <Label className="text-xs text-muted-foreground">Categoria</Label>
                <Select value={catFilter} onValueChange={setCatFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas</SelectItem>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{CAT_LABELS[c]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="atrasado">Atrasado</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Ano</Label>
                <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          )}

          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-400 transition-colors"
            >
              <Trash className="h-3.5 w-3.5" /> Limpar filtros
            </button>
          )}
        </div>

        {/* Abas de totais */}
        <Card>
          <CardContent className="p-0">
            <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-border">
              {tabs.map(t => {
                const active = activeTab === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setActiveTab(t.key)}
                    className={cn(
                      "px-4 py-4 text-center transition-colors relative",
                      active ? "bg-muted/40" : "hover:bg-muted/20"
                    )}
                  >
                    {active && <div className="absolute top-0 left-0 right-0 h-0.5 bg-red-500" />}
                    <p className="text-xs text-muted-foreground mb-1">{t.label}</p>
                    <p className={cn("text-xl font-semibold tabular-nums", t.color)}>{fmtNum(t.value)}</p>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Tabela */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Rec.</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payables.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhum registro</TableCell></TableRow>}
                {payables.map(p => {
                  // Status visual: "Atrasada" se pendente e vencimento já passou; "Pendente" se hoje ou futuro.
                  const isPaid = p.status === "pago";
                  const isOverdue = !isPaid && p.due_date < todayStr;
                  const visualStatus = isPaid ? "Pago" : isOverdue ? "Atrasada" : "Pendente";
                  const badgeClass = isPaid
                    ? "bg-emerald-500/20 text-emerald-400"
                    : isOverdue
                      ? "bg-red-500/20 text-red-400"
                      : "bg-yellow-500/20 text-yellow-400";
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.description}</TableCell>
                      <TableCell>{p.supplier || "—"}</TableCell>
                      <TableCell><Badge className={CAT_COLORS[p.category]}>{CAT_LABELS[p.category] || p.category}</Badge></TableCell>
                      <TableCell className="text-right font-semibold">{fmt(Number(p.amount))}</TableCell>
                      <TableCell>{format(parseISO(p.due_date), "dd/MM/yyyy")}</TableCell>
                      <TableCell>{p.paid_date ? format(parseISO(p.paid_date), "dd/MM/yyyy") : "—"}</TableCell>
                      <TableCell>{p.recurrent ? <RefreshCw className="h-4 w-4 text-accent" /> : "—"}</TableCell>
                      <TableCell><Badge className={badgeClass}>{visualStatus}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {!isPaid && (
                            <Popover open={datePickerFor === p.id} onOpenChange={o => !o && setDatePickerFor(null)}>
                              <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" title="Marcar pago" onClick={() => { setDatePickerFor(p.id); setSelectedDate(new Date()); }}>
                                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="end">
                                <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} className={cn("p-3 pointer-events-auto")} />
                                <div className="p-2 border-t flex justify-end"><Button size="sm" onClick={() => { if (selectedDate) { markPaid.mutate({ id: p.id, date: format(selectedDate, "yyyy-MM-dd") }); setDatePickerFor(null); } }}>Confirmar</Button></div>
                              </PopoverContent>
                            </Popover>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => { if (confirm("Excluir?")) deletePay.mutate(p.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Editar Conta a Pagar" : "Nova Conta a Pagar"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Descrição *</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              <div><Label>Fornecedor</Label><Input value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Valor *</Label><Input type="number" value={form.amount || ""} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} /></div>
                <div><Label>Vencimento *</Label><Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
              </div>
              <div>
                <Label>Categoria *</Label>
                <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{CAT_LABELS[c]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <Switch checked={form.recurrent} onCheckedChange={v => setForm({ ...form, recurrent: v })} disabled={!!editing} />
                <Label>Recorrente</Label>
                {form.recurrent && (
                  <>
                    <Input type="number" className="w-20" placeholder="Dia" value={form.recurrent_day || ""} onChange={e => setForm({ ...form, recurrent_day: Number(e.target.value) || null })} />
                    {!editing && (
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">Nº parcelas</Label>
                        <Input type="number" min={1} className="w-20" value={form.installments} onChange={e => setForm({ ...form, installments: Math.max(1, Number(e.target.value) || 1) })} />
                      </div>
                    )}
                  </>
                )}
              </div>
              <div><Label>Observações</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={handleSave} disabled={!form.description || !form.amount || !form.category}>{editing ? "Salvar" : "Criar"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
