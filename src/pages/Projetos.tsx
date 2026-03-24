import { useState, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { projects as initialProjects, getUserById, users } from "@/data/mockData";
import { useAuth } from "@/contexts/AuthContext";
import { DISCIPLINE_SHORT, STATUS_LABELS, STAGE_NAMES, type Discipline, type ProjectStatus, type Project } from "@/types";
import { Search, Plus, ArrowUpDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

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
  const [search, setSearch] = useState("");
  const [filterDiscipline, setFilterDiscipline] = useState<Discipline | "all">("all");
  const [filterStatus, setFilterStatus] = useState<ProjectStatus | "all">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [allProjects, setAllProjects] = useState<Project[]>(initialProjects);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortAsc, setSortAsc] = useState(true);

  const [form, setForm] = useState({
    name: "",
    client: "",
    discipline: "estrutural" as Discipline,
    startDate: "",
    deadline: "",
    responsible: "",
    hoursSold: "",
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const filtered = useMemo(() => {
    let result = allProjects.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.client.toLowerCase().includes(search.toLowerCase());
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
          const pa = a.stages.filter(s => s.status === "concluido").length / a.stages.length;
          const pb = b.stages.filter(s => s.status === "concluido").length / b.stages.length;
          cmp = pa - pb;
          break;
        }
      }
      return sortAsc ? cmp : -cmp;
    });

    return result;
  }, [allProjects, search, filterDiscipline, filterStatus, sortField, sortAsc]);

  const handleCreate = () => {
    if (!form.name || !form.client || !form.startDate || !form.deadline || !form.responsible) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }

    const newProject: Project = {
      id: `p${Date.now()}`,
      name: form.name,
      client: form.client,
      discipline: form.discipline,
      startDate: form.startDate,
      deadline: form.deadline,
      status: "em_andamento",
      responsible: form.responsible,
      team: [form.responsible],
      hoursSold: Number(form.hoursSold) || 0,
      hoursWorked: 0,
      stages: STAGE_NAMES.map((name, i) => ({
        id: `ns${Date.now()}_${i}`,
        name,
        responsible: form.responsible,
        deadline: form.deadline,
        status: "pendente" as const,
        hoursSpent: 0,
      })),
      revisions: [],
    };

    setAllProjects((prev) => [newProject, ...prev]);
    setDialogOpen(false);
    setForm({ name: "", client: "", discipline: "estrutural", startDate: "", deadline: "", responsible: "", hoursSold: "" });
    toast.success("Projeto criado com sucesso!");
  };

  const disciplineUsers = users.filter(
    (u) => u.discipline === form.discipline && (u.role === "coordenador" || u.role === "projetista")
  );

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <th
      className="text-left py-3 px-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none"
      onClick={() => handleSort(field)}
    >
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
            <p className="text-muted-foreground mt-1">{allProjects.length} projetos cadastrados</p>
          </div>
          {!isProjetista && (
            <Button onClick={() => setDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Novo Projeto
            </Button>
          )}
        </div>

        {/* Filters */}
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

        {/* Project table */}
        <div className="overflow-x-auto animate-reveal-up delay-2 rounded-lg border bg-card" style={{ animationFillMode: "backwards" }}>
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
                const progress = Math.round((completedStages / p.stages.length) * 100);
                const responsible = getUserById(p.responsible);

                return (
                  <tr
                    key={p.id}
                    className="border-b last:border-0 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/projetos/${p.id}`)}
                  >
                    <td className="py-3 px-3 font-medium">{p.name}</td>
                    <td className="py-3 px-3 text-muted-foreground">{p.client}</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: disciplineColors[p.discipline] }} />
                        {DISCIPLINE_SHORT[p.discipline]}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-muted-foreground">{responsible?.name}</td>
                    <td className="py-3 px-3 tabular-nums text-muted-foreground">
                      {new Date(p.deadline).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="py-3 px-3 w-32">
                      <div className="flex items-center gap-2">
                        <Progress value={progress} className="h-1.5 flex-1" />
                        <span className="text-xs tabular-nums text-muted-foreground">{progress}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <Badge variant="secondary" className={statusColors[p.status]}>
                        {STATUS_LABELS[p.status]}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p>Nenhum projeto encontrado com os filtros atuais.</p>
            </div>
          )}
        </div>
      </div>

      {/* New Project Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Projeto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Projeto *</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Edifício Central Park" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client">Cliente *</Label>
              <Input id="client" value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} placeholder="Ex: Construtora ABC" />
            </div>
            <div className="space-y-2">
              <Label>Disciplina *</Label>
              <select
                value={form.discipline}
                onChange={(e) => setForm({ ...form, discipline: e.target.value as Discipline, responsible: "" })}
                className="h-10 w-full rounded-md border bg-card px-3 text-sm"
              >
                <option value="estrutural">Estrutural</option>
                <option value="hidraulica">Hidráulica</option>
                <option value="eletrica">Elétrica</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="startDate">Data de Início *</Label>
                <Input id="startDate" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deadline">Prazo Final *</Label>
                <Input id="deadline" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Responsável *</Label>
              <select
                value={form.responsible}
                onChange={(e) => setForm({ ...form, responsible: e.target.value })}
                className="h-10 w-full rounded-md border bg-card px-3 text-sm"
              >
                <option value="">Selecione...</option>
                {disciplineUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hoursSold">Horas Vendidas</Label>
              <Input id="hoursSold" type="number" value={form.hoursSold} onChange={(e) => setForm({ ...form, hoursSold: e.target.value })} placeholder="Ex: 480" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate}>Criar Projeto</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
