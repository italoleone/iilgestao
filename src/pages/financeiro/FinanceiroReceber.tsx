import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Plus, CheckCircle, Pencil, Trash2, Search, CalendarIcon } from "lucide-react";
import { useReceivables, useCreateReceivable, useUpdateReceivable, useDeleteReceivable, useMarkReceived, Receivable } from "@/hooks/useFinanceiroData";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const STATUS_BADGE: Record<string, string> = {
  pendente: "bg-yellow-500/20 text-yellow-400", recebido: "bg-emerald-500/20 text-emerald-400",
  atrasado: "bg-red-500/20 text-red-400", cancelado: "bg-muted text-muted-foreground",
};

const now = new Date();

export default function FinanceiroReceber() {
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [statusFilter, setStatusFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Receivable | null>(null);

  const filters = useMemo(() => ({ month, year, status: statusFilter, search }), [month, year, statusFilter, search]);
  const { data: receivables = [] } = useReceivables(filters);
  const createRec = useCreateReceivable();
  const updateRec = useUpdateReceivable();
  const deleteRec = useDeleteReceivable();
  const markReceived = useMarkReceived();

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-list"],
    queryFn: async () => { const { data } = await supabase.from("projects").select("id, name"); return data || []; },
  });

  // KPIs
  const totalAReceber = receivables.filter(r => r.status === "pendente").reduce((s, r) => s + Number(r.amount), 0);
  const totalRecebido = receivables.filter(r => r.status === "recebido").reduce((s, r) => s + Number(r.amount), 0);
  const totalAtrasado = receivables.filter(r => r.status === "atrasado").reduce((s, r) => s + Number(r.amount), 0);
  const ticketMedio = receivables.length > 0 ? receivables.reduce((s, r) => s + Number(r.amount), 0) / receivables.length : 0;

  // Form state
  const empty = { description: "", client_name: "", amount: 0, due_date: format(now, "yyyy-MM-dd"), category: "servico", project_id: "", notes: "" };
  const [form, setForm] = useState(empty);

  const openNew = () => { setEditing(null); setForm(empty); setDialogOpen(true); };
  const openEdit = (r: Receivable) => {
    setEditing(r);
    setForm({ description: r.description, client_name: r.client_name, amount: Number(r.amount), due_date: r.due_date, category: r.category, project_id: r.project_id || "", notes: r.notes || "" });
    setDialogOpen(true);
  };

  const handleSave = () => {
    const payload: any = { ...form, amount: Number(form.amount), project_id: form.project_id || null, received_date: null, status: "pendente", proposal_id: null };
    if (editing) {
      updateRec.mutate({ id: editing.id, ...payload }, { onSuccess: () => setDialogOpen(false) });
    } else {
      createRec.mutate(payload, { onSuccess: () => setDialogOpen(false) });
    }
  };

  // Date picker for mark received
  const [datePickerFor, setDatePickerFor] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Contas a Receber</h1>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nova Conta</Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { t: "Total a Receber", v: fmt(totalAReceber), c: "text-accent" },
            { t: "Recebido no Período", v: fmt(totalRecebido), c: "text-emerald-400" },
            { t: "Total Atrasado", v: fmt(totalAtrasado), c: "text-red-400" },
            { t: "Ticket Médio", v: fmt(ticketMedio), c: "text-muted-foreground" },
          ].map(k => (
            <Card key={k.t}><CardContent className="pt-6"><p className="text-xs text-muted-foreground">{k.t}</p><p className={cn("text-xl font-bold mt-1", k.c)}>{k.v}</p></CardContent></Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <Label className="text-xs">Mês</Label>
            <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>{Array.from({ length: 12 }, (_, i) => <SelectItem key={i} value={String(i)}>{format(new Date(2024, i), "MMMM", { locale: undefined })}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Ano</Label>
            <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>{[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="recebido">Recebido</SelectItem>
                <SelectItem value="atrasado">Atrasado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <Label className="text-xs">Buscar</Label>
            <div className="relative"><Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-8" placeholder="Cliente..." value={search} onChange={e => setSearch(e.target.value)} /></div>
          </div>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Projeto</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Recebimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receivables.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum registro</TableCell></TableRow>}
                {receivables.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.description}</TableCell>
                    <TableCell>{r.client_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{projects.find((p: any) => p.id === r.project_id)?.name || "—"}</TableCell>
                    <TableCell className="text-right font-semibold">{fmt(Number(r.amount))}</TableCell>
                    <TableCell>{format(parseISO(r.due_date), "dd/MM/yyyy")}</TableCell>
                    <TableCell>{r.received_date ? format(parseISO(r.received_date), "dd/MM/yyyy") : "—"}</TableCell>
                    <TableCell><Badge className={STATUS_BADGE[r.status]}>{r.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {r.status === "pendente" && (
                          <Popover open={datePickerFor === r.id} onOpenChange={o => !o && setDatePickerFor(null)}>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="icon" title="Marcar recebido" onClick={() => { setDatePickerFor(r.id); setSelectedDate(new Date()); }}>
                                <CheckCircle className="h-4 w-4 text-emerald-400" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                              <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} className={cn("p-3 pointer-events-auto")} />
                              <div className="p-2 border-t flex justify-end">
                                <Button size="sm" onClick={() => { if (selectedDate) { markReceived.mutate({ id: r.id, date: format(selectedDate, "yyyy-MM-dd") }); setDatePickerFor(null); } }}>Confirmar</Button>
                              </div>
                            </PopoverContent>
                          </Popover>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => { if (confirm("Excluir?")) deleteRec.mutate(r.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Editar Conta a Receber" : "Nova Conta a Receber"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Descrição *</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              <div><Label>Cliente *</Label><Input value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Valor *</Label><Input type="number" value={form.amount || ""} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} /></div>
                <div><Label>Vencimento *</Label><Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Categoria</Label>
                  <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="servico">Serviço</SelectItem>
                      <SelectItem value="adiantamento">Adiantamento</SelectItem>
                      <SelectItem value="outros">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Projeto</Label>
                  <Select value={form.project_id} onValueChange={v => setForm({ ...form, project_id: v })}>
                    <SelectTrigger><SelectValue placeholder="(opcional)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhum</SelectItem>
                      {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Observações</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={handleSave} disabled={!form.description || !form.client_name || !form.amount}>{editing ? "Salvar" : "Criar"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
