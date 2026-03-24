import { useState, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NewProjectDialog } from "@/components/NewProjectDialog";
import { useProjects, useActiveProfiles, getProfileById } from "@/hooks/useSupabaseData";
import { useAuth } from "@/contexts/AuthContext";
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

type SortField = "name" | "client" | "discipline" | "deadline" | "status" | "progress";

export default function Projetos() {
  const navigate = useNavigate();
  const { isProjetista } = useAuth();
  const { projects, loading, refetch } = useProjects();
  const { profiles } = useActiveProfiles();
  const [search, setSearch] = useState("");
  const [filterDiscipline, setFilterDiscipline] = useState<Discipline | "all">("all");
  const [filterStatus, setFilterStatus] = useState<ProjectStatus | "all">("all");
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
      const matchStatus = filterStatus === "all" || p.status === filterStatus;
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
          {!isProjetista && (
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
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as ProjectStatus | "all")} className="h-10 rounded-md border bg-card px-3 text-sm">
            <option value="all">Todos status</option>
            <option value="em_andamento">Em andamento</option>
            <option value="atrasado">Atrasado</option>
            <option value="concluido">Concluído</option>
            <option value="pausado">Pausado</option>
          </select>
        </div>

        <div className="overflow-x-auto animate-reveal-up delay-2 rounded-lg border bg-card" style={{ animationFillMode: "backwards" }}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <SortHeader field="name">Projeto</SortHeader>
                  <SortHeader field="client">Cliente</SortHeader>
                  <SortHeader field="discipline">Disciplina</SortHeader>
                  <th className="text-left py-3 px-3 font-medium text-muted-foreground">Responsável</th>
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
                      <td className="py-3 px-3 font-medium">{p.name}</td>
                      <td className="py-3 px-3 text-muted-foreground">{p.client}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: disciplineColors[p.discipline] }} />
                          {DISCIPLINE_SHORT[p.discipline]}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-muted-foreground">{responsible?.name || "—"}</td>
                      <td className="py-3 px-3 tabular-nums text-muted-foreground">{new Date(p.deadline).toLocaleDateString("pt-BR")}</td>
                      <td className="py-3 px-3 w-32">
                        <div className="flex items-center gap-2">
                          <Progress value={progress} className="h-1.5 flex-1" />
                          <span className="text-xs tabular-nums text-muted-foreground">{progress}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant="secondary" className={statusColors[p.status]}>{STATUS_LABELS[p.status]}</Badge>
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
      <NewProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} onProjectsCreated={handleProjectsCreated} />
    </AppLayout>
  );
}
