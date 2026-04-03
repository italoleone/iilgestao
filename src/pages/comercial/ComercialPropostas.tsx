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
import {
  useCommercialProposals, useCommercialClients, useCreateProposal, useUpdateProposal,
  useApproveProposal, useClientHistory, PROPOSAL_STATUS_LABELS,
  type ProposalStatus, type CommercialProposal, type ProposalDisciplines, type ProposalDiscounts,
} from "@/hooks/useCommercialData";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Search, Eye, CheckCircle, XCircle } from "lucide-react";

const STATUS_COLORS: Record<ProposalStatus, string> = {
  lead: "bg-muted text-muted-foreground",
  contato_feito: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  em_elaboracao: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  enviada: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  em_negociacao: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  aprovada: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  reprovada: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const DISC_LABELS: Record<string, string> = { estrutural: "Estrutural", hidraulica: "Hidráulica", eletrica: "Elétrica" };

export default function ComercialPropostas() {
  const { data: proposals = [] } = useCommercialProposals();
  const { data: clients = [] } = useCommercialClients();
  const createProposal = useCreateProposal();
  const updateProposal = useUpdateProposal();
  const approveProposal = useApproveProposal();
  const { user } = useAuth();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailProposal, setDetailProposal] = useState<CommercialProposal | null>(null);
  const [approvalTarget, setApprovalTarget] = useState<CommercialProposal | null>(null);

  const [form, setForm] = useState({
    client_id: "",
    project_name: "",
    area_m2: "",
    pm2_estrutural: "",
    pm2_hidraulica: "",
    pm2_eletrica: "",
    proposal_date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const [discountForm, setDiscountForm] = useState<ProposalDiscounts>({
    estrutural: 0,
    hidraulica: 0,
    eletrica: 0,
  });

  const filtered = proposals.filter((p) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    const q = search.toLowerCase();
    return !q || p.project_name.toLowerCase().includes(q) || p.client?.name?.toLowerCase().includes(q);
  });

  const openCreate = () => {
    setForm({ client_id: "", project_name: "", area_m2: "", pm2_estrutural: "", pm2_hidraulica: "", pm2_eletrica: "", proposal_date: new Date().toISOString().split("T")[0], notes: "" });
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

    if (form.pm2_estrutural) {
      const pm2 = parseFloat(form.pm2_estrutural);
      pricePerM2.estrutural = pm2;
      disciplines.estrutural = pm2 * area;
    }
    if (form.pm2_hidraulica) {
      const pm2 = parseFloat(form.pm2_hidraulica);
      pricePerM2.hidraulica = pm2;
      disciplines.hidraulica = pm2 * area;
    }
    if (form.pm2_eletrica) {
      const pm2 = parseFloat(form.pm2_eletrica);
      pricePerM2.eletrica = pm2;
      disciplines.eletrica = pm2 * area;
    }

    const total = Object.values(disciplines).reduce((s, v) => s + (v || 0), 0);

    createProposal.mutate({
      client_id: form.client_id,
      project_name: form.project_name,
      area_m2: area,
      disciplines,
      price_per_m2: pricePerM2,
      total_value: total,
      proposal_date: form.proposal_date,
      responsible_id: user?.id || "",
      notes: form.notes || undefined,
    }, { onSuccess: () => setDialogOpen(false) });
  };

  const openApprovalModal = (p: CommercialProposal) => {
    setApprovalTarget(p);
    setDiscountForm({ estrutural: 0, hidraulica: 0, eletrica: 0 });
  };

  const handleApproveWithDiscount = () => {
    if (!approvalTarget || !user) return;
    approveProposal.mutate({
      proposal: approvalTarget,
      discounts: discountForm,
      userId: user.id,
    }, {
      onSuccess: () => {
        setApprovalTarget(null);
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
                  <TableHead className="w-[80px]">Ações</TableHead>
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
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setDetailProposal(p); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
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

        {/* Create dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Nova Proposta</DialogTitle></DialogHeader>
            <CreateProposalForm form={form} setForm={setForm} clients={clients} onSave={handleCreate} selectedClientId={form.client_id} calcDisciplineValue={calcDisciplineValue} />
          </DialogContent>
        </Dialog>

        {/* Detail dialog */}
        {detailProposal && (
          <ProposalDetailDialog
            proposal={detailProposal}
            onClose={() => setDetailProposal(null)}
            onApprove={() => openApprovalModal(detailProposal)}
            onReject={() => handleReject(detailProposal)}
            onStatusChange={(s) => handleStatusChange(detailProposal, s)}
          />
        )}

        {/* Approval discount modal */}
        {approvalTarget && (
          <ApprovalDiscountModal
            proposal={approvalTarget}
            discounts={discountForm}
            setDiscounts={setDiscountForm}
            onConfirm={handleApproveWithDiscount}
            onCancel={() => setApprovalTarget(null)}
            isLoading={approveProposal.isPending}
          />
        )}
      </div>
    </AppLayout>
  );
}

/* ─── Create Form ─── */
function CreateProposalForm({ form, setForm, clients, onSave, selectedClientId, calcDisciplineValue }: any) {
  const { data: history = [] } = useClientHistory(selectedClientId || null);
  const area = parseFloat(form.area_m2) || 0;

  const valEst = calcDisciplineValue(form.pm2_estrutural, form.area_m2);
  const valHid = calcDisciplineValue(form.pm2_hidraulica, form.area_m2);
  const valEle = calcDisciplineValue(form.pm2_eletrica, form.area_m2);
  const totalValue = valEst + valHid + valEle;

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

      <div className="space-y-2">
        <Label className="text-sm font-semibold">Valores por Disciplina (R$/m²)</Label>
        <div className="grid grid-cols-3 gap-2">
          {([
            { key: "pm2_estrutural", label: "Estrutural", val: valEst },
            { key: "pm2_hidraulica", label: "Hidráulica", val: valHid },
            { key: "pm2_eletrica", label: "Elétrica", val: valEle },
          ] as const).map((d) => (
            <div key={d.key}>
              <Label className="text-xs">{d.label} (R$/m²)</Label>
              <Input type="number" value={form[d.key]} onChange={(e) => setForm({ ...form, [d.key]: e.target.value })} placeholder="0,00" />
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

/* ─── Approval Discount Modal ─── */
function ApprovalDiscountModal({ proposal, discounts, setDiscounts, onConfirm, onCancel, isLoading }: {
  proposal: CommercialProposal;
  discounts: ProposalDiscounts;
  setDiscounts: (d: ProposalDiscounts) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const discs = (["estrutural", "hidraulica", "eletrica"] as const).filter(
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
          <p className="text-sm text-muted-foreground">
            Defina o desconto (%) para cada disciplina antes de confirmar a aprovação.
          </p>

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
                    type="number"
                    min={0}
                    max={100}
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
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Total original:</span>
              <span className="text-sm">{fmt(proposal.total_value)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Total final:</span>
              <span>{fmt(finalTotal)}</span>
            </div>
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

/* ─── Detail Dialog ─── */
function ProposalDetailDialog({ proposal, onClose, onApprove, onReject, onStatusChange }: {
  proposal: CommercialProposal;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  onStatusChange: (s: ProposalStatus) => void;
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

          {/* Disciplines */}
          <Card className="bg-muted/30">
            <CardContent className="p-3">
              <p className="text-xs font-semibold mb-2">Valores por Disciplina</p>
              <div className="grid grid-cols-3 gap-3 text-sm">
                {(["estrutural", "hidraulica", "eletrica"] as const).map((d) => {
                  const val = proposal.disciplines?.[d];
                  const pm2 = proposal.price_per_m2?.[d];
                  const disc = proposal.discounts?.[d];
                  const finalVal = proposal.final_disciplines?.[d];
                  return (
                    <div key={d}>
                      <p className="text-muted-foreground capitalize">{d}</p>
                      {pm2 != null && pm2 > 0 && <p className="text-xs text-muted-foreground">R$ {pm2.toFixed(2)}/m²</p>}
                      <p className="font-medium">{val ? fmt(val) : "—"}</p>
                      {hasFinal && disc != null && disc > 0 && (
                        <p className="text-xs text-orange-600">Desconto: {disc}%</p>
                      )}
                      {hasFinal && finalVal != null && (
                        <p className="text-xs font-semibold text-green-600">Final: {fmt(finalVal)}</p>
                      )}
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

          {proposal.status !== "aprovada" && proposal.status !== "reprovada" && (
            <div className="flex gap-2">
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
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
