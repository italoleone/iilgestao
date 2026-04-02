import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCommercialProposals, useUpdateProposal, useApproveProposal, PROPOSAL_STATUS_LABELS, PIPELINE_COLUMNS, type ProposalStatus, type CommercialProposal } from "@/hooks/useCommercialData";
import { useState } from "react";
import { GripVertical } from "lucide-react";

const COLUMN_COLORS: Record<ProposalStatus, string> = {
  lead: "border-t-slate-400",
  contato_feito: "border-t-blue-400",
  em_elaboracao: "border-t-yellow-400",
  enviada: "border-t-purple-400",
  em_negociacao: "border-t-orange-400",
  aprovada: "border-t-green-400",
  reprovada: "border-t-red-400",
};

export default function ComercialPipeline() {
  const { data: proposals = [] } = useCommercialProposals();
  const updateProposal = useUpdateProposal();
  const approveProposal = useApproveProposal();
  const [draggedId, setDraggedId] = useState<string | null>(null);

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
      approveProposal.mutate(proposal);
    } else {
      updateProposal.mutate({ id: draggedId, status: targetStatus as any });
    }
    setDraggedId(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
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
            const total = cards.reduce((s, p) => s + p.total_value, 0);
            return (
              <div
                key={status}
                className="min-w-[220px] flex-shrink-0"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, status)}
              >
                <Card className={`border-t-4 ${COLUMN_COLORS[status]}`}>
                  <CardHeader className="p-3 pb-1">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xs font-semibold uppercase tracking-wide">
                        {PROPOSAL_STATUS_LABELS[status]}
                      </CardTitle>
                      <Badge variant="secondary" className="text-xs">{cards.length}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{fmt(total)}</p>
                  </CardHeader>
                  <CardContent className="p-2 space-y-2 min-h-[100px]">
                    {cards.map((p) => (
                      <div
                        key={p.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, p.id)}
                        className="bg-card border border-border rounded-md p-2 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start gap-1">
                          <GripVertical className="h-3 w-3 mt-0.5 text-muted-foreground/40 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{p.project_name}</p>
                            <p className="text-xs text-muted-foreground truncate">{p.client?.name}</p>
                            <p className="text-xs font-semibold text-foreground mt-1">{fmt(p.total_value)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
