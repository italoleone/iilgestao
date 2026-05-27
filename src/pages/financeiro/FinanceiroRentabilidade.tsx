import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useRentabilidadePorProjeto, RentabilidadeRow } from "@/hooks/useFinanceiroData";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

const margemColor = (pct: number) => pct > 40 ? "text-emerald-400" : pct >= 20 ? "text-yellow-400" : "text-red-400";
const margemBg = (pct: number) => pct > 40 ? "bg-emerald-500/20 text-emerald-400" : pct >= 20 ? "bg-yellow-500/20 text-yellow-400" : "bg-red-500/20 text-red-400";

const now = new Date();

type SortField = "projectName" | "receita" | "custoReal" | "margemRs" | "margemPct" | "horasVendidas" | "horasGastas" | "eficiencia";

export default function FinanceiroRentabilidade() {
  const [discipline, setDiscipline] = useState("");
  const [sortField, setSortField] = useState<SortField>("margemPct");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const filters = useMemo(() => ({ discipline: discipline || undefined }), [discipline]);
  const { data: rows = [], isLoading } = useRentabilidadePorProjeto(filters);

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [rows, sortField, sortDir]);

  // KPIs
  const margemMedia = rows.length > 0 ? rows.reduce((s, r) => s + r.margemPct, 0) / rows.length : 0;
  const maisRentavel = rows.length > 0 ? rows.reduce((a, b) => a.margemPct > b.margemPct ? a : b) : null;
  const menosRentavel = rows.length > 0 ? rows.reduce((a, b) => a.margemPct < b.margemPct ? a : b) : null;
  const eficienciaMedia = rows.length > 0 ? rows.filter(r => r.horasGastas > 0).reduce((s, r) => s + r.eficiencia, 0) / (rows.filter(r => r.horasGastas > 0).length || 1) : 0;

  // Top 10 chart
  const chartData = useMemo(() =>
    [...rows].sort((a, b) => b.margemRs - a.margemRs).slice(0, 10).map(r => ({
      name: r.projectName.length > 20 ? r.projectName.slice(0, 20) + "…" : r.projectName,
      margem: r.margemRs,
    })), [rows]);

  const SortHeader = ({ field, children, className }: { field: SortField; children: React.ReactNode; className?: string }) => {
    const active = sortField === field;
    const arrow = active ? (sortDir === "asc" ? " ↑" : " ↓") : " ↕";
    return (
      <TableHead
        className={cn("cursor-pointer select-none hover:text-foreground transition-colors whitespace-nowrap", active ? "text-foreground" : "text-muted-foreground", className)}
        onClick={() => handleSort(field)}
      >
        {children}
        <span className={cn("ml-1 text-xs", active ? "opacity-100" : "opacity-30")}>{arrow}</span>
      </TableHead>
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        <h1 className="text-2xl font-bold">Rentabilidade por Projeto</h1>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Margem Média</p><p className={cn("text-xl font-bold mt-1", margemColor(margemMedia))}>{fmtPct(margemMedia)}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Mais Rentável</p><p className="text-sm font-bold mt-1 truncate">{maisRentavel?.projectName || "—"}</p><p className="text-xs text-emerald-400">{maisRentavel ? fmtPct(maisRentavel.margemPct) : ""}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Menos Rentável</p><p className="text-sm font-bold mt-1 truncate">{menosRentavel?.projectName || "—"}</p><p className="text-xs text-red-400">{menosRentavel ? fmtPct(menosRentavel.margemPct) : ""}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Eficiência Média</p><p className="text-xl font-bold mt-1 text-accent">{fmtPct(eficienciaMedia)}</p></CardContent></Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-end">
          <div><Label className="text-xs">Mês</Label><Select value={String(month)} onValueChange={v => setMonth(Number(v))}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 12 }, (_, i) => <SelectItem key={i} value={String(i)}>{format(new Date(2024, i), "MMMM")}</SelectItem>)}</SelectContent></Select></div>
          <div><Label className="text-xs">Ano</Label><Select value={String(year)} onValueChange={v => setYear(Number(v))}><SelectTrigger className="w-24"><SelectValue /></SelectTrigger><SelectContent>{[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select></div>
          <div><Label className="text-xs">Disciplina</Label><Select value={discipline} onValueChange={setDiscipline}><SelectTrigger className="w-36"><SelectValue placeholder="Todas" /></SelectTrigger><SelectContent><SelectItem value="">Todas</SelectItem><SelectItem value="Estrutural">Estrutural</SelectItem><SelectItem value="Hidráulica">Hidráulica</SelectItem><SelectItem value="Elétrica">Elétrica</SelectItem><SelectItem value="Fundações">Fundações</SelectItem></SelectContent></Select></div>
        </div>

        {/* Chart */}
        {chartData.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Top 10 — Margem Absoluta (R$)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 120 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={v => fmt(v)} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} width={110} />
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <Bar dataKey="margem" name="Margem R$" fill="hsl(65, 80%, 45%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Projeto</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Disciplina</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">Custo Real</TableHead>
                  <TableHead className="text-right">Margem R$</TableHead>
                  <TableHead className="text-right">Margem %</TableHead>
                  <TableHead className="text-right">Hs Vend.</TableHead>
                  <TableHead className="text-right">Hs Gastas</TableHead>
                  <TableHead className="text-right">Eficiência</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">{isLoading ? "Carregando..." : "Nenhum projeto"}</TableCell></TableRow>}
                {rows.map(r => (
                  <TableRow key={r.projectId}>
                    <TableCell className="font-medium">{r.projectName}</TableCell>
                    <TableCell>{r.client}</TableCell>
                    <TableCell>{r.discipline}</TableCell>
                    <TableCell className="text-right">{fmt(r.receita)}</TableCell>
                    <TableCell className="text-right">{fmt(r.custoReal)}</TableCell>
                    <TableCell className={cn("text-right font-semibold", margemColor(r.margemPct))}>{fmt(r.margemRs)}</TableCell>
                    <TableCell className="text-right"><Badge className={margemBg(r.margemPct)}>{fmtPct(r.margemPct)}</Badge></TableCell>
                    <TableCell className="text-right">{r.horasVendidas}h</TableCell>
                    <TableCell className="text-right">{r.horasGastas}h</TableCell>
                    <TableCell className="text-right">{fmtPct(r.eficiencia)}</TableCell>
                    <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
