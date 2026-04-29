import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { CalendarClock, CheckCircle2, Pencil, LinkIcon } from "lucide-react";
import { formatBRL, parseBRL, cn } from "@/lib/utils";
import { toast } from "sonner";

const STAGES: { key: string; label: string }[] = [
  { key: "sinal",          label: "Sinal"               },
  { key: "ep",             label: "Estudo Preliminar"   },
  { key: "ap",             label: "Ante Projeto"        },
  { key: "pre_executivo",  label: "Pré Executivo"       },
  { key: "executivo",      label: "Executivo"           },
  { key: "liberado_obra",  label: "Liberado para Obra"  },
];

const MONTHS = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

// Aggregated row used for display (per stage_key)
interface StageRow {
  stage_key: string;
  stage_label: string;
  execution_month: number | null;
  execution_year: number | null;
  billing_month: number | null;
  billing_year: number | null;
  amount: number;
  status: string; // "executado" if all source rows are executed
  ids: string[];  // underlying row ids in the source table
}

const fmtMonthYear = (m: number | null, y: number | null) =>
  m && y ? `${MONTHS[m - 1]}/${y}` : "—";

const addMonth = (m: number, y: number): { m: number; y: number } =>
  m === 12 ? { m: 1, y: y + 1 } : { m: m + 1, y };

const monthRank = (m: number | null, y: number | null) =>
  m && y ? y * 12 + m : Number.POSITIVE_INFINITY;

interface CellState {
  enabled: boolean;
  execution_month: string;
  execution_year: string;
  billing_month: string;
  billing_year: string;
  billing_touched: boolean;
  amount: string;
}

interface Props {
  projectId: string;
  projectSaleValue: number;
  userId: string;
  canEdit: boolean;
}

type Source = "proposal" | "project";

export function ProjectBillingScheduleCard({
  projectId, projectSaleValue, userId, canEdit,
}: Props) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  // 1) Find linked proposal (if any)
  const { data: linkedProposalId, isLoading: loadingLink } = useQuery({
    queryKey: ["project-linked-proposal", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commercial_proposals")
        .select("id")
        .eq("linked_project_id", projectId)
        .maybeSingle();
      if (error) throw error;
      return data?.id ?? null;
    },
  });

  const source: Source = linkedProposalId ? "proposal" : "project";

  // 2) Read schedule from the appropriate table
  const { data: rawRows = [] } = useQuery({
    queryKey: ["project-billing-schedule-data", projectId, source, linkedProposalId],
    enabled: !loadingLink,
    queryFn: async () => {
      if (source === "proposal" && linkedProposalId) {
        const { data, error } = await supabase
          .from("proposal_billing_schedule")
          .select("*")
          .eq("proposal_id", linkedProposalId);
        if (error) throw error;
        return data ?? [];
      }
      const { data, error } = await supabase
        .from("project_billing_schedule")
        .select("*")
        .eq("project_id", projectId);
      if (error) throw error;
      return data ?? [];
    },
  });

  // 3) Aggregate by stage_key
  const ordered: StageRow[] = useMemo(() => {
    const byStage = new Map<string, any[]>();
    for (const r of rawRows as any[]) {
      const arr = byStage.get(r.stage_key) ?? [];
      arr.push(r);
      byStage.set(r.stage_key, arr);
    }
    const out: StageRow[] = [];
    for (const stage of STAGES) {
      const list = byStage.get(stage.key);
      if (!list || list.length === 0) continue;
      // Earliest execution / billing dates across rows
      const exec = list.reduce((acc, r) => {
        if (monthRank(r.execution_month, r.execution_year) < monthRank(acc.execution_month, acc.execution_year)) {
          return r;
        }
        return acc;
      }, list[0]);
      const bill = list.reduce((acc, r) => {
        if (monthRank(r.billing_month, r.billing_year) < monthRank(acc.billing_month, acc.billing_year)) {
          return r;
        }
        return acc;
      }, list[0]);
      const amount = list.reduce((s, r) => s + Number(r.amount || 0), 0);
      const allExec = list.every((r) => r.status === "executado");
      out.push({
        stage_key: stage.key,
        stage_label: stage.label,
        execution_month: exec.execution_month ?? null,
        execution_year: exec.execution_year ?? null,
        billing_month: bill.billing_month ?? null,
        billing_year: bill.billing_year ?? null,
        amount,
        status: allExec ? "executado" : "pendente",
        ids: list.map((r) => r.id),
      });
    }
    return out;
  }, [rawRows]);

  const totalAmount = ordered.reduce((s, r) => s + r.amount, 0);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["project-billing-schedule-data", projectId] });

  const toggleStatus = useMutation({
    mutationFn: async (row: StageRow) => {
      const next = row.status === "executado" ? "pendente" : "executado";
      const table = source === "proposal" ? "proposal_billing_schedule" : "project_billing_schedule";
      const { error } = await supabase
        .from(table)
        .update({ status: next })
        .in("id", row.ids);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <Card className="shadow-sm animate-reveal-up delay-3" style={{ animationFillMode: "backwards" }}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarClock className="h-4 w-4" /> Cronograma de Faturamento
            {source === "proposal" && (
              <Badge variant="outline" className="ml-1 text-[10px] font-normal gap-1">
                <LinkIcon className="h-3 w-3" /> vinculado à proposta
              </Badge>
            )}
          </CardTitle>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5 mr-1" /> Editar Cronograma
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {ordered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma etapa cadastrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 px-3 font-medium">Etapa</th>
                    <th className="text-left py-2 px-3 font-medium">Mês/Ano de Execução</th>
                    <th className="text-left py-2 px-3 font-medium">Mês/Ano de Faturamento</th>
                    <th className="text-right py-2 px-3 font-medium">Valor (R$)</th>
                    <th className="text-center py-2 px-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ordered.map((r) => {
                    const isDone = r.status === "executado";
                    return (
                      <tr key={r.stage_key} className={cn("border-b last:border-0", isDone && "bg-success/5")}>
                        <td className="py-2 px-3 font-medium">
                          <div className="flex items-center gap-2">
                            {r.stage_label}
                            {isDone && (
                              <span className="inline-flex items-center gap-1 text-xs text-success">
                                <CheckCircle2 className="h-3.5 w-3.5" /> pronto p/ faturar
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3">{fmtMonthYear(r.execution_month, r.execution_year)}</td>
                        <td className="py-2 px-3">{fmtMonthYear(r.billing_month, r.billing_year)}</td>
                        <td className="py-2 px-3 text-right tabular-nums">R$ {formatBRL(r.amount)}</td>
                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => toggleStatus.mutate(r)}
                            className="cursor-pointer"
                            title="Clique para alternar"
                          >
                            <Badge
                              className={cn(
                                "transition-colors",
                                isDone
                                  ? "bg-success text-success-foreground hover:bg-success/90"
                                  : "bg-muted text-muted-foreground hover:bg-muted/80",
                              )}
                            >
                              {isDone ? "Executado" : "Pendente"}
                            </Badge>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t font-medium">
                    <td className="py-2 px-3" colSpan={3}>Total</td>
                    <td className="py-2 px-3 text-right tabular-nums">R$ {formatBRL(totalAmount)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {editing && (
        <EditScheduleModal
          projectId={projectId}
          projectSaleValue={projectSaleValue}
          userId={userId}
          source={source}
          proposalId={linkedProposalId ?? null}
          existingStages={ordered}
          rawRows={rawRows as any[]}
          onClose={() => {
            setEditing(false);
            invalidate();
          }}
        />
      )}
    </>
  );
}

// ─── Edit modal ──────────────────────────────────────────────────────────────

function EditScheduleModal({
  projectId, projectSaleValue, userId, source, proposalId, existingStages, rawRows, onClose,
}: {
  projectId: string;
  projectSaleValue: number;
  userId: string;
  source: Source;
  proposalId: string | null;
  existingStages: StageRow[];
  rawRows: any[];
  onClose: () => void;
}) {
  const now = new Date();
  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1, now.getFullYear() + 2];

  const buildInitial = (): Record<string, CellState> => {
    const out: Record<string, CellState> = {};
    for (const stage of STAGES) {
      const e = existingStages.find((r) => r.stage_key === stage.key);
      out[stage.key] = {
        enabled: !!e,
        execution_month: e?.execution_month ? String(e.execution_month) : String(now.getMonth() + 1),
        execution_year: e?.execution_year ? String(e.execution_year) : String(now.getFullYear()),
        billing_month: e?.billing_month ? String(e.billing_month) : "",
        billing_year: e?.billing_year ? String(e.billing_year) : "",
        billing_touched: !!(e?.billing_month && e?.billing_year),
        amount: e ? formatBRL(e.amount) : "",
      };
      const c = out[stage.key];
      if (!c.billing_touched) {
        const em = parseInt(c.execution_month);
        const ey = parseInt(c.execution_year);
        if (em && ey) {
          const next = addMonth(em, ey);
          c.billing_month = String(next.m);
          c.billing_year = String(next.y);
        }
      }
    }
    return out;
  };

  const [cells, setCells] = useState<Record<string, CellState>>(buildInitial);

  const update = (key: string, patch: Partial<CellState>) => {
    setCells((prev) => {
      const cur = prev[key];
      const next = { ...cur, ...patch };
      const execChanged = patch.execution_month !== undefined || patch.execution_year !== undefined;
      if (execChanged && !next.billing_touched) {
        const em = parseInt(next.execution_month);
        const ey = parseInt(next.execution_year);
        if (em && ey) {
          const a = addMonth(em, ey);
          next.billing_month = String(a.m);
          next.billing_year = String(a.y);
        }
      }
      return { ...prev, [key]: next };
    });
  };

  const total = STAGES.reduce((s, st) => {
    const c = cells[st.key];
    if (!c?.enabled) return s;
    return s + (parseBRL(c.amount) || 0);
  }, 0);
  const diff = projectSaleValue - total;

  const saveMut = useMutation({
    mutationFn: async () => {
      if (source === "proposal" && proposalId) {
        // Update dates / amounts on existing proposal_billing_schedule rows.
        // Disabling a stage deletes its rows. Enabling a stage that doesn't
        // currently exist in the proposal is not supported (no discipline info).
        for (const stage of STAGES) {
          const c = cells[stage.key];
          const stageRows = rawRows.filter((r) => r.stage_key === stage.key);
          if (!c?.enabled) {
            if (stageRows.length > 0) {
              const { error } = await supabase
                .from("proposal_billing_schedule")
                .delete()
                .in("id", stageRows.map((r) => r.id));
              if (error) throw error;
            }
            continue;
          }
          if (stageRows.length === 0) continue; // can't create new stage rows here

          const newAmount = parseBRL(c.amount) || 0;
          const oldTotal = stageRows.reduce((s, r) => s + Number(r.amount || 0), 0);
          const exec_m = c.execution_month ? parseInt(c.execution_month) : null;
          const exec_y = c.execution_year ? parseInt(c.execution_year) : null;
          const bill_m = c.billing_month ? parseInt(c.billing_month) : null;
          const bill_y = c.billing_year ? parseInt(c.billing_year) : null;

          for (const r of stageRows) {
            const ratio = oldTotal > 0 ? Number(r.amount || 0) / oldTotal : 1 / stageRows.length;
            const scaledAmount = Math.round(newAmount * ratio * 100) / 100;
            const { error } = await supabase
              .from("proposal_billing_schedule")
              .update({
                execution_month: exec_m,
                execution_year: exec_y,
                billing_month: bill_m,
                billing_year: bill_y,
                amount: scaledAmount,
              })
              .eq("id", r.id);
            if (error) throw error;
          }
        }
      } else {
        // Project-direct: delete and re-insert
        const { error: delErr } = await supabase
          .from("project_billing_schedule")
          .delete()
          .eq("project_id", projectId);
        if (delErr) throw delErr;

        const toInsert = STAGES
          .filter((st) => cells[st.key]?.enabled)
          .map((st) => {
            const c = cells[st.key];
            const existing = existingStages.find((r) => r.stage_key === st.key);
            return {
              project_id: projectId,
              stage_key: st.key,
              stage_label: st.label,
              execution_month: c.execution_month ? parseInt(c.execution_month) : null,
              execution_year: c.execution_year ? parseInt(c.execution_year) : null,
              billing_month: c.billing_month ? parseInt(c.billing_month) : null,
              billing_year: c.billing_year ? parseInt(c.billing_year) : null,
              amount: parseBRL(c.amount) || 0,
              status: existing?.status ?? "pendente",
              created_by: userId,
            };
          });

        if (toInsert.length > 0) {
          const { error: insErr } = await supabase
            .from("project_billing_schedule")
            .insert(toInsert);
          if (insErr) throw insErr;
        }
      }
    },
    onSuccess: () => {
      toast.success("Cronograma salvo!");
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" /> Editar Cronograma de Faturamento
          </DialogTitle>
        </DialogHeader>

        {source === "proposal" && (
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
            <LinkIcon className="h-3.5 w-3.5" />
            Este cronograma está vinculado à proposta de origem.
          </div>
        )}

        <div className="space-y-3">
          {STAGES.map((stage) => {
            const c = cells[stage.key];
            return (
              <div
                key={stage.key}
                className={cn(
                  "border border-border rounded-lg p-3 transition-colors",
                  c.enabled && "bg-muted/30",
                )}
              >
                <div className="flex items-center gap-3 mb-2">
                  <Switch
                    checked={c.enabled}
                    onCheckedChange={(v) => update(stage.key, { enabled: v })}
                  />
                  <span className={cn("font-medium", !c.enabled && "text-muted-foreground")}>
                    {stage.label}
                  </span>
                </div>

                {c.enabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 pl-10">
                    <div>
                      <Label className="text-xs">Mês exec.</Label>
                      <Select
                        value={c.execution_month}
                        onValueChange={(v) => update(stage.key, { execution_month: v })}
                      >
                        <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {MONTHS.map((m, i) => (
                            <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Ano exec.</Label>
                      <Select
                        value={c.execution_year}
                        onValueChange={(v) => update(stage.key, { execution_year: v })}
                      >
                        <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {years.map((y) => (
                            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Mês fat.</Label>
                      <Select
                        value={c.billing_month}
                        onValueChange={(v) => update(stage.key, { billing_month: v, billing_touched: true })}
                      >
                        <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {MONTHS.map((m, i) => (
                            <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Ano fat.</Label>
                      <Select
                        value={c.billing_year}
                        onValueChange={(v) => update(stage.key, { billing_year: v, billing_touched: true })}
                      >
                        <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {years.map((y) => (
                            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Valor (R$)</Label>
                      <Input
                        value={c.amount}
                        onChange={(e) => update(stage.key, { amount: e.target.value })}
                        placeholder="0,00"
                        className="h-8 text-xs mt-1"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter className="flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm">
            <span className="text-muted-foreground">Total agendado: </span>
            <strong className="tabular-nums">R$ {formatBRL(total)}</strong>
            <span className="text-muted-foreground ml-2">
              / Valor de venda: <strong className="tabular-nums">R$ {formatBRL(projectSaleValue)}</strong>
            </span>
            {Math.abs(diff) > 0.01 && (
              <span className={cn("ml-2 text-xs", diff > 0 ? "text-warning" : "text-destructive")}>
                ({diff > 0 ? `faltam R$ ${formatBRL(diff)}` : `excesso R$ ${formatBRL(Math.abs(diff))}`})
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
              {saveMut.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
