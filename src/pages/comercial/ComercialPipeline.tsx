import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  useCommercialProposals, useUpdateProposal, useApproveProposal,
  PROPOSAL_STATUS_LABELS, PIPELINE_COLUMNS,
  type ProposalStatus, type CommercialProposal, type ProposalDiscounts, type ProposalDisciplines,
} from "@/hooks/useCommercialData";
import { useAuth } from "@/contexts/AuthContext";
import { GripVertical, CheckCircle } from "lucide-react";
import { toast } from "sonner";

const COLUMN_COLORS: Record<ProposalStatus, string> = {
  lead: "border-t-slate-400",
  contato_feito: "border-t-blue-400",
  em_elaboracao: "border-t-yellow-400",
  enviada: "border-t-purple-400",
  em_negociacao: "border-t-orange-400",
  aprovada: "border-t-green-400",
  reprovada: "border-t-red-400",
};

const DISC_LABELS: Record<string, string> = { estrutural: "Estrutural", hidraulica: "Hidráulica", eletrica: "Elétrica" };

export default function ComercialPipeline() {
  const { data: proposals = [] } = useCommercialProposals();
  const updateProposal = useUpdateProposal();
  const approveProposal = useApproveProposal();
  const { user } = useAuth();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [approvalTarget, setApprovalTarget] = useState<CommercialProposal | null>(null);
  const [discountForm, setDiscountForm] = useState<ProposalDiscounts>({ estrutural: 0, hidraulica: 0, eletrica: 0 });
  const [projectNumber, setProjectNumber] = useState<string>("");

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (e: React.DragEvent, targetStatus: ProposalStatus) => {
    e.preventDefault();
    if (!draggedId) return;
    const proposal = proposals.find((p) => p.id === draggedId);
    if (!proposal || proposal.status === targetStatus) {
      setDraggedId(null);
      return;
    }

    if (targetStatus === "aprovada") {
      setApprovalTarget(proposal);
      setDiscountForm({ estrutural: 0, hidraulica: 0, eletrica: 0 });
      setProjectNumber("");
    } else {
      updateProposal.mutate({ id: draggedId, status: targetStatus as any });
    }
    setDraggedId(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleApproveWithDiscount = () => {
    if (!approvalTarget || !user) return;
    const trimmed = projectNumber.trim();
    if (!trimmed) { toast.error("Informe o Número do Projeto."); return; }
    approveProposal.mutate({
      proposal: approvalTarget,
      discounts: discountForm,
      userId: user.id,
      projectNumber: trimmed,
    }, { onSuccess: () => { setApprovalTarget(null); setProjectNumber(""); } });
  };

  const fmt = (v: number) =>
    v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : `R$ ${v.toFixed(0)}`;

  return (
    <AppLayout>
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Pipeline Comercial</h1>

        <div className="flex gap-3 overflow-x-auto pb-4">
          {PIPELINE_COLUMNS.map((status) => {
            const cards = proposals.filter((p) => p.status === status);
            const total = cards.reduce((s, p) => {
              const val = p.status === "aprovada" && p.final_total_value > 0 ? p.final_total_value : p.total_value;
              return s + val;
            }, 0);
            return (
              <div key={status} className="min-w-[220px] flex-shrink-0" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, status)}>
                <Card className={`border-t-4 ${COLUMN_COLORS[status]}`}>
                  <CardHeader className="p-3 pb-1">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xs font-semibold uppercase tracking-wide">{PROPOSAL_STATUS_LABELS[status]}</CardTitle>
                      <Badge variant="secondary" className="text-xs">{cards.length}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{fmt(total)}</p>
                  </CardHeader>
                  <CardContent className="p-2 space-y-2 min-h-[100px]">
                    {cards.map((p) => {
                      const displayVal = p.status === "aprovada" && p.final_total_value > 0 ? p.final_total_value : p.total_value;
                      return (
                        <div key={p.id} draggable onDragStart={(e) => handleDragStart(e, p.id)} className="bg-card border border-border rounded-md p-2 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow">
                          <div className="flex items-start gap-1">
                            <GripVertical className="h-3 w-3 mt-0.5 text-muted-foreground/40 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate">{p.project_name}</p>
                              <p className="text-xs text-muted-foreground truncate">{p.client?.name}</p>
                              <p className="text-xs font-semibold text-foreground mt-1">{fmt(displayVal)}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>

        {/* Approval discount modal */}
        {approvalTarget && (
          <ApprovalModal
            proposal={approvalTarget}
            discounts={discountForm}
            setDiscounts={setDiscountForm}
            projectNumber={projectNumber}
            setProjectNumber={setProjectNumber}
            onConfirm={handleApproveWithDiscount}
            onCancel={() => { setApprovalTarget(null); setProjectNumber(""); }}
            isLoading={approveProposal.isPending}
          />
        )}
      </div>
    </AppLayout>
  );
}

function ApprovalModal({ proposal, discounts, setDiscounts, projectNumber, setProjectNumber, onConfirm, onCancel, isLoading }: {
  proposal: CommercialProposal;
  discounts: ProposalDiscounts;
  setDiscounts: (d: ProposalDiscounts) => void;
  projectNumber: string;
  setProjectNumber: (v: string) => void;
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
          <div className="space-y-1">
            <Label className="text-sm font-medium">Número do Projeto <span className="text-destructive">*</span></Label>
            <Input value={projectNumber} onChange={(e) => setProjectNumber(e.target.value)} placeholder="Ex: 0480 - 21" />
          </div>
          <p className="text-sm text-muted-foreground">Defina o desconto (%) para cada disciplina.</p>
          {discs.map((d) => {
            const original = proposal.disciplines[d] || 0;
            const final_ = finalValues[d] || 0;
            return (
              <div key={d} className="border border-border rounded-md p-3 space-y-1">
                <p className="text-sm font-medium">{DISC_LABELS[d]}</p>
                <p className="text-xs text-muted-foreground">Original: {fmt(original)}</p>
                <div className="flex items-center gap-2">
                  <Label className="text-xs whitespace-nowrap">Desconto (%)</Label>
                  <Input type="number" min={0} max={100} value={discounts[d] ?? 0} onChange={(e) => {
                    const val = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                    setDiscounts({ ...discounts, [d]: val });
                  }} className="w-24" />
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
