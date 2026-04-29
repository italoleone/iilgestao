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
import { CalendarClock, CheckCircle2, Pencil } from "lucide-react";
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

interface ScheduleRow {
  id: string;
  project_id: string;
  stage_key: string;
  stage_label: string;
  execution_month: number | null;
  execution_year: number | null;
  billing_month: number | null;
  billing_year: number | null;
  amount: number;
  status: string;
}

const fmtMonthYear = (m: number | null, y: number | null) =>
  m && y ? `${MONTHS[m - 1]}/${y}` : "—";

const addMonth = (m: number, y: number): { m: number; y: number } =>
  m === 12 ? { m: 1, y: y + 1 } : { m: m + 1, y };

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

export function ProjectBillingScheduleCard({
  projectId, projectSaleValue, userId, canEdit,
}: Props) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data: rows = [] } = useQuery({
    queryKey: ["project-billing-schedule", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_billing_schedule")
        .select("*")
        .eq("project_id", projectId);
      if (error) throw error;
      return (data ?? []) as ScheduleRow[];
    },
  });

  // Ordena pela ordem fixa de etapas
  const ordered = useMemo(
    () => STAGES
      .map((s) => rows.find((r) => r.stage_key === s.key))
      .filter(Boolean) as ScheduleRow[],
    [rows],
  );

  const totalAmount = ordered.reduce((s, r) => s + Number(r.amount || 0), 0);

  const toggleStatus = useMutation({
    mutationFn: async (row: ScheduleRow) => {
      const next = row.status === "executado" ? "pendente" : "executado";
      const { error } = await supabase
        .from("project_billing_schedule")
        .update({ status: next })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-billing-schedule", projectId] }),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <Card className="shadow-sm animate-reveal-up delay-3" style={{ animationFillMode: "backwards" }}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarClock className="h-4 w-4" /> Cronograma de Faturamento
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
                      <tr key={r.id} className={cn("border-b last:border-0", isDone && "bg-success/5")}>
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
                        <td className="py-2 px-3 text-right tabular-nums">R$ {formatBRL(Number(r.amount || 0))}</td>
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
          existing={rows}
          onClose={() => {
            setEditing(false);
            qc.invalidateQueries({ queryKey: ["project-billing-schedule", projectId] });
          }}
        />
      )}
    </>
  );
}

// ─── Edit modal ──────────────────────────────────────────────────────────────

function EditScheduleModal({
  projectId, projectSaleValue, userId, existing, onClose,
}: {
  projectId: string;
  projectSaleValue: number;
  userId: string;
  existing: ScheduleRow[];
  onClose: () => void;
}) {
  const now = new Date();
  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1, now.getFullYear() + 2];

  const buildInitial = (): Record<string, CellState> => {
    const out: Record<string, CellState> = {};
    for (const stage of STAGES) {
      const e = existing.find((r) => r.stage_key === stage.key);
      out[stage.key] = {
        enabled: !!e,
        execution_month: e?.execution_month ? String(e.execution_month) : String(now.getMonth() + 1),
        execution_year: e?.execution_year ? String(e.execution_year) : String(now.getFullYear()),
        billing_month: e?.billing_month ? String(e.billing_month) : "",
        billing_year: e?.billing_year ? String(e.billing_year) : "",
        billing_touched: !!(e?.billing_month && e?.billing_year),
        amount: e ? formatBRL(Number(e.amount || 0)) : "",
      };
      // Sugerir billing = execution + 1 mês se ainda não definido
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
      // Apaga e re-insere
      const { error: delErr } = await supabase
        .from("project_billing_schedule")
        .delete()
        .eq("project_id", projectId);
      if (delErr) throw delErr;

      const toInsert = STAGES
        .filter((st) => cells[st.key]?.enabled)
        .map((st) => {
          const c = cells[st.key];
          const existingRow = existing.find((r) => r.stage_key === st.key);
          return {
            project_id: projectId,
            stage_key: st.key,
            stage_label: st.label,
            execution_month: c.execution_month ? parseInt(c.execution_month) : null,
            execution_year: c.execution_year ? parseInt(c.execution_year) : null,
            billing_month: c.billing_month ? parseInt(c.billing_month) : null,
            billing_year: c.billing_year ? parseInt(c.billing_year) : null,
            amount: parseBRL(c.amount) || 0,
            status: existingRow?.status ?? "pendente",
            created_by: userId,
          };
        });

      if (toInsert.length > 0) {
        const { error: insErr } = await supabase
          .from("project_billing_schedule")
          .insert(toInsert);
        if (insErr) throw insErr;
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
