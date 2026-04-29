import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const MONTHS = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

const DISCIPLINES = ["Estrutural", "Hidráulica", "Elétrica", "Fundações"];

const disciplineColor = (d: string) => {
  const k = (d || "").toLowerCase();
  if (k.includes("estrut")) return "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30";
  if (k.includes("hidr"))   return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
  if (k.includes("elétr") || k.includes("eletr")) return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
  if (k.includes("funda"))  return "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30";
  return "bg-muted text-muted-foreground border-border";
};

interface Entry {
  id: string;
  source: "proposal" | "project";
  project_id: string;
  project_name: string;
  stage_label: string;
  discipline: string; // best-effort
  execution_month: number;
  execution_year: number;
  status: string;
  amount: number;
}

export default function Cronograma() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [discipline, setDiscipline] = useState<string>("todas");
  const [statusFilter, setStatusFilter] = useState<string>("todos");

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["cronograma-entries"],
    queryFn: async (): Promise<Entry[]> => {
      // 1) Load all projects (id, name)
      const { data: projects, error: pErr } = await supabase
        .from("projects")
        .select("id, name");
      if (pErr) throw pErr;

      // 2) Load proposals linked to projects to map project_id -> proposal_id
      const { data: proposals, error: prErr } = await supabase
        .from("commercial_proposals")
        .select("id, linked_project_id")
        .not("linked_project_id", "is", null);
      if (prErr) throw prErr;

      const proposalByProject = new Map<string, string>();
      const projectByProposal = new Map<string, string>();
      for (const pr of proposals ?? []) {
        if (pr.linked_project_id) {
          proposalByProject.set(pr.linked_project_id as string, pr.id);
          projectByProposal.set(pr.id, pr.linked_project_id as string);
        }
      }

      const projectName = new Map<string, string>();
      for (const p of projects ?? []) projectName.set(p.id as string, p.name as string);

      // 3) Fetch proposal_billing_schedule for linked proposals
      const proposalIds = Array.from(projectByProposal.keys());
      const { data: pbs, error: pbsErr } = proposalIds.length
        ? await supabase
            .from("proposal_billing_schedule")
            .select("*")
            .in("proposal_id", proposalIds)
        : { data: [], error: null as any };
      if (pbsErr) throw pbsErr;

      // 4) Fetch project_billing_schedule for projects without a linked proposal
      const projectsWithProposal = new Set(proposalByProject.keys());
      const projectsWithoutProposal = (projects ?? [])
        .map((p) => p.id as string)
        .filter((id) => !projectsWithProposal.has(id));
      const { data: prjbs, error: prjbsErr } = projectsWithoutProposal.length
        ? await supabase
            .from("project_billing_schedule")
            .select("*")
            .in("project_id", projectsWithoutProposal)
        : { data: [], error: null as any };
      if (prjbsErr) throw prjbsErr;

      const out: Entry[] = [];
      for (const r of (pbs ?? []) as any[]) {
        if (!r.execution_month || !r.execution_year) continue;
        const projId = projectByProposal.get(r.proposal_id) ?? "";
        out.push({
          id: r.id,
          source: "proposal",
          project_id: projId,
          project_name: projectName.get(projId) ?? "Projeto",
          stage_label: r.stage_label,
          discipline: r.discipline_label || "",
          execution_month: r.execution_month,
          execution_year: r.execution_year,
          status: r.status,
          amount: Number(r.amount || 0),
        });
      }
      for (const r of (prjbs ?? []) as any[]) {
        if (!r.execution_month || !r.execution_year) continue;
        out.push({
          id: r.id,
          source: "project",
          project_id: r.project_id,
          project_name: projectName.get(r.project_id) ?? "Projeto",
          stage_label: r.stage_label,
          discipline: "",
          execution_month: r.execution_month,
          execution_year: r.execution_year,
          status: r.status,
          amount: Number(r.amount || 0),
        });
      }
      return out;
    },
  });

  const toggleStatus = useMutation({
    mutationFn: async (e: Entry) => {
      const isDone = e.status === "executado";
      const next = isDone ? "pendente" : "executado";
      const table = e.source === "proposal" ? "proposal_billing_schedule" : "project_billing_schedule";
      const { error } = await supabase.from(table).update({ status: next }).eq("id", e.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cronograma-entries"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (e.execution_year !== year) return false;
      if (discipline !== "todas") {
        const k = (e.discipline || "").toLowerCase();
        if (!k.includes(discipline.toLowerCase().slice(0, 5))) return false;
      }
      if (statusFilter !== "todos") {
        const isDone = e.status === "executado";
        if (statusFilter === "executado" && !isDone) return false;
        if (statusFilter === "pendente" && isDone) return false;
      }
      return true;
    });
  }, [entries, year, discipline, statusFilter]);

  const byMonth = useMemo(() => {
    const map: Record<number, Entry[]> = {};
    for (let i = 1; i <= 12; i++) map[i] = [];
    for (const e of filtered) map[e.execution_month]?.push(e);
    return map;
  }, [filtered]);

  const today = new Date();
  const curM = today.getMonth() + 1;
  const curY = today.getFullYear();
  const cardBorder = (e: Entry) => {
    const isDone = e.status === "executado";
    if (isDone) return "border-l-emerald-500";
    const rank = e.execution_year * 12 + e.execution_month;
    const cur = curY * 12 + curM;
    if (rank < cur) return "border-l-red-500";
    if (rank === cur) return "border-l-amber-500";
    return "border-l-muted-foreground/30";
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
        <div className="flex items-center gap-3">
          <CalendarRange className="h-6 w-6 text-accent" />
          <h1 className="text-2xl font-bold">Cronograma de Execução</h1>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <Select value={discipline} onValueChange={setDiscipline}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Disciplina" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as disciplinas</SelectItem>
              {DISCIPLINES.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="executado">Executado</SelectItem>
            </SelectContent>
          </Select>

          <div className="ml-auto flex items-center gap-2">
            <Button size="icon" variant="outline" onClick={() => setYear((y) => y - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-lg font-semibold tabular-nums w-16 text-center">{year}</div>
            <Button size="icon" variant="outline" onClick={() => setYear((y) => y + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Months horizontal */}
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {MONTHS.map((m, idx) => {
              const month = idx + 1;
              const list = byMonth[month] ?? [];
              const isCurrent = month === curM && year === curY;
              return (
                <div key={m} className="w-[260px] shrink-0">
                  <div className={cn(
                    "px-3 py-2 rounded-t-lg text-sm font-semibold border-b-2",
                    isCurrent ? "bg-accent/10 border-accent text-accent-foreground" : "bg-muted border-border",
                  )}>
                    {m}
                    <span className="ml-2 text-xs text-muted-foreground font-normal">({list.length})</span>
                  </div>
                  <div className="space-y-2 p-2 min-h-[200px] bg-card/30 rounded-b-lg">
                    {list.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic text-center py-6">
                        Nenhuma entrega prevista
                      </p>
                    ) : (
                      list.map((e) => {
                        const isDone = e.status === "executado";
                        return (
                          <div
                            key={`${e.source}-${e.id}`}
                            className={cn(
                              "rounded-lg border-2 bg-card p-3 space-y-2 shadow-sm transition-all hover:shadow-md",
                              cardBorder(e),
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => navigate(`/projetos/${e.project_id}`)}
                              className="text-sm font-semibold hover:underline text-left w-full truncate"
                              title={e.project_name}
                            >
                              {e.project_name}
                            </button>
                            {e.discipline && (
                              <Badge variant="outline" className={cn("text-[10px]", disciplineColor(e.discipline))}>
                                {e.discipline}
                              </Badge>
                            )}
                            <div className="text-xs text-muted-foreground">{e.stage_label}</div>
                            <button
                              type="button"
                              onClick={() => toggleStatus.mutate(e)}
                              className="w-full"
                            >
                              <Badge
                                className={cn(
                                  "w-full justify-center cursor-pointer transition-colors",
                                  isDone
                                    ? "bg-emerald-500 text-white hover:bg-emerald-600"
                                    : "bg-muted text-muted-foreground hover:bg-muted/80",
                                )}
                              >
                                {isDone ? "Executado" : "Pendente"}
                              </Badge>
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      </div>
    </AppLayout>
  );
}
