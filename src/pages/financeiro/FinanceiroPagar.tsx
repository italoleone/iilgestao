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
import { Plus, CheckCircle, Pencil, Trash2, Search, RefreshCw } from "lucide-react";
import { usePayables, useCreatePayable, useUpdatePayable, useDeletePayable, useMarkPaid, Payable } from "@/hooks/useFinanceiroData";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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
const STATUS_BADGE: Record<string, string> = {
  pendente: "bg-yellow-500/20 text-yellow-400", pago: "bg-emerald-500/20 text-emerald-400",
  atrasado: "bg-red-500/20 text-red-400", cancelado: "bg-muted text-muted-foreground",
};
const CATEGORIES = ["salario", "prolabore", "aluguel", "software", "impostos", "marketing", "equipamento", "outros"];

const now = new Date();

export default function FinanceiroPagar() {
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [statusFilter, setStatusFilter] = useState("todos");
  const [catFilter, setCatFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Payable | null>(null);

  const filters = useMemo(() => ({ month, year, status: statusFilter, category: catFilter, search }), [month, year, statusFilter, catFilter, search]);
  const { data: payables = [] } = usePayables(filters);
  const createPay = useCreatePayable();
  const updatePay = useUpdatePayable();
  const deletePay = useDeletePayable();
  const markPaid = useMarkPaid();

  const todayStr = format(now, "yyyy-MM-dd");
  const totalAPagar = payables.filter(p => p.status === "pendente").reduce((s, p) => s + Number(p.amount), 0);
  const totalPago = payables.filter(p => p.status === "pago").reduce((s, p) => s + Number(p.amount), 0);
  const totalAtrasado = payables
    .filter(p => p.status === "pendente" && p.due_date < todayStr)
    .reduce((s, p) => s + Number(p.amount), 0);
  const maiorDespesa = payables.length > 0 ? Math.max(...payables.map(p => Number(p.amount))) : 0;

  const empty = { description: "", supplier: "", amount: 0, due_date: format(now, "yyyy-MM-dd"), category: "outros", recurrent: false, recurrent_day: null as number | null, installments: 12, notes: "" };
  const [form, setForm] = useState(empty);

  const openNew = () => { setEditing(null); setForm(empty); setDialogOpen(true); };
  const openEdit = (p: Payable) => {
    setEditing(p);
    setForm({ description: p.description, supplier: p.supplier || "", amount: Number(p.amount), due_date: p.due_date, category: p.category, recurrent: p.recurrent, recurrent_day: p.recurrent_day, notes: p.notes || "" });
    setDialogOpen(true);
  };

  const handleSave = () => {
    const payload: any = { ...form, amount: Number(form.amount), paid_date: null, status: "pendente", recurrent_day: form.recurrent ? form.recurrent_day : null };
    if (editing) updatePay.mutate({ id: editing.id, ...payload }, { onSuccess: () => setDialogOpen(false) });
    else createPay.mutate(payload, { onSuccess: () => setDialogOpen(false) });
  };

  const [datePickerFor, setDatePickerFor] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Contas a Pagar</h1>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nova Conta</Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { t: "Total a Pagar", v: fmt(totalAPagar), c: "text-accent" },
            { t: "Total Pago", v: fmt(totalPago), c: "text-emerald-400" },
            { t: "Total Atrasado", v: fmt(totalAtrasado), c: "text-red-400" },
            { t: "Maior Despesa", v: fmt(maiorDespesa), c: "text-muted-foreground" },
          ].map(k => (
            <Card key={k.t}><CardContent className="pt-6"><p className="text-xs text-muted-foreground">{k.t}</p><p className={cn("text-xl font-bold mt-1", k.c)}>{k.v}</p></CardContent></Card>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          <div><Label className="text-xs">Mês</Label><Select value={String(month)} onValueChange={v => setMonth(Number(v))}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 12 }, (_, i) => <SelectItem key={i} value={String(i)}>{format(new Date(2024, i), "MMMM")}</SelectItem>)}</SelectContent></Select></div>
          <div><Label className="text-xs">Ano</Label><Select value={String(year)} onValueChange={v => setYear(Number(v))}><SelectTrigger className="w-24"><SelectValue /></SelectTrigger><SelectContent>{[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select></div>
          <div><Label className="text-xs">Status</Label><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos</SelectItem><SelectItem value="pendente">Pendente</SelectItem><SelectItem value="pago">Pago</SelectItem><SelectItem value="atrasado">Atrasado</SelectItem></SelectContent></Select></div>
          <div><Label className="text-xs">Categoria</Label><Select value={catFilter} onValueChange={setCatFilter}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todas</SelectItem>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{CAT_LABELS[c]}</SelectItem>)}</SelectContent></Select></div>
          <div className="flex-1 min-w-[180px]"><Label className="text-xs">Buscar</Label><div className="relative"><Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-8" placeholder="Descrição / Fornecedor..." value={search} onChange={e => setSearch(e.target.value)} /></div></div>
        </div>

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
                {payables.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.description}</TableCell>
                    <TableCell>{p.supplier || "—"}</TableCell>
                    <TableCell><Badge className={CAT_COLORS[p.category]}>{CAT_LABELS[p.category] || p.category}</Badge></TableCell>
                    <TableCell className="text-right font-semibold">{fmt(Number(p.amount))}</TableCell>
                    <TableCell>{format(parseISO(p.due_date), "dd/MM/yyyy")}</TableCell>
                    <TableCell>{p.paid_date ? format(parseISO(p.paid_date), "dd/MM/yyyy") : "—"}</TableCell>
                    <TableCell>{p.recurrent ? <RefreshCw className="h-4 w-4 text-accent" /> : "—"}</TableCell>
                    <TableCell><Badge className={STATUS_BADGE[p.status]}>{p.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {p.status === "pendente" && (
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
                ))}
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
              <div className="flex items-center gap-3">
                <Switch checked={form.recurrent} onCheckedChange={v => setForm({ ...form, recurrent: v })} />
                <Label>Recorrente</Label>
                {form.recurrent && <Input type="number" className="w-24" placeholder="Dia" value={form.recurrent_day || ""} onChange={e => setForm({ ...form, recurrent_day: Number(e.target.value) || null })} />}
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
