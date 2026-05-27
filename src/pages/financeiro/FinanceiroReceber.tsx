import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { Plus, CheckCircle, Pencil, Trash2, Search } from "lucide-react";
import { useReceivables, useCreateReceivable, useUpdateReceivable, useDeleteReceivable, useMarkReceived, Receivable } from "@/hooks/useFinanceiroData";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { ProjectCombobox } from "@/components/ProjectCombobox";

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
    queryKey: ["projects-list-active"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id, name, client").neq("status", "concluido");
      return data || [];
    },
  });

  // Also fetch all projects for display in table (including concluded)
  const { data: allProjects = [] } = useQuery({
    queryKey: ["projects-list-all"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id, name");
      return data || [];
    },
  });

  // KPIs
  const totalAReceber = receivables.filter(r => r.status === "pendente").reduce((s, r) => s + Number(r.amount), 0);
  const totalRecebido = receivables.filter(r => r.status === "recebido").reduce((s, r) => s + Number(r.amount), 0);
  const totalAtrasado = receivables.filter(r => r.status === "atrasado").reduce((s, r) => s + Number(r.amount), 0);
  const ticketMedio = receivables.length > 0 ? receivables.reduce((s, r) => s + Number(r.amount), 0) / receivables.length : 0;

  // Form state
  const emptyForm = {
    nf_number: "",
    project_id: "",
    client_name: "",
    amount: 0,
    tax_percentage: 0,
    due_date: format(now, "yyyy-MM-dd"),
    competence_date: format(now, "yyyy-MM-dd"),
    installment_number: "",
    recurrent: false,
    installments: 12,
    frequency_months: 1,
  };
  const [form, setForm] = useState(emptyForm);

  const taxValue = (Number(form.amount) || 0) * ((Number(form.tax_percentage) || 0) / 100);

  const openNew = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (r: Receivable) => {
    setEditing(r);
    setForm({
      nf_number: (r as any).nf_number || "",
      project_id: r.project_id || "",
      client_name: r.client_name,
      amount: Number(r.amount),
      tax_percentage: Number((r as any).tax_percentage) || 0,
      due_date: r.due_date,
      installment_number: (r as any).installment_number || "",
      recurrent: false,
      installments: 12,
      frequency_months: 1,
    });
    setDialogOpen(true);
  };

  const handleProjectChange = (projectId: string) => {
    const proj = projects.find((p: any) => p.id === projectId);
    setForm(f => ({
      ...f,
      project_id: projectId,
      client_name: proj?.client || f.client_name,
    }));
  };

  const handleSave = () => {
    if (!form.project_id || !form.amount || !form.due_date) return;

    const projName = projects.find((p: any) => p.id === form.project_id)?.name || allProjects.find((p: any) => p.id === form.project_id)?.name || "";
    const description = form.nf_number ? `NF ${form.nf_number} — ${projName}` : projName;

    const payload: any = {
      description,
      client_name: form.client_name,
      amount: Number(form.amount),
      due_date: form.due_date,
      project_id: form.project_id || null,
      nf_number: form.nf_number || null,
      tax_percentage: Number(form.tax_percentage) || 0,
      installment_number: form.installment_number || null,
      category: "servico",
      notes: null,
      proposal_id: null,
      received_date: null,
      status: "pendente",
    };

    if (editing) {
      const { status: _s, received_date: _rd, ...updatePayload } = payload;
      updateRec.mutate({ id: editing.id, ...updatePayload }, { onSuccess: () => setDialogOpen(false) });
    } else {
      createRec.mutate(
        { ...payload, recurrent: form.recurrent, installments: form.installments, frequency_months: form.frequency_months },
        { onSuccess: () => setDialogOpen(false) }
      );
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
                  <TableHead>NF</TableHead>
                  <TableHead>Projeto</TableHead>
                  <TableHead>Parcela</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Imposto (R$)</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Recebimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receivables.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhum registro</TableCell></TableRow>}
                {receivables.map(r => {
                  const taxAmt = Number(r.amount) * (Number((r as any).tax_percentage) || 0) / 100;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{(r as any).nf_number || "—"}</TableCell>
                      <TableCell className="text-sm">{allProjects.find((p: any) => p.id === r.project_id)?.name || "—"}</TableCell>
                      <TableCell className="text-sm">{(r as any).installment_number || "—"}</TableCell>
                      <TableCell className="text-right font-semibold">{fmt(Number(r.amount))}</TableCell>
                      <TableCell className="text-right text-sm">{fmt(taxAmt)}</TableCell>
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
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Editar Conta a Receber" : "Nova Conta a Receber"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Número da NF</Label>
                <Input value={form.nf_number} onChange={e => setForm({ ...form, nf_number: e.target.value })} placeholder="Ex: 001234" />
              </div>
              <div>
                <Label>Projeto *</Label>
                <ProjectCombobox
                  projects={projects as any}
                  value={form.project_id}
                  onValueChange={handleProjectChange}
                  placeholder="Selecione o projeto"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Valor da NF *</Label>
                  <Input type="number" min={0} step="0.01" value={form.amount || ""} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>% Imposto NF</Label>
                  <Input type="number" min={0} max={100} step="0.01" value={form.tax_percentage || ""} onChange={e => setForm({ ...form, tax_percentage: Number(e.target.value) })} />
                  <p className="text-xs text-muted-foreground mt-1">Valor do imposto: {fmt(taxValue)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Vencimento *</Label>
                  <Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
                </div>
                <div>
                  <Label>Número da Parcela</Label>
                  <Input value={form.installment_number} onChange={e => setForm({ ...form, installment_number: e.target.value })} placeholder='Ex: 1/3 ou "Parcela única"' />
                </div>
              </div>

              {!editing && (
                <div className="space-y-3 rounded-md border border-border p-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="recurrent-receivable" className="cursor-pointer">Recebimento Recorrente</Label>
                    <Switch
                      id="recurrent-receivable"
                      checked={form.recurrent}
                      onCheckedChange={(checked) => setForm({ ...form, recurrent: checked })}
                    />
                  </div>
                  {form.recurrent && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Nº de parcelas</Label>
                        <Input
                          type="number"
                          min={1}
                          step="1"
                          value={form.installments || ""}
                          onChange={e => setForm({ ...form, installments: Number(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label>Frequência</Label>
                        <Select
                          value={String(form.frequency_months)}
                          onValueChange={v => setForm({ ...form, frequency_months: Number(v) })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">Mensal</SelectItem>
                            <SelectItem value="2">Bimestral</SelectItem>
                            <SelectItem value="3">Trimestral</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                  {form.recurrent && (
                    <p className="text-xs text-muted-foreground">
                      Serão criadas {form.installments || 0} parcelas, numeradas automaticamente (1/{form.installments}, 2/{form.installments}…), com vencimento avançando a cada {form.frequency_months} mês(es).
                    </p>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={handleSave} disabled={!form.project_id || !form.amount || !form.due_date}>
                {editing ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
