import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AlertTriangle, Check, DollarSign, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAll";
import { cn, formatBRL, formatDateBR } from "@/lib/utils";
import { toast } from "sonner";
import { computeTotals, displayStatus, splitLabel, type Receipt } from "@/lib/receipts";
import { MarkPaidDialog, ReceiptDialog, ReceiptStatusBadge } from "./ReceiptParts";

export function ProjectReceiptsCard({ projectId, saleValue, userId }: { projectId: string; saleValue: number | null | undefined; userId?: string }) {
  const [rows, setRows] = useState<Receipt[]>([]);
  const [edit, setEdit] = useState<Receipt | null | undefined>(undefined);
  const [paying, setPaying] = useState<Receipt | null>(null);
  const [deleting, setDeleting] = useState<Receipt | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchAllRows<Receipt>(() => supabase.from("project_receipts").select("*").eq("project_id", projectId));
      data.sort((a, b) => ((b.paid_date || b.due_date || "") > (a.paid_date || a.due_date || "") ? 1 : -1));
      setRows(data);
    } catch (e: any) { toast.error("Erro ao carregar recebimentos: " + e.message); }
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const t = useMemo(() => computeTotals(rows, saleValue), [rows, saleValue]);

  const remove = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("project_receipts").delete().eq("id", deleting.id);
    if (error) toast.error("Erro ao excluir: " + error.message); else { toast.success("Recebimento excluído"); load(); }
    setDeleting(null);
  };

  const stat = (label: string, value: string, extra?: React.ReactNode) => (
    <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="font-semibold tabular-nums">{value}</p>{extra}</div>
  );

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4" />Recebimentos</CardTitle>
        <Button size="sm" onClick={() => setEdit(null)}><Plus className="h-4 w-4 mr-1" />Adicionar recebimento</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {stat("Valor de venda", t.sem_valor_venda ? "—" : formatBRL(t.sale_value ?? 0))}
          {stat("Recebido (bruto)", formatBRL(t.recebido_bruto))}
          {stat("Recebido (líquido)", formatBRL(t.recebido_liquido))}
          {stat("Em aberto", formatBRL(t.em_aberto), t.vencido > 0 && <p className="text-xs font-medium text-destructive">Vencido: {formatBRL(t.vencido)}</p>)}
          {stat("Previsto", formatBRL(t.previsto))}
          {stat("Saldo a receber", t.sem_valor_venda ? "—" : formatBRL(t.saldo_a_receber))}
        </div>
        {t.sem_valor_venda && (
          <p className="text-sm text-warning-foreground bg-warning/20 rounded-md px-3 py-2 flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Valor de venda não cadastrado — o saldo não pode ser calculado</p>
        )}
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum recebimento lançado.</p> : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead>NF</TableHead><TableHead className="text-right">Bruto</TableHead><TableHead className="text-right">Líquido</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const st = displayStatus(r); const split = splitLabel(r, rows);
                  return (
                    <TableRow key={r.id} className={cn(r.status === "cancelado" && "opacity-60")}>
                      <TableCell className="whitespace-nowrap text-xs">{r.paid_date ? formatDateBR(r.paid_date) : r.due_date ? <>Venc. {formatDateBR(r.due_date)}</> : "—"}</TableCell>
                      <TableCell className="text-sm max-w-xs">
                        <div className="flex items-start gap-1">
                          {r.needs_review && <Tooltip><TooltipTrigger asChild><AlertTriangle className="h-4 w-4 shrink-0 text-warning" aria-label="Precisa conferir" /></TooltipTrigger><TooltipContent>{r.review_note || "Precisa conferir"}</TooltipContent></Tooltip>}
                          <span className="line-clamp-2">{r.description}</span>
                        </div>
                        {split && <Tooltip><TooltipTrigger asChild><span className="text-[11px] text-muted-foreground underline decoration-dotted cursor-help">{split}</span></TooltipTrigger><TooltipContent>Esta linha é uma parte da mesma cobrança dividida entre disciplinas</TooltipContent></Tooltip>}
                      </TableCell>
                      <TableCell className="text-xs">{r.invoice_number || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{formatBRL(Number(r.gross_amount))}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{r.net_amount != null ? formatBRL(Number(r.net_amount)) : "—"}</TableCell>
                      <TableCell><ReceiptStatusBadge status={st} /></TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        {(r.status === "em_aberto" || r.status === "previsto") && <Button size="icon" variant="ghost" className="h-7 w-7" title="Marcar como pago" onClick={() => setPaying(r)}><Check className="h-4 w-4" /></Button>}
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="Editar" onClick={() => setEdit(r)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="Excluir" onClick={() => setDeleting(r)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      <ReceiptDialog open={edit !== undefined} onOpenChange={(o) => !o && setEdit(undefined)} projectId={projectId} receipt={edit ?? null} userId={userId} onSaved={load} />
      <MarkPaidDialog receipt={paying} onOpenChange={(o) => !o && setPaying(null)} onSaved={load} />
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir recebimento?</AlertDialogTitle><AlertDialogDescription>{deleting?.description} — {deleting ? formatBRL(Number(deleting.gross_amount)) : ""}. Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={remove}>Excluir</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
