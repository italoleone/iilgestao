import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, Download, Plus } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAll";
import { cn, formatBRL, formatDateBR } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { computeTotals, csvEscape, displayStatus, splitLabel, STATUS_LABEL, type DisplayStatus, type Receipt } from "@/lib/receipts";
import { ReceiptDialog, ReceiptStatusBadge } from "@/components/receipts/ReceiptParts";

interface Proj { id: string; name: string; client: string }
const ALL = "all";
const monthOf = (r: Receipt) => (r.paid_date || r.due_date || "").slice(0, 7);
const monthLabel = (m: string) => (m ? `${m.slice(5, 7)}/${m.slice(0, 4)}` : "Sem data");

export default function Recebimentos() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Receipt[]>([]);
  const [projects, setProjects] = useState<Proj[]>([]);
  const [sales, setSales] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ month: ALL, status: ALL, client: ALL, project: ALL, review: false, source: ALL, q: "" });
  const [onlyNoSale, setOnlyNoSale] = useState(false);

  const load = useCallback(async () => {
    try {
      const [r, p, fin] = await Promise.all([
        fetchAllRows<Receipt>(() => supabase.from("project_receipts").select("*")),
        fetchAllRows<Proj>(() => supabase.from("projects").select("id,name,client")),
        fetchAllRows<{ project_id: string; sale_value: number }>(() => supabase.from("project_financials").select("project_id,sale_value"), 1000, "project_id"),
      ]);
      setRows(r); setProjects(p.sort((a, b) => a.name.localeCompare(b.name)));
      setSales(Object.fromEntries(fin.map((x) => [x.project_id, Number(x.sale_value) || 0])));
    } catch (e: any) { toast.error("Erro ao carregar: " + e.message); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const projById = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects]);
  const clients = useMemo(() => [...new Set(projects.map((p) => p.client).filter(Boolean))].sort(), [projects]);
  const months = useMemo(() => [...new Set(rows.map(monthOf))].sort().reverse(), [rows]);

  const filtered = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    return rows.filter((r) => {
      const p = projById[r.project_id];
      if (f.month !== ALL && monthOf(r) !== f.month) return false;
      if (f.status !== ALL && displayStatus(r) !== f.status) return false;
      if (f.client !== ALL && p?.client !== f.client) return false;
      if (f.project !== ALL && r.project_id !== f.project) return false;
      if (f.review && !r.needs_review) return false;
      if (f.source !== ALL && r.source !== f.source) return false;
      if (q && !`${r.description} ${r.invoice_number ?? ""} ${p?.name ?? ""} ${p?.client ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => {
      const ka = `${monthOf(a)}|${a.invoice_group ?? a.id}`, kb = `${monthOf(b)}|${b.invoice_group ?? b.id}`;
      return ka < kb ? 1 : ka > kb ? -1 : 0;
    });
  }, [rows, f, projById]);

  const sum = useMemo(() => filtered.reduce((acc, r) => r.status === "cancelado" ? acc : { g: acc.g + Number(r.gross_amount), n: acc.n + Number(r.net_amount ?? 0) }, { g: 0, n: 0 }), [filtered]);

  const exportCsv = () => {
    const head = ["Projeto", "Cliente", "Descrição", "NF", "Grupo", "% linha", "Bruto", "Líquido", "Emissão", "Vencimento", "Pagamento", "Status", "Precisa conferir", "Origem", "Ref."];
    const fmt = (v: number | null) => (v == null ? "" : Number(v).toFixed(2).replace(".", ","));
    const lines = filtered.map((r) => { const p = projById[r.project_id]; return [p?.name, p?.client, r.description, r.invoice_number, r.invoice_group, r.split_pct, fmt(r.gross_amount), fmt(r.net_amount),
      r.issue_date && formatDateBR(r.issue_date), r.due_date && formatDateBR(r.due_date), r.paid_date && formatDateBR(r.paid_date), STATUS_LABEL[displayStatus(r)], r.needs_review ? "sim" : "", r.source, r.source_ref].map(csvEscape).join(";"); });
    const blob = new Blob(["\ufeff" + [head.join(";"), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "recebimentos.csv"; a.click(); URL.revokeObjectURL(a.href);
  };

  const balances = useMemo(() => {
    const ids = new Set([...rows.map((r) => r.project_id), ...Object.entries(sales).filter(([, v]) => v > 0).map(([k]) => k)]);
    return [...ids].map((id) => {
      const t = computeTotals(rows.filter((r) => r.project_id === id), sales[id] ?? null);
      return { id, p: projById[id], ...t, pct: t.sale_value ? Math.min(100, (t.recebido_bruto / t.sale_value) * 100) : 0 };
    }).filter((b) => !onlyNoSale || b.sem_valor_venda).sort((a, b) => b.saldo_a_receber - a.saldo_a_receber);
  }, [rows, sales, projById, onlyNoSale]);

  const byMonth = useMemo(() => {
    const m: Record<string, { bruto: number; liquido: number; previsto: number }> = {};
    const add = (k: string) => (m[k] ??= { bruto: 0, liquido: 0, previsto: 0 });
    for (const r of rows) {
      if (r.status === "pago" && r.paid_date) { const x = add(r.paid_date.slice(0, 7)); x.bruto += Number(r.gross_amount); x.liquido += Number(r.net_amount ?? 0); }
      else if ((r.status === "previsto" || r.status === "em_aberto") && r.due_date) add(r.due_date.slice(0, 7)).previsto += Number(r.gross_amount);
    }
    return Object.entries(m).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => ({ mes: monthLabel(k), ...v }));
  }, [rows]);

  const sel = (key: keyof typeof f, placeholder: string, opts: [string, string][]) => (
    <Select value={f[key] as string} onValueChange={(v) => setF((p) => ({ ...p, [key]: v }))}>
      <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent><SelectItem value={ALL}>{placeholder}</SelectItem>{opts.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
    </Select>
  );

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h1 className="text-2xl font-bold">Recebimentos</h1>
          <Button size="sm" onClick={() => setAdding(true)}><Plus className="h-4 w-4 mr-1" />Adicionar recebimento</Button>
        </div>
        <Tabs defaultValue="lancamentos">
          <TabsList><TabsTrigger value="lancamentos">Lançamentos</TabsTrigger><TabsTrigger value="saldos">Saldos por projeto</TabsTrigger><TabsTrigger value="mes">Por mês</TabsTrigger></TabsList>

          <TabsContent value="lancamentos" className="space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <Input className="h-9 w-[220px]" placeholder="Buscar texto ou NF" value={f.q} onChange={(e) => setF((p) => ({ ...p, q: e.target.value }))} />
              {sel("month", "Todos os meses", months.filter(Boolean).map((m) => [m, monthLabel(m)]))}
              {sel("status", "Todos os status", (Object.keys(STATUS_LABEL) as DisplayStatus[]).map((s) => [s, STATUS_LABEL[s]]))}
              {sel("client", "Todos os clientes", clients.map((c) => [c, c]))}
              {sel("project", "Todos os projetos", projects.map((p) => [p.id, p.name]))}
              {sel("source", "Todas as origens", [["manual", "Manual"], ["planilha_nf_2026", "Planilha NF 2026"]])}
              <div className="flex items-center gap-2"><Switch checked={f.review} onCheckedChange={(v) => setF((p) => ({ ...p, review: v }))} /><Label>Precisa conferir</Label></div>
              <Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1" />Exportar CSV</Button>
            </div>
            <p className="text-sm text-muted-foreground">{filtered.length} linhas · Bruto <b className="text-foreground">{formatBRL(sum.g)}</b> · Líquido <b className="text-foreground">{formatBRL(sum.n)}</b></p>
            <Card><CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Projeto</TableHead><TableHead>Descrição</TableHead><TableHead>NF</TableHead><TableHead className="text-right">Bruto</TableHead><TableHead className="text-right">Líquido</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {loading ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Carregando…</TableCell></TableRow>
                  : filtered.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Nenhum lançamento.</TableCell></TableRow>
                  : filtered.map((r, i) => {
                    const p = projById[r.project_id]; const split = splitLabel(r, rows);
                    const grouped = !!r.invoice_group && (filtered[i - 1]?.invoice_group === r.invoice_group || filtered[i + 1]?.invoice_group === r.invoice_group);
                    const first = grouped && filtered[i - 1]?.invoice_group !== r.invoice_group;
                    return (
                      <TableRow key={r.id} className={cn(grouped && "bg-muted/40", grouped && !first && "border-t-0")}>
                        <TableCell className={cn("whitespace-nowrap text-xs", grouped && "border-l-2 border-accent")}>{r.paid_date ? formatDateBR(r.paid_date) : r.due_date ? `Venc. ${formatDateBR(r.due_date)}` : "—"}</TableCell>
                        <TableCell className="text-sm"><Link className="hover:underline" to={`/projetos/${r.project_id}`}>{p?.name ?? "—"}</Link><div className="text-[11px] text-muted-foreground">{p?.client}</div></TableCell>
                        <TableCell className="text-sm max-w-sm">
                          <div className="flex gap-1">{r.needs_review && <Tooltip><TooltipTrigger asChild><AlertTriangle className="h-4 w-4 shrink-0 text-warning" /></TooltipTrigger><TooltipContent>{r.review_note || "Precisa conferir"}</TooltipContent></Tooltip>}<span className="line-clamp-2">{r.description}</span></div>
                          {split && <Tooltip><TooltipTrigger asChild><span className="text-[11px] text-muted-foreground underline decoration-dotted cursor-help">{split}</span></TooltipTrigger><TooltipContent>Mesma cobrança dividida entre disciplinas</TooltipContent></Tooltip>}
                        </TableCell>
                        <TableCell className="text-xs">{r.invoice_number || "—"}</TableCell>
                        <TableCell className="text-right tabular-nums text-sm">{formatBRL(Number(r.gross_amount))}</TableCell>
                        <TableCell className="text-right tabular-nums text-sm">{r.net_amount != null ? formatBRL(Number(r.net_amount)) : "—"}</TableCell>
                        <TableCell><ReceiptStatusBadge status={displayStatus(r)} /></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="saldos" className="space-y-3">
            <div className="flex items-center gap-2"><Switch checked={onlyNoSale} onCheckedChange={setOnlyNoSale} /><Label>Só sem valor de venda</Label></div>
            <Card><CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Projeto</TableHead><TableHead>Cliente</TableHead><TableHead className="text-right">Venda</TableHead><TableHead className="text-right">Recebido</TableHead><TableHead className="text-right">Em aberto</TableHead><TableHead className="text-right">Vencido</TableHead><TableHead className="text-right">Previsto</TableHead><TableHead className="text-right">Saldo</TableHead><TableHead className="w-32">% recebido</TableHead></TableRow></TableHeader>
                <TableBody>
                  {balances.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="text-sm"><Link className="hover:underline" to={`/projetos/${b.id}`}>{b.p?.name ?? "—"}</Link></TableCell>
                      <TableCell className="text-xs">{b.p?.client}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{b.sem_valor_venda ? <span className="text-warning">sem valor</span> : formatBRL(b.sale_value ?? 0)}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{formatBRL(b.recebido_bruto)}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{formatBRL(b.em_aberto)}</TableCell>
                      <TableCell className={cn("text-right tabular-nums text-sm", b.vencido > 0 && "text-destructive font-medium")}>{formatBRL(b.vencido)}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{formatBRL(b.previsto)}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm font-medium">{b.sem_valor_venda ? "—" : formatBRL(b.saldo_a_receber)}</TableCell>
                      <TableCell>{b.sem_valor_venda ? "—" : <div className="flex items-center gap-2"><Progress value={b.pct} className="h-2" /><span className="text-xs tabular-nums">{b.pct.toFixed(0)}%</span></div>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="mes" className="space-y-3">
            <Card><CardHeader><CardTitle className="text-base">Recebido e previsto por mês</CardTitle></CardHeader><CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byMonth}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="mes" fontSize={11} /><YAxis fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <RTooltip formatter={(v: number) => formatBRL(v)} /><Legend />
                  <Bar dataKey="bruto" name="Recebido bruto" fill="hsl(var(--accent))" />
                  <Bar dataKey="liquido" name="Recebido líquido" fill="hsl(var(--success))" />
                  <Bar dataKey="previsto" name="Previsto" fill="hsl(var(--muted-foreground))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent></Card>
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Mês</TableHead><TableHead className="text-right">Recebido bruto</TableHead><TableHead className="text-right">Recebido líquido</TableHead><TableHead className="text-right">Previsto</TableHead></TableRow></TableHeader>
                <TableBody>{byMonth.map((m) => (
                  <TableRow key={m.mes}><TableCell>{m.mes}</TableCell><TableCell className="text-right tabular-nums">{formatBRL(m.bruto)}</TableCell><TableCell className="text-right tabular-nums">{formatBRL(m.liquido)}</TableCell><TableCell className="text-right tabular-nums">{formatBRL(m.previsto)}</TableCell></TableRow>
                ))}</TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
      <ReceiptDialog open={adding} onOpenChange={setAdding} receipt={null} userId={profile?.id} onSaved={load} projects={projects} />
    </AppLayout>
  );
}
