import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { projects, getUserById, getProjectCost, currentUser } from "@/data/mockData";
import { DISCIPLINE_SHORT, STATUS_LABELS, type ProjectStatus, type Discipline } from "@/types";
import { ArrowLeft, Clock, DollarSign, Users, FileText } from "lucide-react";

const statusColors: Record<ProjectStatus, string> = {
  em_andamento: "bg-info text-info-foreground",
  concluido: "bg-success text-success-foreground",
  atrasado: "bg-destructive text-destructive-foreground",
  pausado: "bg-muted text-muted-foreground",
};

const stageStatusColors: Record<string, string> = {
  pendente: "bg-muted text-muted-foreground",
  em_andamento: "bg-info text-info-foreground",
  concluido: "bg-success text-success-foreground",
  revisao: "bg-warning text-warning-foreground",
};

const stageStatusLabels: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  revisao: "Em revisão",
};

export default function ProjetoDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const project = projects.find((p) => p.id === id);

  if (!project) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">Projeto não encontrado.</p>
          <button onClick={() => navigate("/projetos")} className="text-primary mt-2 text-sm underline">
            Voltar aos projetos
          </button>
        </div>
      </AppLayout>
    );
  }

  const completedStages = project.stages.filter((s) => s.status === "concluido").length;
  const progress = Math.round((completedStages / project.stages.length) * 100);
  const responsible = getUserById(project.responsible);
  const cost = getProjectCost(project);
  const revenue = project.hoursSold * 130;
  const profit = revenue - cost;
  const canSeeFinancial = currentUser.role === "admin" || currentUser.role === "gerente";

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Back + Header */}
        <div className="animate-reveal-up" style={{ animationFillMode: "backwards" }}>
          <button
            onClick={() => navigate("/projetos")}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold">{project.name}</h1>
              <p className="text-muted-foreground mt-1">{project.client}</p>
            </div>
            <Badge variant="secondary" className={statusColors[project.status]}>
              {STATUS_LABELS[project.status]}
            </Badge>
          </div>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-reveal-up delay-1" style={{ animationFillMode: "backwards" }}>
          <Card className="shadow-sm">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground mb-1">Disciplina</p>
              <p className="font-medium">{DISCIPLINE_SHORT[project.discipline]}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground mb-1">Responsável</p>
              <p className="font-medium">{responsible?.name}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground mb-1">Prazo</p>
              <p className="font-medium tabular-nums">{new Date(project.deadline).toLocaleDateString("pt-BR")}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground mb-1">Progresso</p>
              <div className="flex items-center gap-2">
                <Progress value={progress} className="h-1.5 flex-1" />
                <span className="text-sm font-medium tabular-nums">{progress}%</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Hours + Financial */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-sm animate-reveal-up delay-2" style={{ animationFillMode: "backwards" }}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" /> Horas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Horas vendidas</span>
                <span className="font-medium tabular-nums">{project.hoursSold}h</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Horas realizadas</span>
                <span className="font-medium tabular-nums">{project.hoursWorked}h</span>
              </div>
              <Progress value={(project.hoursWorked / project.hoursSold) * 100} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {Math.round((project.hoursWorked / project.hoursSold) * 100)}% das horas consumidas
              </p>
            </CardContent>
          </Card>

          {canSeeFinancial && (
            <Card className="shadow-sm animate-reveal-up delay-3" style={{ animationFillMode: "backwards" }}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4" /> Financeiro
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Receita estimada</span>
                  <span className="font-medium tabular-nums">
                    R$ {revenue.toLocaleString("pt-BR")}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Custo realizado</span>
                  <span className="font-medium tabular-nums">
                    R$ {cost.toLocaleString("pt-BR")}
                  </span>
                </div>
                <div className={`flex justify-between text-sm font-semibold ${profit >= 0 ? "text-success" : "text-destructive"}`}>
                  <span>Resultado</span>
                  <span className="tabular-nums">
                    {profit >= 0 ? "+" : ""}R$ {profit.toLocaleString("pt-BR")}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Stages */}
        <Card className="shadow-sm animate-reveal-up delay-4" style={{ animationFillMode: "backwards" }}>
          <CardHeader>
            <CardTitle className="text-base">Etapas do Projeto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {project.stages.map((stage, i) => {
                const stageResp = getUserById(stage.responsible);
                return (
                  <div key={stage.id} className="flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{stage.name}</p>
                      <p className="text-xs text-muted-foreground">{stageResp?.name}</p>
                    </div>
                    <div className="text-xs text-muted-foreground tabular-nums hidden sm:block">
                      {stage.hoursSpent}h
                    </div>
                    <div className="text-xs text-muted-foreground tabular-nums hidden sm:block">
                      {new Date(stage.deadline).toLocaleDateString("pt-BR")}
                    </div>
                    <Badge variant="secondary" className={stageStatusColors[stage.status]}>
                      {stageStatusLabels[stage.status]}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Team */}
        <Card className="shadow-sm animate-reveal-up delay-5" style={{ animationFillMode: "backwards" }}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" /> Equipe
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {project.team.map((uid) => {
                const u = getUserById(uid);
                if (!u) return null;
                return (
                  <div key={uid} className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card">
                    <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-xs font-semibold text-primary-foreground">
                      {u.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{u.name}</p>
                      <p className="text-xs text-muted-foreground">R$ {u.costPerHour}/h</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Revisions */}
        {project.revisions.length > 0 && (
          <Card className="shadow-sm animate-reveal-up delay-6" style={{ animationFillMode: "backwards" }}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" /> Revisões
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {project.revisions.map((rev) => {
                  const revResp = getUserById(rev.responsible);
                  return (
                    <div key={rev.id} className="flex items-start gap-3 p-3 rounded-lg border">
                      <Badge variant="outline" className="shrink-0 mt-0.5">{rev.version}</Badge>
                      <div className="min-w-0">
                        <p className="text-sm">{rev.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {revResp?.name} · {new Date(rev.date).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
