import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { HistoryList } from "@/components/HistoryTimeline";
import { AuditRow, TABLE_GROUPS, describeChanges } from "@/lib/audit";

const PAGE = 200;

function isoDaysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function Historico() {
  const [from, setFrom] = useState(isoDaysAgo(7));
  const [to, setTo] = useState(isoDaysAgo(0));
  const [person, setPerson] = useState("all");
  const [group, setGroup] = useState("all");
  const [limit, setLimit] = useState(PAGE);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    supabase.from("profiles").select("id, name").order("name").then(({ data }) => setPeople((data ?? []) as any));
  }, []);

  useEffect(() => { setLimit(PAGE); }, [from, to, person, group]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let q = supabase.from("audit_log").select("*").order("changed_at", { ascending: false }).limit(limit + 1);
      // Período em horário de Brasília (UTC-3)
      if (from) q = q.gte("changed_at", `${from}T00:00:00-03:00`);
      if (to) q = q.lte("changed_at", `${to}T23:59:59.999-03:00`);
      if (person !== "all") q = q.eq("changed_by", person);
      if (group !== "all") q = q.in("table_name", TABLE_GROUPS[group]);
      const { data } = await q;
      if (cancelled) return;
      const list = (data ?? []) as AuditRow[];
      setHasMore(list.length > limit);
      setRows(list.slice(0, limit));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [from, to, person, group, limit]);

  const names = useMemo(() => new Map(people.map((p) => [p.id, p.name])), [people]);
  const items = useMemo(() => rows.map((r) => ({ r, changes: describeChanges(r, names) })).filter((x) => x.changes.length > 0), [rows, names]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Histórico</h1>
          <p className="text-sm text-muted-foreground">Todas as alterações registradas no sistema.</p>
        </div>
        <Card>
          <CardContent className="pt-4 grid gap-4 sm:grid-cols-4">
            <div className="space-y-1"><Label>De</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="space-y-1"><Label>Até</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            <div className="space-y-1">
              <Label>Pessoa</Label>
              <Select value={person} onValueChange={setPerson}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {people.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Tipo de registro</Label>
              <Select value={group} onValueChange={setGroup}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.keys(TABLE_GROUPS).map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            {loading && rows.length === 0 ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma alteração no período.</p>
            ) : (
              <HistoryList items={items} showRecordLabel hasMore={hasMore} onMore={() => setLimit((l) => l + PAGE)} />
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
