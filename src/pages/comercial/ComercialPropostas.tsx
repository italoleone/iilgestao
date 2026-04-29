import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import {
  useCommercialProposals, useCommercialClients, useCreateProposal, useUpdateProposal,
  useApproveProposal, useDeleteProposal, useClientHistory, useBillingSchedule,
  useSaveBillingSchedule,
  PROPOSAL_STATUS_LABELS, BILLING_STAGES, MONTH_LABELS,
  type ProposalStatus, type CommercialProposal, type ProposalDisciplines,
  type ProposalDiscounts, type BillingStageKey, type UpsertBillingScheduleInput,
} from "@/hooks/useCommercialData";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, Eye, CheckCircle, XCircle, FileDown, Trash2, CalendarClock, Info, Pencil } from "lucide-react";
import { toast } from "sonner";

const STATUS_COLORS: Record<ProposalStatus, string> = {
  lead: "bg-muted text-muted-foreground",
  contato_feito: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  em_elaboracao: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  enviada: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  em_negociacao: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  aprovada: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  reprovada: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const DISC_LABELS: Record<string, string> = {
  estrutural: "Estrutural",
  hidraulica: "Hidráulica",
  eletrica: "Elétrica",
  fundacoes: "Fundações",
};

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function ComercialPropostas() {
  const { data: proposals = [] } = useCommercialProposals();
  const { data: clients = [] } = useCommercialClients();
  const createProposal = useCreateProposal();
  const updateProposal = useUpdateProposal();
  const approveProposal = useApproveProposal();
  const deleteProposal = useDeleteProposal();
  const { user, isDiretorOrGerente } = useAuth();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailProposal, setDetailProposal] = useState<CommercialProposal | null>(null);
  const [approvalTarget, setApprovalTarget] = useState<CommercialProposal | null>(null);
  const [coordinatorTarget, setCoordinatorTarget] = useState<CommercialProposal | null>(null);
  const [coordinatorSelections, setCoordinatorSelections] = useState<Record<string, string>>({});
  const [activeUsers, setActiveUsers] = useState<{ id: string; name: string }[]>([]);
  const [gerandoPDF, setGerandoPDF] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Estado do modal de cronograma de faturamento
  const [billingProposal, setBillingProposal] = useState<CommercialProposal | null>(null);

  const [form, setForm] = useState({
    client_id: "",
    project_name: "",
    area_m2: "",
    pm2_estrutural: "",
    pm2_hidraulica: "",
    pm2_eletrica: "",
    pm2_fundacoes: "",
    proposal_date: new Date().toISOString().split("T")[0],
    notes: "",
    scope: "residencial",
    arquivo_ref_1: "",
    arquivo_ref_2: "",
  });

  const [discountForm, setDiscountForm] = useState<ProposalDiscounts>({
    estrutural: 0,
    hidraulica: 0,
    eletrica: 0,
    fundacoes: 0,
  });

  const filtered = proposals.filter((p) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    const q = search.toLowerCase();
    return !q || p.project_name.toLowerCase().includes(q) || p.client?.name?.toLowerCase().includes(q);
  });

  const openCreate = () => {
    setEditingId(null);
    setForm({
      client_id: "", project_name: "", area_m2: "",
      pm2_estrutural: "", pm2_hidraulica: "", pm2_eletrica: "", pm2_fundacoes: "",
      proposal_date: new Date().toISOString().split("T")[0],
      notes: "", scope: "residencial", arquivo_ref_1: "", arquivo_ref_2: "",
    });
    setDialogOpen(true);
  };

  const openEdit = (p: CommercialProposal) => {
    setEditingId(p.id);
    setForm({
      client_id: p.client_id || "",
      project_name: p.project_name || "",
      area_m2: p.area_m2 ? String(p.area_m2) : "",
      pm2_estrutural: p.price_per_m2?.estrutural ? String(p.price_per_m2.estrutural) : "",
      pm2_hidraulica: p.price_per_m2?.hidraulica ? String(p.price_per_m2.hidraulica) : "",
      pm2_eletrica: p.price_per_m2?.eletrica ? String(p.price_per_m2.eletrica) : "",
      pm2_fundacoes: p.price_per_m2?.fundacoes ? String(p.price_per_m2.fundacoes) : "",
      proposal_date: p.proposal_date || new Date().toISOString().split("T")[0],
      notes: p.notes || "",
      scope: (p as any).scope || "residencial",
      arquivo_ref_1: (p as any).arquivo_ref_1 || "",
      arquivo_ref_2: (p as any).arquivo_ref_2 || "",
    });
    setDialogOpen(true);
  };

  const calcDisciplineValue = (pm2: string, area: string) => {
    const p = parseFloat(pm2) || 0;
    const a = parseFloat(area) || 0;
    return p * a;
  };

  const handleCreate = () => {
    const area = parseFloat(form.area_m2);
    if (!form.client_id || !form.project_name || !area || area <= 0) return;

    const pricePerM2: ProposalDisciplines = {};
    const disciplines: ProposalDisciplines = {};

    if (form.pm2_estrutural) { const pm2 = parseFloat(form.pm2_estrutural); pricePerM2.estrutural = pm2; disciplines.estrutural = pm2 * area; }
    if (form.pm2_hidraulica) { const pm2 = parseFloat(form.pm2_hidraulica); pricePerM2.hidraulica = pm2; disciplines.hidraulica = pm2 * area; }
    if (form.pm2_eletrica)   { const pm2 = parseFloat(form.pm2_eletrica);   pricePerM2.eletrica   = pm2; disciplines.eletrica   = pm2 * area; }
    if (form.pm2_fundacoes)  { const pm2 = parseFloat(form.pm2_fundacoes);  pricePerM2.fundacoes  = pm2; disciplines.fundacoes  = pm2 * area; }

    const total = Object.values(disciplines).reduce((s, v) => s + (v || 0), 0);

    const payload = {
      client_id: form.client_id,
      project_name: form.project_name,
      area_m2: area,
      disciplines,
      price_per_m2: pricePerM2,
      total_value: total,
      proposal_date: form.proposal_date,
      responsible_id: user?.id || "",
      notes: form.notes || undefined,
      scope: form.scope,
      arquivo_ref_1: form.arquivo_ref_1 || undefined,
      arquivo_ref_2: form.arquivo_ref_2 || undefined,
    };

    if (editingId) {
      updateProposal.mutate({ id: editingId, ...payload } as any, {
        onSuccess: () => { setDialogOpen(false); setEditingId(null); },
      });
    } else {
      createProposal.mutate(payload as any, { onSuccess: () => setDialogOpen(false) });
    }
  };

  const openApprovalModal = (p: CommercialProposal) => {
    setApprovalTarget(p);
    setDiscountForm({ estrutural: 0, hidraulica: 0, eletrica: 0 });
  };

  const handleApproveWithDiscount = () => {
    if (!approvalTarget || !user) return;
    const discs = (["estrutural", "hidraulica", "eletrica", "fundacoes"] as const).filter(
      (d) => approvalTarget.disciplines[d] && approvalTarget.disciplines[d]! > 0
    );
    const initial: Record<string, string> = {};
    discs.forEach((d) => { initial[d] = ""; });
    setCoordinatorSelections(initial);
    setCoordinatorTarget(approvalTarget);
    supabase.from("profiles").select("id, name").eq("status", "active").order("name").then(({ data }) => {
      if (data) setActiveUsers(data.map((u) => ({ id: u.id, name: u.name })));
    });
  };

  const handleConfirmCoordinators = () => {
    if (!approvalTarget || !user || !coordinatorTarget) return;
    const discs = Object.keys(coordinatorSelections);
    const allFilled = discs.every((d) => coordinatorSelections[d]);
    if (!allFilled) { toast.error("Selecione o coordenador para todas as disciplinas."); return; }
    approveProposal.mutate({
      proposal: approvalTarget,
      discounts: discountForm,
      userId: user.id,
      coordinators: coordinatorSelections,
    }, {
      onSuccess: () => {
        setApprovalTarget(null);
        setCoordinatorTarget(null);
        setDetailProposal(null);
      },
    });
  };

  const handleReject = (p: CommercialProposal) => {
    if (confirm("Reprovar esta proposta?")) {
      updateProposal.mutate({ id: p.id, status: "reprovada" as any });
      setDetailProposal(null);
    }
  };

  const handleStatusChange = (p: CommercialProposal, newStatus: ProposalStatus) => {
    if (newStatus === "aprovada") {
      openApprovalModal(p);
    } else {
      updateProposal.mutate({ id: p.id, status: newStatus as any });
    }
  };

  const handleGerarPDF = async (proposal: CommercialProposal) => {
    setGerandoPDF(proposal.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gerar-proposta-pdf`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
          body: JSON.stringify({ proposal_id: proposal.id }),
        }
      );
      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || "Erro ao gerar documento");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Proposta_${proposal.client?.name}_${proposal.project_name}_${proposal.proposal_date}`.replace(/[^a-zA-Z0-9_\-\.]/g, "_") + ".docx";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Documento gerado com sucesso!");
    } catch (err: any) {
      console.error("Erro ao gerar documento:", err);
      toast.error(err.message || "Não foi possível gerar o documento. Tente novamente.");
    } finally {
      setGerandoPDF(null);
    }
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <AppLayout>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Propostas</h1>
          <Button onClick={openCreate} size="sm"><Plus className="h-4 w-4 mr-1" />Nova Proposta</Button>
        </div>

        <div className="flex gap-3 items-center">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar propostas..." className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {Object.entries(PROPOSAL_STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Projeto</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Área (m²)</TableHead>
                  <TableHead>Valor Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="w-[150px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => {
                  const displayValue = p.status === "aprovada" && p.final_total_value > 0 ? p.final_total_value : p.total_value;
                  return (
                    <TableRow key={p.id} className="cursor-pointer" onClick={() => setDetailProposal(p)}>
                      <TableCell className="font-medium">{p.project_name}</TableCell>
                      <TableCell>{p.client?.name || "—"}</TableCell>
                      <TableCell>{p.area_m2}</TableCell>
                      <TableCell>{fmt(displayValue)}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[p.status]}>{PROPOSAL_STATUS_LABELS[p.status]}</Badge>
                      </TableCell>
                      <TableCell>{new Date(p.proposal_date).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" title="Ver detalhes" onClick={(e) => { e.stopPropagation(); setDetailProposal(p); }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Editar proposta" onClick={(e) => { e.stopPropagation(); openEdit(p); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Gerar Documento" onClick={(e) => { e.stopPropagation(); handleGerarPDF(p); }} disabled={gerandoPDF === p.id}>
                            {gerandoPDF === p.id
                              ? <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                              : <FileDown className="h-4 w-4" />}
                          </Button>
                          {/* Botão de Cronograma de Faturamento — só para propostas aprovadas e usuários autorizados */}
                          {p.status === "aprovada" && isDiretorOrGerente && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Cronograma de Faturamento"
                              onClick={(e) => { e.stopPropagation(); setBillingProposal(p); }}
                            >
                              <CalendarClock className="h-4 w-4 text-blue-500" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" title="Excluir proposta" onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Excluir a proposta "${p.project_name}"? Esta ação não pode ser desfeita.`)) {
                              deleteProposal.mutate(p.id);
                            }
                          }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma proposta encontrada</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Create Dialog */}
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditingId(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editingId ? "Editar Proposta" : "Nova Proposta"}</DialogTitle></DialogHeader>
            <CreateProposalForm form={form} setForm={setForm} clients={clients} onSave={handleCreate} selectedClientId={form.client_id} calcDisciplineValue={calcDisciplineValue} />
          </DialogContent>
        </Dialog>

        {/* Detail Dialog */}
        {detailProposal && (
          <ProposalDetailDialog
            proposal={detailProposal}
            onClose={() => setDetailProposal(null)}
            onApprove={() => openApprovalModal(detailProposal)}
            onReject={() => handleReject(detailProposal)}
            onStatusChange={(s) => handleStatusChange(detailProposal, s)}
            onGerarPDF={handleGerarPDF}
            onOpenBilling={() => { setDetailProposal(null); setBillingProposal(detailProposal); }}
            gerandoPDF={gerandoPDF}
            isDiretorOrGerente={isDiretorOrGerente}
            onDelete={(p) => {
              if (confirm(`Excluir a proposta "${p.project_name}"? Esta ação não pode ser desfeita.`)) {
                deleteProposal.mutate(p.id);
                setDetailProposal(null);
              }
            }}
          />
        )}

        {/* Approval Discount Modal */}
        {approvalTarget && !coordinatorTarget && (
          <ApprovalDiscountModal
            proposal={approvalTarget}
            discounts={discountForm}
            setDiscounts={setDiscountForm}
            onConfirm={handleApproveWithDiscount}
            onCancel={() => setApprovalTarget(null)}
            isLoading={approveProposal.isPending}
          />
        )}

        {/* Coordinator Selection Modal */}
        {coordinatorTarget && (
          <Dialog open onOpenChange={() => setCoordinatorTarget(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Selecionar Coordenadores</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Defina o coordenador técnico para cada disciplina do projeto.</p>
                {Object.keys(coordinatorSelections).map((disc) => (
                  <div key={disc} className="space-y-1">
                    <Label className="text-sm font-medium">{DISC_LABELS[disc] || disc}</Label>
                    <select
                      value={coordinatorSelections[disc] || ""}
                      onChange={(e) => setCoordinatorSelections((prev) => ({ ...prev, [disc]: e.target.value }))}
                      className="h-10 w-full rounded-md border bg-card px-3 text-sm"
                    >
                      <option value="">Selecione o coordenador...</option>
                      {activeUsers.map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCoordinatorTarget(null)}>Cancelar</Button>
                <Button
                  onClick={handleConfirmCoordinators}
                  disabled={approveProposal.isPending || !Object.values(coordinatorSelections).every(Boolean)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-1" />Confirmar e Criar Projetos
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Billing Schedule Modal */}
        {billingProposal && (
          <BillingScheduleModal
            proposal={billingProposal}
            userId={user?.id || ""}
            onClose={() => setBillingProposal(null)}
          />
        )}
      </div>
    </AppLayout>
  );
}

// ─── Create Form ──────────────────────────────────────────────────────────────

function CreateProposalForm({ form, setForm, clients, onSave, selectedClientId, calcDisciplineValue }: any) {
  const { data: history = [] } = useClientHistory(selectedClientId || null);

  const valEst  = calcDisciplineValue(form.pm2_estrutural, form.area_m2);
  const valHid  = calcDisciplineValue(form.pm2_hidraulica, form.area_m2);
  const valEle  = calcDisciplineValue(form.pm2_eletrica,   form.area_m2);
  const valFund = calcDisciplineValue(form.pm2_fundacoes,  form.area_m2);
  const totalValue = valEst + valHid + valEle + valFund;

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-3 max-h-[70vh] overflow-y-auto">
      <div>
        <Label>Cliente *</Label>
        <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
          <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
          <SelectContent>
            {clients.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {history.length > 0 && (
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="p-3">
            <p className="text-xs font-semibold text-muted-foreground mb-2">📊 Histórico de preços deste cliente</p>
            {history.slice(0, 3).map((h: any) => (
              <div key={h.id} className="text-xs border-b border-border/50 pb-1 mb-1">
                <span className="font-medium">{h.project_name}</span> — {h.area_m2}m²
                {(["estrutural", "hidraulica", "eletrica"] as const).map((d) => {
                  const pm2 = h.price_per_m2?.[d] || (h.disciplines?.[d] && h.area_m2 > 0 ? h.disciplines[d] / h.area_m2 : null);
                  return pm2 ? (
                    <span key={d} className="ml-2 text-muted-foreground">
                      {d.charAt(0).toUpperCase()}: R${pm2.toFixed(2)}/m²
                    </span>
                  ) : null;
                })}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div><Label>Nome do Projeto *</Label><Input value={form.project_name} onChange={(e) => setForm({ ...form, project_name: e.target.value })} /></div>
      <div><Label>Área do Projeto (m²) *</Label><Input type="number" value={form.area_m2} onChange={(e) => setForm({ ...form, area_m2: e.target.value })} /></div>

      <div className="space-y-1">
        <Label>Escopo do Projeto *</Label>
        <Select value={form.scope} onValueChange={(v) => setForm({ ...form, scope: v })}>
          <SelectTrigger><SelectValue placeholder="Selecione o escopo..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="residencial">Escopo Residencial</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-sm font-semibold">Arquivos de Referência</Label>
        <p className="text-xs text-muted-foreground">Documentos utilizados como base para elaboração desta proposta</p>
        <Input value={form.arquivo_ref_1} onChange={(e) => setForm({ ...form, arquivo_ref_1: e.target.value })} placeholder="Ex: Anteprojeto V1" />
        <Input value={form.arquivo_ref_2} onChange={(e) => setForm({ ...form, arquivo_ref_2: e.target.value })} placeholder="Ex: Planta Legal (opcional)" />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-semibold">Valores por Disciplina (R$/m²)</Label>
        <div className="grid grid-cols-2 gap-2">
          {([
            { key: "pm2_estrutural", label: "Estrutural", val: valEst },
            { key: "pm2_hidraulica", label: "Hidráulica", val: valHid },
            { key: "pm2_eletrica",   label: "Elétrica",   val: valEle },
            { key: "pm2_fundacoes",  label: "Fundações",  val: valFund },
          ] as const).map((d) => (
            <div key={d.key}>
              <Label className="text-xs">{d.label} (R$/m²)</Label>
              <Input type="number" value={form[d.key]} onChange={(e) => setForm({ ...form, [d.key]: e.target.value })} placeholder="0,00 (opcional)" />
              {d.val > 0 && <p className="text-xs text-muted-foreground mt-0.5">= {fmt(d.val)}</p>}
            </div>
          ))}
        </div>
        <p className="text-sm font-semibold text-foreground">Valor total: {fmt(totalValue)}</p>
      </div>

      <div><Label>Data da Proposta</Label><Input type="date" value={form.proposal_date} onChange={(e) => setForm({ ...form, proposal_date: e.target.value })} /></div>
      <div><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>

      <Button onClick={onSave} className="w-full" disabled={!form.client_id || !form.project_name || !form.area_m2}>
        Criar Proposta
      </Button>
    </div>
  );
}

// ─── Approval Discount Modal ──────────────────────────────────────────────────

function ApprovalDiscountModal({ proposal, discounts, setDiscounts, onConfirm, onCancel, isLoading }: {
  proposal: CommercialProposal;
  discounts: ProposalDiscounts;
  setDiscounts: (d: ProposalDiscounts) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const discs = (["estrutural", "hidraulica", "eletrica", "fundacoes"] as const).filter(
    (d) => proposal.disciplines[d] && proposal.disciplines[d]! > 0
  );

  const finalValues: ProposalDisciplines = {};
  discs.forEach((d) => {
    const original = proposal.disciplines[d] || 0;
    const disc = Math.min(100, Math.max(0, discounts[d] || 0));
    finalValues[d] = Math.max(0, original - original * (disc / 100));
  });
  const finalTotal = Object.values(finalValues).reduce((s, v) => s + (v || 0), 0);

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Aprovar Proposta — Descontos</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Defina o desconto (%) para cada disciplina antes de confirmar a aprovação.</p>
          {discs.map((d) => {
            const original = proposal.disciplines[d] || 0;
            const final_ = finalValues[d] || 0;
            return (
              <div key={d} className="border border-border rounded-md p-3 space-y-1">
                <p className="text-sm font-medium">{DISC_LABELS[d]}</p>
                <p className="text-xs text-muted-foreground">Original: {fmt(original)}</p>
                <div className="flex items-center gap-2">
                  <Label className="text-xs whitespace-nowrap">Desconto (%)</Label>
                  <Input
                    type="number" min={0} max={100}
                    value={discounts[d] ?? 0}
                    onChange={(e) => {
                      const val = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                      setDiscounts({ ...discounts, [d]: val });
                    }}
                    className="w-24"
                  />
                </div>
                <p className="text-sm font-semibold">Valor final: {fmt(final_)}</p>
              </div>
            );
          })}
          <div className="border-t border-border pt-3">
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Total original:</span><span className="text-sm">{fmt(proposal.total_value)}</span></div>
            <div className="flex justify-between font-bold"><span>Total final:</span><span>{fmt(finalTotal)}</span></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button onClick={onConfirm} disabled={isLoading} className="bg-green-600 hover:bg-green-700">
            <CheckCircle className="h-4 w-4 mr-1" />Confirmar Aprovação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Detail Dialog ────────────────────────────────────────────────────────────

function ProposalDetailDialog({ proposal, onClose, onApprove, onReject, onStatusChange, onGerarPDF, onOpenBilling, gerandoPDF, isDiretorOrGerente, onDelete }: {
  proposal: CommercialProposal;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  onStatusChange: (s: ProposalStatus) => void;
  onGerarPDF: (p: CommercialProposal) => void;
  onOpenBilling: () => void;
  gerandoPDF: string | null;
  isDiretorOrGerente: boolean;
  onDelete: (p: CommercialProposal) => void;
}) {
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const { data: history = [] } = useClientHistory(proposal.client_id);
  const isApproved = proposal.status === "aprovada";
  const hasFinal = isApproved && proposal.final_total_value > 0;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{proposal.project_name}</DialogTitle></DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-muted-foreground">Cliente:</span> <span className="font-medium">{proposal.client?.name}</span></div>
            <div><span className="text-muted-foreground">Área:</span> <span className="font-medium">{proposal.area_m2} m²</span></div>
            <div><span className="text-muted-foreground">Valor Original:</span> <span className="font-medium">{fmt(proposal.total_value)}</span></div>
            {hasFinal && <div><span className="text-muted-foreground">Valor Final:</span> <span className="font-bold text-green-600">{fmt(proposal.final_total_value)}</span></div>}
            <div><span className="text-muted-foreground">Data:</span> <span className="font-medium">{new Date(proposal.proposal_date).toLocaleDateString("pt-BR")}</span></div>
            <div><span className="text-muted-foreground">Status:</span> <Badge className={STATUS_COLORS[proposal.status]}>{PROPOSAL_STATUS_LABELS[proposal.status]}</Badge></div>
            {proposal.linked_project_id && <div><span className="text-muted-foreground">Projeto vinculado</span> <Badge variant="outline">✓</Badge></div>}
            {proposal.approved_at && <div><span className="text-muted-foreground">Aprovada em:</span> <span className="font-medium">{new Date(proposal.approved_at).toLocaleDateString("pt-BR")}</span></div>}
          </div>

          <Card className="bg-muted/30">
            <CardContent className="p-3">
              <p className="text-xs font-semibold mb-2">Valores por Disciplina</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {(["estrutural", "hidraulica", "eletrica", "fundacoes"] as const)
                  .filter((d) => proposal.disciplines?.[d] && proposal.disciplines[d]! > 0)
                  .map((d) => {
                    const val = proposal.disciplines?.[d];
                    const pm2 = proposal.price_per_m2?.[d];
                    const disc = proposal.discounts?.[d];
                    const finalVal = proposal.final_disciplines?.[d];
                    return (
                      <div key={d}>
                        <p className="text-muted-foreground">{DISC_LABELS[d] || d}</p>
                        {pm2 != null && pm2 > 0 && <p className="text-xs text-muted-foreground">R$ {pm2.toFixed(2)}/m²</p>}
                        <p className="font-medium">{val ? fmt(val) : "—"}</p>
                        {hasFinal && disc != null && disc > 0 && <p className="text-xs text-orange-600">Desconto: {disc}%</p>}
                        {hasFinal && finalVal != null && <p className="text-xs font-semibold text-green-600">Final: {fmt(finalVal)}</p>}
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>

          {proposal.notes && <div><p className="text-xs text-muted-foreground">Observações:</p><p className="text-sm">{proposal.notes}</p></div>}

          {history.length > 1 && (
            <Card className="bg-muted/30 border-dashed">
              <CardContent className="p-3">
                <p className="text-xs font-semibold mb-2">📊 Outras propostas deste cliente</p>
                {history.filter((h) => h.id !== proposal.id).slice(0, 5).map((h) => (
                  <div key={h.id} className="text-xs border-b border-border/50 pb-1 mb-1">
                    <span className="font-medium">{h.project_name}</span> — {h.area_m2}m² — {fmt(h.total_value)}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => onGerarPDF(proposal)} disabled={gerandoPDF === proposal.id}>
              {gerandoPDF === proposal.id
                ? <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin mr-1" />
                : <FileDown className="h-4 w-4 mr-1" />}
              Gerar Documento
            </Button>

            {/* Botão de Cronograma — só para aprovadas e Diretores/Gerentes */}
            {isApproved && isDiretorOrGerente && (
              <Button variant="outline" onClick={onOpenBilling} className="border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950">
                <CalendarClock className="h-4 w-4 mr-1" />
                Cronograma de Faturamento
              </Button>
            )}

            {proposal.status !== "aprovada" && proposal.status !== "reprovada" && (
              <>
                <Select onValueChange={(v) => onStatusChange(v as ProposalStatus)}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Alterar status..." /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PROPOSAL_STATUS_LABELS).filter(([k]) => k !== proposal.status).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="default" onClick={onApprove} className="bg-green-600 hover:bg-green-700">
                  <CheckCircle className="h-4 w-4 mr-1" />Aprovar
                </Button>
                <Button variant="destructive" onClick={onReject}>
                  <XCircle className="h-4 w-4 mr-1" />Reprovar
                </Button>
              </>
            )}
            <Button variant="ghost" size="icon" title="Excluir proposta" onClick={() => onDelete(proposal)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Billing Schedule Modal ───────────────────────────────────────────────────

// ─── Types for the billing schedule modal ────────────────────────────────────

/** State for one (discipline × stage) cell in the cronograma grid */
interface CellState {
  enabled: boolean;
  percentage: string;        // % do valor da disciplina (0-100)
  billing_month: string;
  billing_year: string;
  execution_month: string;
  execution_year: string;
  execution_touched: boolean; // true se usuário alterou manualmente
  is_installment: boolean;
  installment_count: string;
}

type CellKey = string; // `${disciplineKey}__${stageKey}`

// ─── Billing Schedule Modal ───────────────────────────────────────────────────

function BillingScheduleModal({
  proposal,
  userId,
  onClose,
}: {
  proposal: CommercialProposal;
  userId: string;
  onClose: () => void;
}) {
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const now = new Date();
  const availableYears = [now.getFullYear(), now.getFullYear() + 1, now.getFullYear() + 2];

  const { data: existingSchedule = [] } = useBillingSchedule(proposal.id);
  const saveBilling = useSaveBillingSchedule();

  // Disciplinas com valor final > 0 nesta proposta
  const DISC_KEYS = (["estrutural", "hidraulica", "eletrica", "fundacoes"] as const);
  const activeDisciplines = DISC_KEYS
    .filter((d) => {
      const val = proposal.final_disciplines?.[d] ?? proposal.disciplines?.[d];
      return val && val > 0;
    })
    .map((d) => ({
      key: d as string,
      label: DISC_LABELS[d],
      value: (proposal.final_disciplines?.[d] ?? proposal.disciplines?.[d] ?? 0) as number,
    }));

  const totalValue = activeDisciplines.reduce((s, d) => s + d.value, 0);

  // Calcula mês/ano 1 mês anterior ao faturamento
  const calcExecution = (bMonth: string, bYear: string): { m: string; y: string } => {
    const m = parseInt(bMonth);
    const y = parseInt(bYear);
    if (!m || !y) return { m: bMonth, y: bYear };
    if (m === 1) return { m: "12", y: String(y - 1) };
    return { m: String(m - 1), y: String(y) };
  };

  // Inicializar células
  const buildInitialCells = (): Record<CellKey, CellState> => {
    const cells: Record<CellKey, CellState> = {};
    for (const disc of activeDisciplines) {
      for (const stage of BILLING_STAGES) {
        const key: CellKey = `${disc.key}__${stage.key}`;
        const existing = existingSchedule.find(
          (e) => e.discipline_key === disc.key && e.stage_key === stage.key
        );
        const bMonth = existing ? String(existing.billing_month) : String(now.getMonth() + 1);
        const bYear = existing ? String(existing.billing_year) : String(now.getFullYear());
        const auto = calcExecution(bMonth, bYear);
        const hasExistingExec = existing?.execution_month != null && existing?.execution_year != null;
        cells[key] = {
          enabled: !!existing,
          percentage: existing ? String(existing.percentage) : "",
          billing_month: bMonth,
          billing_year: bYear,
          execution_month: hasExistingExec ? String(existing!.execution_month) : auto.m,
          execution_year: hasExistingExec ? String(existing!.execution_year) : auto.y,
          execution_touched: hasExistingExec,
          is_installment: existing?.is_installment ?? false,
          installment_count: existing?.installment_count ? String(existing.installment_count) : "2",
        };
      }
    }
    return cells;
  };

  const [cells, setCells] = useState<Record<CellKey, CellState>>(buildInitialCells);
  const [initialized, setInitialized] = useState(false);
  if (!initialized && existingSchedule.length > 0) {
    setCells(buildInitialCells());
    setInitialized(true);
  }

  const updateCell = (key: CellKey, partial: Partial<CellState>) => {
    setCells((prev) => {
      const current = prev[key];
      const next = { ...current, ...partial };
      // Se mudou faturamento e usuário ainda não tocou execução, recalcula
      const billingChanged = partial.billing_month !== undefined || partial.billing_year !== undefined;
      if (billingChanged && !next.execution_touched) {
        const auto = calcExecution(next.billing_month, next.billing_year);
        next.execution_month = auto.m;
        next.execution_year = auto.y;
      }
      return { ...prev, [key]: next };
    });
  };

  // Totais
  const totalScheduled = activeDisciplines.reduce((sum, disc) => {
    return sum + BILLING_STAGES.reduce((s, stage) => {
      const cell = cells[`${disc.key}__${stage.key}`];
      if (!cell?.enabled) return s;
      return s + (disc.value * (parseFloat(cell.percentage) || 0) / 100);
    }, 0);
  }, 0);

  const totalPctByDisc = (discKey: string, discValue: number): number => {
    return BILLING_STAGES.reduce((s, stage) => {
      const cell = cells[`${discKey}__${stage.key}`];
      if (!cell?.enabled) return s;
      return s + (parseFloat(cell.percentage) || 0);
    }, 0);
  };

  const diff = totalValue - totalScheduled;

  const handleSave = () => {
    const entries: UpsertBillingScheduleInput[] = [];
    for (const disc of activeDisciplines) {
      for (const stage of BILLING_STAGES) {
        const key: CellKey = `${disc.key}__${stage.key}`;
        const cell = cells[key];
        if (!cell?.enabled) continue;
        const pct = parseFloat(cell.percentage) || 0;
        if (pct <= 0) {
          toast.error(`Informe a % da etapa "${stage.label}" para ${disc.label}`);
          return;
        }
        const amount = Math.round(disc.value * pct / 100 * 100) / 100;
        entries.push({
          proposal_id: proposal.id,
          discipline_key: disc.key,
          discipline_label: disc.label,
          stage_key: stage.key,
          stage_label: stage.label,
          amount,
          percentage: pct,
          billing_year: parseInt(cell.billing_year),
          billing_month: parseInt(cell.billing_month),
          execution_year: cell.execution_year ? parseInt(cell.execution_year) : null,
          execution_month: cell.execution_month ? parseInt(cell.execution_month) : null,
          is_installment: cell.is_installment,
          installment_count: cell.is_installment ? parseInt(cell.installment_count) || 2 : null,
          created_by: userId,
        });
      }
    }
    saveBilling.mutate({ proposalId: proposal.id, entries }, { onSuccess: onClose });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-blue-500" />
            Cronograma de Faturamento
          </DialogTitle>
          <p className="text-sm text-muted-foreground pt-1">
            {proposal.project_name} — {proposal.client?.name}
          </p>
        </DialogHeader>

        <div className="space-y-5">
          {/* Resumo global */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 border border-border">
            <Info className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
            <div className="text-sm space-y-0.5">
              <p>Valor contratado total: <strong>{fmt(totalValue)}</strong></p>
              <p>
                Total agendado:{" "}
                <strong className={Math.abs(diff) > 0.01 ? "text-orange-500" : "text-green-500"}>
                  {fmt(totalScheduled)}
                </strong>
              </p>
              {Math.abs(diff) > 0.01 && (
                <p className="text-orange-500 text-xs">
                  {diff > 0
                    ? `Faltam ${fmt(diff)} para totalizar o contrato`
                    : `Excesso de ${fmt(Math.abs(diff))} sobre o contrato`}
                </p>
              )}
            </div>
          </div>

          {/* Uma seção por disciplina */}
          {activeDisciplines.map((disc) => {
            const totalPct = totalPctByDisc(disc.key, disc.value);
            const totalDiscScheduled = disc.value * totalPct / 100;
            const discDiff = disc.value - totalDiscScheduled;

            return (
              <div key={disc.key} className="border border-border rounded-xl overflow-hidden">
                {/* Header da disciplina */}
                <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b border-border">
                  <div>
                    <span className="font-semibold text-sm">{disc.label}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      Valor: {fmt(disc.value)}
                    </span>
                  </div>
                  <div className="text-right text-xs">
                    <span className={
                      totalPct > 100 ? "text-red-500 font-semibold"
                      : totalPct === 100 ? "text-green-500 font-semibold"
                      : "text-orange-500"
                    }>
                      {totalPct.toFixed(1)}% alocado
                    </span>
                    {Math.abs(discDiff) > 0.01 && (
                      <span className="ml-2 text-muted-foreground">
                        ({discDiff > 0 ? `faltam ${fmt(discDiff)}` : `excesso ${fmt(Math.abs(discDiff))}`})
                      </span>
                    )}
                  </div>
                </div>

                {/* Etapas desta disciplina */}
                <div className="divide-y divide-border/50">
                  {BILLING_STAGES.map((stage) => {
                    const cellKey: CellKey = `${disc.key}__${stage.key}`;
                    const cell = cells[cellKey];
                    if (!cell) return null;
                    const pct = parseFloat(cell.percentage) || 0;
                    const calculatedAmount = disc.value * pct / 100;

                    return (
                      <div
                        key={stage.key}
                        className={`px-4 py-3 transition-colors ${cell.enabled ? "bg-blue-500/5" : ""}`}
                      >
                        {/* Cabeçalho da etapa */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={cell.enabled}
                              onCheckedChange={(checked) => updateCell(cellKey, { enabled: checked })}
                            />
                            <span className={`text-sm ${cell.enabled ? "font-medium" : "text-muted-foreground"}`}>
                              {stage.label}
                            </span>
                          </div>
                          {cell.enabled && pct > 0 && (
                            <span className="text-xs font-semibold text-blue-500">
                              {pct}% = {fmt(calculatedAmount)}
                            </span>
                          )}
                        </div>

                        {/* Campos expandidos quando ativo */}
                        {cell.enabled && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2 pl-10">
                            {/* Percentual */}
                            <div>
                              <Label className="text-xs">% do valor *</Label>
                              <div className="relative mt-1">
                                <Input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step={0.1}
                                  value={cell.percentage}
                                  onChange={(e) => updateCell(cellKey, { percentage: e.target.value })}
                                  placeholder="0"
                                  className="pr-6"
                                />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                              </div>
                              {pct > 0 && (
                                <p className="text-xs text-muted-foreground mt-0.5">= {fmt(calculatedAmount)}</p>
                              )}
                            </div>

                            {/* Mês */}
                            <div>
                              <Label className="text-xs">Mês *</Label>
                              <Select value={cell.billing_month} onValueChange={(v) => updateCell(cellKey, { billing_month: v })}>
                                <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {MONTH_LABELS.map((m, i) => (
                                    <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Ano */}
                            <div>
                              <Label className="text-xs">Ano *</Label>
                              <Select value={cell.billing_year} onValueChange={(v) => updateCell(cellKey, { billing_year: v })}>
                                <SelectTrigger className="mt-1 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {availableYears.map((y) => (
                                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Parcelado */}
                            <div className="space-y-1">
                              <Label className="text-xs">Parcelado?</Label>
                              <div className="flex items-center gap-2 mt-1">
                                <Switch
                                  checked={cell.is_installment}
                                  onCheckedChange={(checked) => updateCell(cellKey, { is_installment: checked })}
                                />
                                <span className="text-xs text-muted-foreground">
                                  {cell.is_installment ? "Sim" : "Não"}
                                </span>
                              </div>
                              {cell.is_installment && (
                                <div className="flex items-center gap-1 mt-1">
                                  <Input
                                    type="number"
                                    min={2}
                                    max={24}
                                    value={cell.installment_count}
                                    onChange={(e) => updateCell(cellKey, { installment_count: e.target.value })}
                                    className="w-16 text-xs"
                                    placeholder="Nº"
                                  />
                                  <span className="text-xs text-muted-foreground">parcelas</span>
                                </div>
                              )}
                              {cell.is_installment && pct > 0 && parseInt(cell.installment_count) > 1 && (
                                <p className="text-xs text-blue-400">
                                  {parseInt(cell.installment_count)}× {fmt(calculatedAmount / parseInt(cell.installment_count))}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* ─── Cronograma de Execução ─────────────────────────────────────── */}
        <div className="space-y-3 mt-2">
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <CalendarClock className="h-5 w-5 text-emerald-500" />
            <h3 className="text-base font-semibold">Cronograma de Execução</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Defina o mês previsto de execução de cada etapa. Por padrão é sugerido 1 mês antes do faturamento, mas pode ser alterado.
          </p>

          {activeDisciplines.map((disc) => {
            const enabledStages = BILLING_STAGES.filter(
              (s) => cells[`${disc.key}__${s.key}`]?.enabled,
            );
            if (enabledStages.length === 0) return null;
            return (
              <div key={`exec-${disc.key}`} className="border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-2 bg-muted/50 border-b border-border">
                  <span className="font-semibold text-sm">{disc.label}</span>
                </div>
                <div className="divide-y divide-border/50">
                  {enabledStages.map((stage) => {
                    const cellKey: CellKey = `${disc.key}__${stage.key}`;
                    const cell = cells[cellKey];
                    return (
                      <div key={stage.key} className="px-4 py-2 flex items-center justify-between gap-3">
                        <span className="text-sm">{stage.label}</span>
                        <div className="flex items-center gap-2">
                          <Select
                            value={cell.execution_month}
                            onValueChange={(v) =>
                              updateCell(cellKey, { execution_month: v, execution_touched: true })
                            }
                          >
                            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {MONTH_LABELS.map((m, i) => (
                                <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={cell.execution_year}
                            onValueChange={(v) =>
                              updateCell(cellKey, { execution_year: v, execution_touched: true })
                            }
                          >
                            <SelectTrigger className="w-20 h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {availableYears.map((y) => (
                                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {activeDisciplines.every((d) =>
            BILLING_STAGES.every((s) => !cells[`${d.key}__${s.key}`]?.enabled),
          ) && (
            <p className="text-xs text-muted-foreground italic px-1">
              Ative etapas no cronograma de faturamento acima para definir suas datas de execução.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={handleSave}
            disabled={saveBilling.isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {saveBilling.isPending
              ? <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />
              : <CalendarClock className="h-4 w-4 mr-1" />}
            Salvar Cronograma
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
