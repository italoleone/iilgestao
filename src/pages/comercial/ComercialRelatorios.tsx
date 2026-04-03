import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCommercialProposals, PROPOSAL_STATUS_LABELS, type ProposalDisciplines } from "@/hooks/useCommercialData";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { DISCIPLINE_SHORT } from "@/types";

export default function ComercialRelatorios() {
  const { data: proposals = [] } = useCommercialProposals();
  const [period, setPeriod] = useState("all");

  const now = new Date();
  const filtered = proposals.filter((p) => {
    if (period === "all") return true;
    const d = new Date(p.proposal_date);
    if (period === "month") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (period === "quarter") {
      const q = Math.floor(now.getMonth() / 3);
      return Math.floor(d.getMonth() / 3) === q && d.getFullYear() === now.getFullYear();
    }
    if (period === "year") return d.getFullYear() === now.getFullYear();
    return true;
  });

  const approved = filtered.filter((p) => p.status === "aprovada");
  const total = filtered.length;
  const convRate = total > 0 ? ((approved.length / total) * 100).toFixed(1) : "0";

  // Use final values for approved proposals
  const getApprovedValue = (p: any) => (p.final_total_value > 0 ? p.final_total_value : p.total_value);

  const clientRevenue = new Map<string, number>();
  approved.forEach((p) => {
    const name = p.client?.name || "Desconhecido";
    clientRevenue.set(name, (clientRevenue.get(name) || 0) + getApprovedValue(p));
  });
  const clientData = Array.from(clientRevenue.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const discRevenue = { estrutural: 0, hidraulica: 0, eletrica: 0 };
  approved.forEach((p) => {
    const fd = (p.final_disciplines || {}) as ProposalDisciplines;
    const d = p.disciplines as ProposalDisciplines;
    if (fd.estrutural || d.estrutural) discRevenue.estrutural += (fd.estrutural || d.estrutural || 0);
    if (fd.hidraulica || d.hidraulica) discRevenue.hidraulica += (fd.hidraulica || d.hidraulica || 0);
    if (fd.eletrica || d.eletrica) discRevenue.eletrica += (fd.eletrica || d.eletrica || 0);
  });
  const discData = Object.entries(discRevenue).map(([k, v]) => ({
    name: DISCIPLINE_SHORT[k as keyof typeof DISCIPLINE_SHORT] || k,
    value: v,
  }));

  const totalM2 = approved.reduce((s, p) => s + p.area_m2, 0);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Relatórios Comerciais</h1>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo período</SelectItem>
              <SelectItem value="month">Este mês</SelectItem>
              <SelectItem value="quarter">Este trimestre</SelectItem>
              <SelectItem value="year">Este ano</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Propostas</p><p className="text-xl font-bold">{total}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Aprovadas</p><p className="text-xl font-bold">{approved.length}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Taxa de Conversão</p><p className="text-xl font-bold">{convRate}%</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">m² Vendidos</p><p className="text-xl font-bold">{totalM2.toLocaleString("pt-BR")}</p></CardContent></Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Receita por Cliente</CardTitle></CardHeader>
            <CardContent>
              {clientData.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem dados</p>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={clientData.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Receita por Disciplina</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={discData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="value" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Propostas no Período</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Projeto</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Área (m²)</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 50).map((p) => {
                  const displayVal = p.status === "aprovada" && p.final_total_value > 0 ? p.final_total_value : p.total_value;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.project_name}</TableCell>
                      <TableCell>{p.client?.name || "—"}</TableCell>
                      <TableCell>{p.area_m2}</TableCell>
                      <TableCell>{fmt(displayVal)}</TableCell>
                      <TableCell>{PROPOSAL_STATUS_LABELS[p.status]}</TableCell>
                      <TableCell>{new Date(p.proposal_date).toLocaleDateString("pt-BR")}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
