import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { projects, getUserById } from "@/data/mockData";
import { DISCIPLINE_SHORT, STATUS_LABELS, type Discipline, type ProjectStatus } from "@/types";
import { Search, Filter } from "lucide-react";
import { useNavigate } from "react-router-dom";

const statusColors: Record<ProjectStatus, string> = {
  em_andamento: "bg-info text-info-foreground",
  concluido: "bg-success text-success-foreground",
  atrasado: "bg-destructive text-destructive-foreground",
  pausado: "bg-muted text-muted-foreground",
};

const disciplineColors: Record<Discipline, string> = {
  estrutural: "#4472C4",
  hidraulica: "#0097A7",
  eletrica: "#E8A317",
};

export default function Projetos() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filterDiscipline, setFilterDiscipline] = useState<Discipline | "all">("all");
  const [filterStatus, setFilterStatus] = useState<ProjectStatus | "all">("all");

  const filtered = projects.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.client.toLowerCase().includes(search.toLowerCase());
    const matchDiscipline = filterDiscipline === "all" || p.discipline === filterDiscipline;
    const matchStatus = filterStatus === "all" || p.status === filterStatus;
    return matchSearch && matchDiscipline && matchStatus;
  });

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="animate-reveal-up" style={{ animationFillMode: "backwards" }}>
          <h1 className="text-2xl font-bold">Projetos</h1>
          <p className="text-muted-foreground mt-1">{projects.length} projetos cadastrados</p>
        </div>

        {/* Filters */}
        <div
          className="flex flex-wrap gap-3 animate-reveal-up delay-1"
          style={{ animationFillMode: "backwards" }}
        >
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar projeto ou cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={filterDiscipline}
            onChange={(e) => setFilterDiscipline(e.target.value as Discipline | "all")}
            className="h-10 rounded-md border bg-card px-3 text-sm"
          >
            <option value="all">Todas disciplinas</option>
            <option value="estrutural">Estrutural</option>
            <option value="hidraulica">Hidráulica</option>
            <option value="eletrica">Elétrica</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as ProjectStatus | "all")}
            className="h-10 rounded-md border bg-card px-3 text-sm"
          >
            <option value="all">Todos status</option>
            <option value="em_andamento">Em andamento</option>
            <option value="atrasado">Atrasado</option>
            <option value="concluido">Concluído</option>
            <option value="pausado">Pausado</option>
          </select>
        </div>

        {/* Project cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p, i) => {
            const completedStages = p.stages.filter((s) => s.status === "concluido").length;
            const progress = Math.round((completedStages / p.stages.length) * 100);
            const responsible = getUserById(p.responsible);

            return (
              <Card
                key={p.id}
                className="shadow-sm hover:shadow-md transition-all cursor-pointer group animate-reveal-up active:scale-[0.98]"
                style={{ animationDelay: `${(i + 2) * 60}ms`, animationFillMode: "backwards" }}
                onClick={() => navigate(`/projetos/${p.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 min-w-0">
                      <CardTitle className="text-base leading-snug group-hover:text-primary transition-colors">
                        {p.name}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">{p.client}</p>
                    </div>
                    <Badge variant="secondary" className={`shrink-0 ml-2 ${statusColors[p.status]}`}>
                      {STATUS_LABELS[p.status]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: disciplineColors[p.discipline] }}
                    />
                    <span className="text-muted-foreground">{DISCIPLINE_SHORT[p.discipline]}</span>
                    <span className="text-muted-foreground/40 mx-1">·</span>
                    <span className="text-muted-foreground">{responsible?.name}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Progress value={progress} className="h-1.5 flex-1" />
                    <span className="text-xs tabular-nums text-muted-foreground">{progress}%</span>
                  </div>

                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Início: {new Date(p.startDate).toLocaleDateString("pt-BR")}</span>
                    <span>Prazo: {new Date(p.deadline).toLocaleDateString("pt-BR")}</span>
                  </div>

                  <div className="flex justify-between text-xs tabular-nums">
                    <span className="text-muted-foreground">
                      {p.hoursWorked}h / {p.hoursSold}h
                    </span>
                    <span className="text-muted-foreground">
                      {completedStages}/{p.stages.length} etapas
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Filter className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhum projeto encontrado com os filtros atuais.</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
