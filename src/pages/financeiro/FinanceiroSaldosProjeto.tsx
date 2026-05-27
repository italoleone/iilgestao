import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronRight, ChevronDown, Wallet, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ProjectRow {
  id: string;
  name: string;
  client: string;
  sale_value: number;
  status: string;
}

interface ReceivableRow {
  id: string;
  project_id: string | null;
  client_name: string;
  description: string;
  amount: number;
  due_date: string;
  received_date: string | null;
  status: string;
  nf_number: string | null;
  installment_number: string | null;
}

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDateBR = (dateStr: string | null | undefined) => {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return "—";
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR");
};

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  recebido: "Recebido",
  atrasado: "Atrasado",
  cancelado: "Cancelado",
};

const STATUS_COLOR: Record<string, string> = {
  pendente: "bg-yellow-100 text-yellow-700 border-yellow-200",
  recebido: "bg-green-100 text-green-700 border-green-200",
  atrasado: "bg-red-100 text-red-700 border-red-200",
  cancelado: "bg-slate-100 text-slate-600 border-slate-200",
};

export default function FinanceiroSaldosProjeto() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [receivables, setReceivables] = useState<ReceivableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const [projRes, finRes, recRes] = await Promise.all([
        supabase
          .from("projects")
          .select("id, name, client, status")
          .order("name"),
        supabase.from("project_financials").select("project_id, sale_value"),
        supabase.from("receivables").select("*").order("due_date"),
      ]);
      if (projRes.data) {
        const finMap = new Map<string, number>();
        (finRes.data || []).forEach((f: any) => finMap.set(f.project_id, Number(f.sale_value) || 0));
        const merged: ProjectRow[] = (projRes.data as any[]).map((p) => ({
          id: p.id,
          name: p.name,
          client: p.client,
          status: p.status,
          sale_value: finMap.get(p.id) || 0,
        }));
        setProjects(merged);
      }
      if (recRes.data) setReceivables(recRes.data as ReceivableRow[]);
      setLoading(false);
    };
    fetchAll();
  }, []);

  const rows = useMemo(() => {
    return projects.map((p) => {
      const projReceivables = receivables.filter((r) => r.project_id === p.id);
      const jaFaturado = projReceivables
        .filter((r) => r.status !== "cancelado")
        .reduce((sum, r) => sum + Number(r.amount || 0), 0);
      const saldo = Number(p.sale_value || 0) - jaFaturado;
      return { project: p, receivables: projReceivables, jaFaturado, saldo };
    });
  }, [projects, receivables]);

  const totals = useMemo(() => {
    const contratado = rows.reduce(
      (s, r) => s + Number(r.project.sale_value || 0),
      0,
    );
    const faturado = rows.reduce((s, r) => s + r.jaFaturado, 0);
    return { contratado, faturado, saldo: contratado - faturado };
  }, [rows]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Saldos de Projeto
            </h1>
            <p className="text-sm text-muted-foreground">
              Acompanhe o valor contratado, faturado e saldo a faturar de cada projeto
            </p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Contratado</p>
              <p className="text-2xl font-semibold tabular-nums mt-1">
                {formatCurrency(totals.contratado)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Faturado</p>
              <p className="text-2xl font-semibold tabular-nums mt-1 text-green-600">
                {formatCurrency(totals.faturado)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Saldo a Faturar</p>
              <p
                className={`text-2xl font-semibold tabular-nums mt-1 ${
                  totals.saldo > 0 ? "text-blue-600" : "text-muted-foreground"
                }`}
              >
                {formatCurrency(totals.saldo)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : rows.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                Nenhum projeto encontrado.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Projeto</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Valor Contratado</TableHead>
                    <TableHead className="text-right">Já Faturado</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const isOpen = expanded.has(row.project.id);
                    return (
                      <>
                        <TableRow
                          key={row.project.id}
                          className="cursor-pointer"
                          onClick={() => toggle(row.project.id)}
                        >
                          <TableCell>
                            {isOpen ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            {row.project.name}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {row.project.client}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(Number(row.project.sale_value || 0))}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-green-600">
                            {formatCurrency(row.jaFaturado)}
                          </TableCell>
                          <TableCell
                            className={`text-right tabular-nums font-medium ${
                              row.saldo > 0
                                ? "text-blue-600"
                                : row.saldo < 0
                                  ? "text-red-600"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {formatCurrency(row.saldo)}
                          </TableCell>
                        </TableRow>
                        {isOpen && (
                          <TableRow
                            key={row.project.id + "-detail"}
                            className="bg-muted/30 hover:bg-muted/30"
                          >
                            <TableCell colSpan={6} className="p-0">
                              <div className="p-4">
                                {row.receivables.length === 0 ? (
                                  <p className="text-sm text-muted-foreground py-4 text-center">
                                    Nenhuma cobrança lançada para este projeto.
                                  </p>
                                ) : (
                                  <div className="rounded-md border bg-card">
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>NF</TableHead>
                                          <TableHead>Parcela</TableHead>
                                          <TableHead className="text-right">
                                            Valor
                                          </TableHead>
                                          <TableHead>Vencimento</TableHead>
                                          <TableHead>Recebimento</TableHead>
                                          <TableHead>Status</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {row.receivables.map((r) => (
                                          <TableRow key={r.id}>
                                            <TableCell className="tabular-nums">
                                              {r.nf_number || "—"}
                                            </TableCell>
                                            <TableCell className="tabular-nums">
                                              {r.installment_number || "—"}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                              {formatCurrency(Number(r.amount || 0))}
                                            </TableCell>
                                            <TableCell className="tabular-nums text-muted-foreground">
                                              {formatDateBR(r.due_date)}
                                            </TableCell>
                                            <TableCell className="tabular-nums text-muted-foreground">
                                              {formatDateBR(r.received_date)}
                                            </TableCell>
                                            <TableCell>
                                              <Badge
                                                variant="outline"
                                                className={
                                                  STATUS_COLOR[r.status] ||
                                                  "bg-slate-100 text-slate-600 border-slate-200"
                                                }
                                              >
                                                {STATUS_LABEL[r.status] || r.status}
                                              </Badge>
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
