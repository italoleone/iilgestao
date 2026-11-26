import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { AuditRow, TABLE_LABELS, describeChanges, formatAuditDate, recordTitle } from "@/lib/audit";

interface Props {
  sources: { tableName: string; recordIds: string[] }[];
  showRecordLabel?: boolean;
}

const PAGE = 200;

export function HistoryTimeline({ sources, showRecordLabel }: Props) {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(PAGE);
  const [hasMore, setHasMore] = useState(false);
  const key = JSON.stringify(sources);

  useEffect(() => {
    supabase.from("profiles").select("id, name").then(({ data }) => {
      setNames(new Map((data ?? []).map((p: any) => [p.id, p.name])));
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const valid = sources.filter((s) => s.recordIds.length > 0);
      if (valid.length === 0) { setRows([]); setLoading(false); return; }
      // Batch ids to avoid overly long URLs
      const results: AuditRow[] = [];
      let more = false;
      for (const s of valid) {
        for (let i = 0; i < s.recordIds.length; i += 150) {
          const chunk = s.recordIds.slice(i, i + 150);
          const { data } = await supabase
            .from("audit_log")
            .select("*")
            .eq("table_name", s.tableName)
            .in("record_id", chunk)
            .order("changed_at", { ascending: false })
            .limit(limit + 1);
          const list = (data ?? []) as AuditRow[];
          if (list.length > limit) more = true;
          results.push(...list.slice(0, limit));
        }
      }
      results.sort((a, b) => b.changed_at.localeCompare(a.changed_at));
      if (results.length > limit) more = true;
      if (!cancelled) {
        setRows(results.slice(0, limit));
        setHasMore(more);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, limit]);

  const visible = useMemo(() => rows.map((r) => ({ r, changes: describeChanges(r, names) })).filter((x) => x.changes.length > 0), [rows, names]);

  if (loading && rows.length === 0) {
    return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }
  if (visible.length === 0) return <p className="text-sm text-muted-foreground">Nenhuma alteração registrada.</p>;

  return <HistoryList items={visible} showRecordLabel={showRecordLabel} hasMore={hasMore} onMore={() => setLimit((l) => l + PAGE)} />;
}

export function HistoryList({ items, showRecordLabel, hasMore, onMore }: {
  items: { r: AuditRow; changes: string[] }[];
  showRecordLabel?: boolean;
  hasMore?: boolean;
  onMore?: () => void;
}) {
  return (
    <div className="space-y-3">
      <ol className="relative border-l border-border ml-2 space-y-4">
        {items.map(({ r, changes }) => {
          const title = recordTitle(r);
          return (
            <li key={r.id} className="ml-4">
              <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-background bg-primary" />
              <p className="text-xs text-muted-foreground">
                {formatAuditDate(r.changed_at)} · <span className="font-medium text-foreground">{r.changed_by_name || "Sistema"}</span>
                {showRecordLabel && (
                  <> · {TABLE_LABELS[r.table_name] || r.table_name}{title ? `: ${title}` : ""}</>
                )}
              </p>
              <ul className="mt-1 text-sm space-y-0.5">
                {changes.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </li>
          );
        })}
      </ol>
      {hasMore && onMore && (
        <Button variant="outline" size="sm" onClick={onMore}>Ver mais</Button>
      )}
    </div>
  );
}
