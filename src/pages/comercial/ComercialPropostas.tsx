import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCommercialProposals, useCommercialClients, useCreateProposal, useUpdateProposal, useApproveProposal, useClientHistory, PROPOSAL_STATUS_LABELS, type ProposalStatus, type CommercialProposal, type ProposalDisciplines } from "@/hooks/useCommercialData";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Search, Eye, CheckCircle, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const STATUS_COLORS: Record<ProposalStatus, string> = {
  lead: "bg-muted text-muted-foreground",
  contato_feito: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  em_elaboracao: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  enviada: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  em_negociacao: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  aprovada: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  reprovada: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export default function ComercialPropostas() {
  const { data: proposals = [] } = useCommercialProposals();
  const { data: clients = [] } = useCommercialClients();
  const createProposal = useCreateProposal();
  const updateProposal = useUpdateProposal();
  const approveProposal = useApproveProposal();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailProposal, setDetailProposal] = useState<CommercialProposal | null>(null);

  const [form, setForm] = useState({
    client_id: "",
    project_name: "",
    area_m2: "",
    disc_estrutural: "",
    disc_hidraulica: "",
    disc_eletrica: "",
    proposal_date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const filtered = proposals.filter((p) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    const q = search.toLowerCase();
    return !q || p.project_name.toLowerCase().includes(q) || p.client?.name?.toLowerCase().includes(q);
  });

  const openCreate = () => {
    setForm({
      client_id: "",
      project_name: "",
      area_m2: "",
      disc_estrutural: "",
      disc_hidraulica: "",
      disc_eletrica: "",
      proposal_date: new Date().toISOString().split("T")[0],
      notes: "",
    });
    setDialogOpen(true);
  };

  const handleCreate = () => {
    const area = parseFloat(form.area_m2);
    if (!form.client_id || !form.project_name || !area || area <= 0) return;

    const disciplines: ProposalDisciplines = {};
    if (form.disc_estrutural) disciplines.estrutural = parseFloat(form.disc_estrutural);
    if (form.disc_hidraulica) disciplines.hidraulica = parseFloat(form.disc_hidraulica);
    if (form.disc_eletrica) disciplines.eletrica = parseFloat(form.disc_eletrica);

    const total = Object.values(disciplines).reduce((s, v) => s + (v || 0), 0);

    createProposal.mutate({
      client_id: form.client_id,
      project_name: form.project_name,
      area_m2: area,
      disciplines,
      total_value: total,
      proposal_date: form.proposal_date,
      responsible_id: user?.id || "",
      notes: form.notes || undefined,
    }, { onSuccess: () => setDialogOpen(false) });
  };

  const handleApprove = (p: CommercialProposal) => {
    if (confirm("Aprovar proposta e criar projeto no Planejamento?")) {
      approveProposal.mutate(p);
      setDetailProposal(null);
    }
  };

  const handleReject = (p: CommercialProposal) => {
    if (confirm("Reprovar esta proposta?")) {
      updateProposal.mutate({ id: p.id, status: "reprovada" as any });
      setDetailProposal(null);
    }
  };

  const handleStatusChange = (p: CommercialProposal, newStatus: ProposalStatus) => {
    if (newStatus === "aprovada") {
      handleApprove(p);
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
                {filtered.map((p) => (
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => setDetailProposal(p)}>
                    <TableCell className="font-medium">{p.project_name}</TableCell>
                    <TableCell>{p.client?.name || "—"}</TableCell>
                    <TableCell>{p.area_m2}</TableCell>
                    <TableCell>{fmt(p.total_value)}</TableCell>
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
                ))}
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
            <CreateProposalForm form={form} setForm={setForm} clients={clients} onSave={handleCreate} selectedClientId={form.client_id} />
          </DialogContent>
        </Dialog>

        {/* Detail dialog */}
        {detailProposal && (
          <ProposalDetailDialog
            proposal={detailProposal}
            onClose={() => setDetailProposal(null)}
            onApprove={() => handleApprove(detailProposal)}
            onReject={() => handleReject(detailProposal)}
            onStatusChange={(s) => handleStatusChange(detailProposal, s)}
          />
        )}
      </div>
    </AppLayout>
  );
}

function CreateProposalForm({ form, setForm, clients, onSave, selectedClientId }: any) {
  const { data: history = [] } = useClientHistory(selectedClientId || null);

  const totalValue =
    (parseFloat(form.disc_estrutural) || 0) +
    (parseFloat(form.disc_hidraulica) || 0) +
    (parseFloat(form.disc_eletrica) || 0);

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

      {/* Client history */}
      {history.length > 0 && (
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="p-3">
            <p className="text-xs font-semibold text-muted-foreground mb-2">📊 Histórico de preços deste cliente</p>
            {history.slice(0, 3).map((h: any) => (
              <div key={h.id} className="text-xs border-b border-border/50 pb-1 mb-1">
                <span className="font-medium">{h.project_name}</span> — {h.area_m2}m²
                {(["estrutural", "hidraulica", "eletrica"] as const).map((d) => {
                  const val = h.disciplines?.[d];
                  return val ? (
                    <span key={d} className="ml-2 text-muted-foreground">
                      {d.charAt(0).toUpperCase()}: R${(val / h.area_m2).toFixed(2)}/m²
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
        <Label className="text-sm font-semibold">Valores por Disciplina</Label>
        <div className="grid grid-cols-3 gap-2">
          <div><Label className="text-xs">Estrutural (R$)</Label><Input type="number" value={form.disc_estrutural} onChange={(e) => setForm({ ...form, disc_estrutural: e.target.value })} /></div>
          <div><Label className="text-xs">Hidráulica (R$)</Label><Input type="number" value={form.disc_hidraulica} onChange={(e) => setForm({ ...form, disc_hidraulica: e.target.value })} /></div>
          <div><Label className="text-xs">Elétrica (R$)</Label><Input type="number" value={form.disc_eletrica} onChange={(e) => setForm({ ...form, disc_eletrica: e.target.value })} /></div>
        </div>
        <p className="text-xs text-muted-foreground">Valor total: {totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
      </div>

      <div><Label>Data da Proposta</Label><Input type="date" value={form.proposal_date} onChange={(e) => setForm({ ...form, proposal_date: e.target.value })} /></div>
      <div><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>

      <Button onClick={onSave} className="w-full" disabled={!form.client_id || !form.project_name || !form.area_m2}>
        Criar Proposta
      </Button>
    </div>
  );
}

function ProposalDetailDialog({ proposal, onClose, onApprove, onReject, onStatusChange }: {
  proposal: CommercialProposal;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  onStatusChange: (s: ProposalStatus) => void;
}) {
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const { data: history = [] } = useClientHistory(proposal.client_id);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{proposal.project_name}</DialogTitle></DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-muted-foreground">Cliente:</span> <span className="font-medium">{proposal.client?.name}</span></div>
            <div><span className="text-muted-foreground">Área:</span> <span className="font-medium">{proposal.area_m2} m²</span></div>
            <div><span className="text-muted-foreground">Valor Total:</span> <span className="font-medium">{fmt(proposal.total_value)}</span></div>
            <div><span className="text-muted-foreground">Data:</span> <span className="font-medium">{new Date(proposal.proposal_date).toLocaleDateString("pt-BR")}</span></div>
            <div><span className="text-muted-foreground">Status:</span> <Badge className={STATUS_COLORS[proposal.status]}>{PROPOSAL_STATUS_LABELS[proposal.status]}</Badge></div>
            {proposal.linked_project_id && <div><span className="text-muted-foreground">Projeto vinculado</span> <Badge variant="outline">✓</Badge></div>}
          </div>

          {/* Disciplines */}
          <Card className="bg-muted/30">
            <CardContent className="p-3">
              <p className="text-xs font-semibold mb-2">Valores por Disciplina</p>
              <div className="grid grid-cols-3 gap-3 text-sm">
                {(["estrutural", "hidraulica", "eletrica"] as const).map((d) => {
                  const val = proposal.disciplines?.[d];
                  return (
                    <div key={d}>
                      <p className="text-muted-foreground capitalize">{d}</p>
                      <p className="font-medium">{val ? fmt(val) : "—"}</p>
                      {val && proposal.area_m2 > 0 && <p className="text-xs text-muted-foreground">R$ {(val / proposal.area_m2).toFixed(2)}/m²</p>}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {proposal.notes && <div><p className="text-xs text-muted-foreground">Observações:</p><p className="text-sm">{proposal.notes}</p></div>}

          {/* Historical prices */}
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

          {/* Status change */}
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
