import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { FolderOpen, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAll";
import { cn } from "@/lib/utils";
import type { Mention } from "@/lib/mentions";

type Option = Mention & { hint?: string };
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const ACTIVE = ["ativo", "em_andamento"];

/** Finds an open "@query" right before the caret (start of text or after whitespace). */
export function activeMentionQuery(text: string, caret: number) {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf("@");
  if (at < 0 || (at > 0 && !/\s/.test(before[at - 1]))) return null;
  const query = before.slice(at + 1);
  if (query.includes("\n") || query.length > 40) return null;
  return { start: at, query };
}

export function useMentionOptions(enabled: boolean) {
  return useQuery({
    queryKey: ["mention-options"], enabled, staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [projects, people] = await Promise.all([
        fetchAllRows<{ id: string; name: string; status: string }>(() => supabase.from("projects").select("id,name,status")),
        fetchAllRows<{ id: string; name: string }>(() => supabase.from("profiles").select("id,name").eq("status", "active")),
      ]);
      return { projects, people };
    },
  });
}

export function filterMentionOptions(data: { projects: { id: string; name: string; status: string }[]; people: { id: string; name: string }[] } | undefined, query: string, selfId?: string) {
  const q = norm(query.trim());
  const projects: Option[] = (data?.projects ?? []).filter(p => !q || norm(p.name).includes(q))
    .sort((a, b) => Number(ACTIVE.includes(b.status)) - Number(ACTIVE.includes(a.status)) || a.name.localeCompare(b.name, "pt-BR", { numeric: true }))
    .slice(0, 8).map(p => ({ type: "p", id: p.id, name: p.name }));
  const people: Option[] = (data?.people ?? []).filter(p => p.id !== selfId && p.name.trim() && (!q || norm(p.name).includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")).slice(0, 8).map(p => ({ type: "u", id: p.id, name: p.name }));
  return [...projects, ...people];
}

export function MentionPicker({ options, highlighted, onPick, onHover }: { options: Option[]; highlighted: number; onPick: (o: Option) => void; onHover: (i: number) => void }) {
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => { list.current?.querySelector(`[data-index="${highlighted}"]`)?.scrollIntoView({ block: "nearest" }); }, [highlighted]);
  const sections = useMemo(() => [
    { label: "Projetos", items: options.map((o, i) => ({ o, i })).filter(x => x.o.type === "p") },
    { label: "Pessoas", items: options.map((o, i) => ({ o, i })).filter(x => x.o.type === "u") },
  ], [options]);
  return <div ref={list} role="listbox" aria-label="Mencionar projeto ou pessoa" className="absolute bottom-full left-3 right-3 mb-2 max-h-64 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-lg">
    {options.length === 0 && <p className="px-2 py-3 text-center text-xs text-muted-foreground">Nenhum projeto ou pessoa encontrado.</p>}
    {sections.map(s => s.items.length > 0 && <div key={s.label}>
      <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{s.label}</p>
      {s.items.map(({ o, i }) => <button key={o.type + o.id} type="button" role="option" aria-selected={i === highlighted} data-index={i}
        onMouseDown={e => e.preventDefault()} onMouseEnter={() => onHover(i)} onClick={() => onPick(o)}
        className={cn("flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm", i === highlighted && "bg-accent/30")}>
        {o.type === "p" ? <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
        <span className="line-clamp-2 break-words">{o.name}</span>
      </button>)}
    </div>)}
  </div>;
}
