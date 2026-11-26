import { useState, useMemo } from "react";
import { formatDateBR } from "@/lib/utils";
import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NewProjectDialog } from "@/components/NewProjectDialog";
import { useProjects, useTasks, useActiveProfiles, getProfileById } from "@/hooks/useSupabaseData";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { canCreateProject } from "@/utils/permissions";
import { DISCIPLINE_SHORT, STATUS_LABELS, type Discipline, type ProjectStatus, type Project } from "@/types";
import { Search, Plus, ArrowUpDown, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const statusColors: Record<ProjectStatus, string> = {
  em_andamento: "bg-info text-info-foreground",
  concluido: "bg-success text-success-foreground",
  atrasado: "bg-destructive text-destructive-foreground",
  pausado: "bg-muted text-muted-foreground",
};

const disciplineColors: Record<Discipline, string> = {
  estrutural: "hsl(0, 0%, 25%)",
  hidraulica: "hsl(200, 60%, 40%)",
  eletrica: "hsl(64, 88%, 44%)",
};

type StatusFilter = "ativos" | "concluidos" | "pausados" | "todos";
const STATUS_FILTERS: { key: StatusFilter; label: string; match: (s: string) => boolean }[] = [
  { key: "ativos", label: "Ativos", match: (s) => s !== "concluido" },
  { key: "concluidos", label: "Concluídos", match: (s) => s === "concluido" },
  { key: "pausados", label: "Pausados", match: (s) => s === "pausado" },
  { key: "todos", label: "Todos", match: () => true },
];
const BULK_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "em_andamento", label: "Em andamento" },
  { value: "pausado", label: "Pausado" },
  { value: "concluido", label: "Concluído" },
];

type SortField = "name" | "client" | "discipline" | "deadline" | "status" | "progress";

export default function Projetos() {
  const navigate = useNavigate();
  const { isProjetista, profile } = useAuth();
  const canCreateProj = !!profile && canCreateProject(profile.role);
  const { projects, loading, refetch } = useProjects();
  const { profiles } = useActiveProfiles();
  const [search, setSearch] = useState("");
  const [filterDiscipline, setFilterDiscipline] = useState<Discipline | "all">("all");
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("ativos");
  const { tasks } = useTasks();
  const canBulk = profile?.role === "admin_geral" || profile?.role === "admin" || profile?.role === "planejamento";
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<ProjectStatus | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);

  // Projetos cujas tarefas estão todas entregues (concluida/enviado_cliente) e ainda não concluídos
  const suggestedIds = useMemo(() => {
    const byProject = new Map<string, { total: number; done: number }>();
    for (const t of tasks) {
      const cur = byProject.get(t.projectId) || { total: 0, done: 0 };
      cur.total++;
      if (t.status === "concluida" || t.status === "enviado_cliente") cur.done++;
      byProject.set(t.projectId, cur);
    }
    const set = new Set<string>();
    for (const p of projects) {
      const c = byProject.get(p.id);
      if (c && c.total > 0 && c.done === c.total && p.status !== "concluido") set.add(p.id);
    }
    return set;
  }, [tasks, projects]);

  const statusCounts = useMemo(() => {
    const m = {} as Record<StatusFilter, number>;
    STATUS_FILTERS.forEach(f => { m[f.key] = projects.filter(p => f.match(p.status)).length; });
    return m;
  }, [projects]);

  const toggleSelected = (id: string) => setSelected(prev => {
    const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n;
  });

  const applyBulk = async () => {
    if (!bulkStatus) return;
    const ids = Array.from(selected);
    setBulkSaving(true);
    const { data, error } = await supabase.from("projects").update({ status: bulkStatus }).in("id", ids).select("id");
    setBulkSaving(false);
    setBulkStatus(null);
    if (error) { toast.error("Erro ao alterar status: " + error.message); return; }
    const n = data?.length || 0;
    if (n < ids.length) toast.warning(`${n} de ${ids.length} projetos alterados. Os demais não puderam ser alterados.`);
    else toast.success(`${n} projeto${n === 1 ? "" : "s"} alterado${n === 1 ? "" : "s"}.`);
    setSelected(new Set());
    refetch();
  };
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  const filtered = useMemo(() => {
    let result = projects.filter((p) => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.client.toLowerCase().includes(search.toLowerCase());
      const matchDiscipline = filterDiscipline === "all" || p.discipline === filterDiscipline;
      const matchStatus = STATUS_FILTERS.find(f => f.key === filterStatus)!.match(p.status);
      return matchSearch && matchDiscipline && matchStatus;
    });
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name": cmp = a.name.localeCompare(b.name); break;
        case "client": cmp = a.client.localeCompare(b.client); break;
        case "discipline": cmp = a.discipline.localeCompare(b.discipline); break;
        case "deadline": cmp = new Date(a.deadline).getTime() - new Date(b.deadline).getTime(); break;
        case "status": cmp = a.status.localeCompare(b.status); break;
        case "progress": {
          const pa = a.stages.filter(s => s.status === "concluido").length / (a.stages.length || 1);
          const pb = b.stages.filter(s => s.status === "concluido").length / (b.stages.length || 1);
          cmp = pa - pb; break;
        }
      }
      return sortAsc ? cmp : -cmp;
    });
    return result;
  }, [projects, search, filterDiscipline, filterStatus, sortField, sortAsc]);

  const handleProjectsCreated = () => {
    refetch();
  };

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <th className="text-left py-3 px-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none" onClick={() => handleSort(field)}>
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className={`h-3 w-3 ${sortField === field ? "text-foreground" : "opacity-40"}`} />
      </div>
    </th>
  );

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between animate-reveal-up" style={{ animationFillMode: "backwards" }}>
          <div>
            <h1 className="text-2xl font-bold">Projetos</h1>
            <p className="text-muted-foreground mt-1">{projects.length} projetos cadastrados</p>
          </div>
          {canCreateProj && (
            <Button onClick={() => setDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Novo Projeto
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-3 animate-reveal-up delay-1" style={{ animationFillMode: "backwards" }}>
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar projeto ou cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <select value={filterDiscipline} onChange={(e) => setFilterDiscipline(e.target.value as Discipline | "all")} className="h-10 rounded-md border bg-card px-3 text-sm">
            <option value="all">Todas disciplinas</option>
            <option value="estrutural">Estrutural</option>
            <option value="hidraulica">Hidráulica</option>
            <option value="eletrica">Elétrica</option>
          </select>
          <div className="flex rounded-md border bg-card p-0.5">
            {STATUS_FILTERS.map(f => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilterStatus(f.key)}
                className={`px-3 h-9 rounded text-sm transition-colors ${filterStatus === f.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {f.label} <span className="tabular-nums opacity-70">({statusCounts[f.key]})</span>
              </button>
            ))}
          </div>
        </div>

        {canBulk && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm">
            <span className="text-muted-foreground">{selected.size} selecionado{selected.size === 1 ? "" : "s"}</span>
            <Button variant="outline" size="sm" onClick={() => setSelected(new Set(suggestedIds))} disabled={suggestedIds.size === 0}>
              Selecionar sugeridos ({suggestedIds.size})
            </Button>
            {selected.size > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Limpar seleção</Button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-muted-foreground">Alterar status dos selecionados:</span>
              {BULK_OPTIONS.map(o => (
                <Button key={o.value} size="sm" variant="secondary" disabled={selected.size === 0 || bulkSaving} onClick={() => setBulkStatus(o.value)}>
                  {o.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="overflow-x-auto animate-reveal-up delay-2 rounded-lg border bg-card" style={{ animationFillMode: "backwards" }}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  {canBulk && (
                    <th className="py-3 px-3 w-8">
                      <Checkbox
                        checked={filtered.length > 0 && filtered.every(p => selected.has(p.id))}
                        onCheckedChange={(v) => setSelected(prev => {
                          const n = new Set(prev);
                          filtered.forEach(p => { if (v) n.add(p.id); else n.delete(p.id); });
                          return n;
                        })}
                      />
                    </th>
                  )}
                  <SortHeader field="name">Projeto</SortHeader>
                  <SortHeader field="client">Cliente</SortHeader>
                  <SortHeader field="discipline">Disciplina</SortHeader>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground">Coordenador</th>
                  <SortHeader field="deadline">Prazo</SortHeader>
                  <SortHeader field="progress">Progresso</SortHeader>
                  <SortHeader field="status">Status</SortHeader>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const completedStages = p.stages.filter((s) => s.status === "concluido").length;
                  const progress = p.stages.length > 0 ? Math.round((completedStages / p.stages.length) * 100) : 0;
                  const responsible = getProfileById(profiles, p.responsible);
                  return (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => navigate(`/projetos/${p.id}`)}>
                      {canBulk && (
                        <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggleSelected(p.id)} />
                        </td>
                      )}
                      <td className="py-3 px-3 font-medium">{p.name}</td>
                      <td className="py-3 px-3 text-muted-foreground">{p.client}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: disciplineColors[p.discipline] }} />
                          {DISCIPLINE_SHORT[p.discipline]}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-muted-foreground">{responsible?.name || "—"}</td>
                      <td className="py-3 px-3 tabular-nums text-muted-foreground">{formatDateBR(p.deadline)}</td>
                      <td className="py-3 px-3 w-32">
                        <div className="flex items-center gap-2">
                          <Progress value={progress} className="h-1.5 flex-1" />
                          <span className="text-xs tabular-nums text-muted-foreground">{progress}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-col items-start gap-1">
                          <Badge variant="secondary" className={statusColors[p.status]}>{STATUS_LABELS[p.status]}</Badge>
                          {suggestedIds.has(p.id) && (
                            <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground whitespace-nowrap">Tarefas entregues — pode concluir</Badge>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {!loading && filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground"><p>Nenhum projeto encontrado.</p></div>
          )}
        </div>
      </div>
      <AlertDialog open={!!bulkStatus} onOpenChange={(o) => { if (!o) setBulkStatus(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterar status?</AlertDialogTitle>
            <AlertDialogDescription>
              {selected.size} projeto{selected.size === 1 ? "" : "s"} {selected.size === 1 ? "será alterado" : "serão alterados"} para "{bulkStatus ? STATUS_LABELS[bulkStatus] : ""}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkSaving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={bulkSaving} onClick={(e) => { e.preventDefault(); applyBulk(); }}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <NewProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} onProjectsCreated={handleProjectsCreated} />
    </AppLayout>
  );
}
