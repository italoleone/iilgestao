import { useParams, useNavigate } from "react-router-dom";
import { formatDateBR, parseLocalDate, formatBRL, parseBRL, cn } from "@/lib/utils";
import { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfiles, getProfileById, useTasks } from "@/hooks/useSupabaseData";
import { useAuth } from "@/contexts/AuthContext";
import { DISCIPLINE_SHORT, STATUS_LABELS, TASK_STATUS_LABELS, STAGE_NAMES, type ProjectStatus, type TaskStatus, type Discipline, type Project, type Stage } from "@/types";
import { ArrowLeft, Clock, DollarSign, Users, FileText, ListChecks, Loader2, Trash2, ChevronDown, Pencil, Check, ChevronsUpDown } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { MeetingsSection } from "@/components/meetings/MeetingsSection";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useTimeEntries } from "@/hooks/useSupabaseData";

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
  pendente: "Pendente", em_andamento: "Em andamento", concluido: "Concluído", revisao: "Em revisão",
};

const taskStatusColors: Record<TaskStatus, string> = {
  nao_iniciada: "bg-muted text-muted-foreground",
  em_andamento: "bg-info text-info-foreground",
  concluida: "bg-success text-success-foreground",
  aguardando_validacao: "bg-warning text-warning-foreground",
  aprovada: "bg-success text-success-foreground",
  reprovada: "bg-destructive text-destructive-foreground",
  enviado_cliente: "bg-primary text-primary-foreground",
};

export default function ProjetoDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profiles } = useActiveProfiles();
  const { tasks: allTasks } = useTasks();
  const { canAccessFinanceiro: canSeeFinancial, canAccessAllProjects, profile: authProfile } = useAuth();
  const { entries: projectTimeEntries } = useTimeEntries(undefined, id);

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editClient, setEditClient] = useState("");
  const [editClientSearch, setEditClientSearch] = useState("");
  const [editClientPopoverOpen, setEditClientPopoverOpen] = useState(false);
  const [editClients, setEditClients] = useState<string[]>([]);
  const [editDiscipline, setEditDiscipline] = useState<Discipline>("estrutural");
  const [editResponsible, setEditResponsible] = useState("");
  const [editSaleValue, setEditSaleValue] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [editStatus, setEditStatus] = useState<ProjectStatus>("em_andamento");
  const [editActiveUsers, setEditActiveUsers] = useState<{ id: string; name: string }[]>([]);
  const [editSaving, setEditSaving] = useState(false);

  const canEdit = authProfile?.role === "admin_geral" || authProfile?.role === "admin" || authProfile?.role === "planejamento";

  const fetchProject = () => {
    if (!id) return;
    supabase.from("projects").select("*").eq("id", id).maybeSingle().then(({ data }) => {
      if (data) {
        const d = data as any;
        const stages: Stage[] = Array.isArray(d.stages) ? d.stages : [];
        setProject({
          id: d.id, name: d.name, client: d.client, discipline: d.discipline,
          startDate: d.start_date, deadline: d.deadline, status: d.status,
          responsible: d.responsible, team: d.team || [d.responsible],
          hoursSold: d.hours_sold, saleValue: d.sale_value, hoursWorked: d.hours_worked,
          stages, revisions: Array.isArray(d.revisions) ? d.revisions : [],
        });
      }
      setLoading(false);
    });
  };

  useEffect(() => { fetchProject(); }, [id]);

  const openEditDialog = () => {
    if (!project) return;
    setEditName(project.name);
    setEditClient(project.client);
    setEditClientSearch("");
    setEditDiscipline(project.discipline);
    setEditResponsible(project.responsible);
    setEditSaleValue(formatBRL(project.saleValue));
    setEditStartDate(project.startDate);
    setEditDeadline(project.deadline);
    setEditStatus(project.status);
    // Fetch clients and active users
    supabase.from("clients").select("name").order("name").then(({ data }) => {
      if (data) setEditClients(data.map(c => c.name));
    });
    supabase.from("profiles").select("id, name").eq("status", "active").order("name").then(({ data }) => {
      if (data) setEditActiveUsers(data.map(u => ({ id: u.id, name: u.name })));
    });
    setEditOpen(true);
  };

  const filteredEditClients = useMemo(() => {
    if (!editClientSearch) return editClients;
    return editClients.filter(c => c.toLowerCase().includes(editClientSearch.toLowerCase()));
  }, [editClients, editClientSearch]);

  const handleEditSave = async () => {
    if (!project) return;
    if (!editName || !editClient || !editResponsible || !editStartDate || !editDeadline) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    setEditSaving(true);
    const { error } = await supabase.from("projects").update({
      name: editName,
      client: editClient,
      discipline: editDiscipline,
      responsible: editResponsible,
      sale_value: parseBRL(editSaleValue),
      start_date: editStartDate,
      deadline: editDeadline,
      status: editStatus,
    }).eq("id", project.id);
    setEditSaving(false);
    if (error) {
      toast.error("Erro ao atualizar projeto: " + error.message);
    } else {
      toast.success("Projeto atualizado com sucesso.");
      fetchProject();
      setEditOpen(false);
    }
  };

  const projectTasks = useMemo(() => allTasks.filter(t => t.projectId === id), [allTasks, id]);
  const taskHours = useMemo(() => ({
    estimated: projectTasks.reduce((s, t) => s + t.estimatedHours, 0),
    worked: projectTasks.reduce((s, t) => s + t.hoursWorked, 0),
  }), [projectTasks]);

  const cost = useMemo(() => projectTimeEntries.reduce((sum, entry) => {
    const userProfile = getProfileById(profiles, entry.user_id);
    const costPerHour = userProfile?.cost_per_hour || 0;
    return sum + (entry.duration_minutes / 60) * costPerHour;
  }, 0), [projectTimeEntries, profiles]);

  if (loading) {
    return <AppLayout><div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></AppLayout>;
  }

  if (!project) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">Projeto não encontrado.</p>
          <button onClick={() => navigate("/projetos")} className="text-primary mt-2 text-sm underline">Voltar aos projetos</button>
        </div>
      </AppLayout>
    );
  }

  const completedStages = project.stages.filter(s => s.status === "concluido").length;
  const progress = project.stages.length > 0 ? Math.round((completedStages / project.stages.length) * 100) : 0;
  const responsible = getProfileById(profiles, project.responsible);
  const revenue = project.saleValue;
  const profit = revenue - cost;

  const handleDeleteProject = async () => {
    setDeleting(true);
    const { error } = await supabase.from("projects").delete().eq("id", project.id);
    setDeleting(false);
    if (error) {
      toast.error("Erro ao excluir projeto: " + error.message);
    } else {
      toast.success("Projeto excluído com sucesso.");
      navigate("/projetos");
    }
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="animate-reveal-up" style={{ animationFillMode: "backwards" }}>
          <div className="flex items-center justify-between mb-3">
            <Button variant="ghost" size="sm" className="gap-1.5 -ml-2" onClick={() => navigate("/projetos")}>
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
            <div className="flex items-center gap-2">
              {canEdit && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={openEditDialog}>
                  <Pencil className="h-4 w-4" /> Editar Projeto
                </Button>
              )}
              {canAccessAllProjects && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="gap-1.5" disabled={deleting}>
                      <Trash2 className="h-4 w-4" /> Excluir Projeto
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir projeto?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja excluir o projeto <strong>{project.name}</strong>?
                        <br /><br />
                        ⚠️ Todas as tarefas vinculadas e registros de horas também serão excluídos permanentemente.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteProject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Excluir permanentemente
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div><h1 className="text-2xl font-bold">{project.name}</h1><p className="text-muted-foreground mt-1">{project.client}</p></div>
            <Badge variant="secondary" className={statusColors[project.status]}>{STATUS_LABELS[project.status]}</Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-reveal-up delay-1" style={{ animationFillMode: "backwards" }}>
          <Card className="shadow-sm"><CardContent className="pt-4"><p className="text-xs text-muted-foreground mb-1">Disciplina</p><p className="font-medium">{DISCIPLINE_SHORT[project.discipline]}</p></CardContent></Card>
          <Card className="shadow-sm"><CardContent className="pt-4"><p className="text-xs text-muted-foreground mb-1">Coordenador</p><p className="font-medium">{responsible?.name || "—"}</p></CardContent></Card>
          <Card className="shadow-sm"><CardContent className="pt-4"><p className="text-xs text-muted-foreground mb-1">Prazo</p><p className="font-medium tabular-nums">{formatDateBR(project.deadline)}</p></CardContent></Card>
          <Card className="shadow-sm"><CardContent className="pt-4"><p className="text-xs text-muted-foreground mb-1">Tarefas</p><p className="font-medium tabular-nums">{projectTasks.filter(t => t.status === "concluida").length}/{projectTasks.length}</p></CardContent></Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-sm animate-reveal-up delay-2" style={{ animationFillMode: "backwards" }}>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" /> Horas</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Valor de Venda</span><span className="font-medium tabular-nums">R$ {formatBRL(project.saleValue)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Horas estimadas (tarefas)</span><span className="font-medium tabular-nums">{taskHours.estimated}h</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Horas realizadas (tarefas)</span><span className="font-medium tabular-nums">{taskHours.worked}h</span></div>
              <Progress value={taskHours.estimated > 0 ? (taskHours.worked / taskHours.estimated) * 100 : 0} className="h-2" />
            </CardContent>
          </Card>

          {canSeeFinancial && (
            <Card className="shadow-sm animate-reveal-up delay-3" style={{ animationFillMode: "backwards" }}>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4" /> Financeiro</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Receita</span><span className="font-medium tabular-nums">R$ {formatBRL(revenue)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Custo</span><span className="font-medium tabular-nums">R$ {formatBRL(cost)}</span></div>
                <div className={`flex justify-between text-sm font-semibold ${profit >= 0 ? "text-success" : "text-destructive"}`}>
                  <span>Resultado</span><span className="tabular-nums">{profit >= 0 ? "+" : ""}R$ {formatBRL(profit)}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="shadow-sm animate-reveal-up delay-4" style={{ animationFillMode: "backwards" }}>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><ListChecks className="h-4 w-4" /> Tarefas do Projeto ({projectTasks.length})</CardTitle></CardHeader>
          <CardContent>
            {projectTasks.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma tarefa cadastrada.</p> : (
              <Accordion type="multiple" className="w-full">
                {STAGE_NAMES.map((stageName) => {
                  const stageTasks = projectTasks.filter(t => t.stageName === stageName);
                  if (stageTasks.length === 0) return null;
                  const completedCount = stageTasks.filter(t => ["concluida", "aprovada"].includes(t.status)).length;
                  return (
                    <AccordionItem key={stageName} value={stageName}>
                      <AccordionTrigger className="hover:no-underline px-1">
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-sm">{stageName}</span>
                          <Badge variant="secondary" className="text-xs">{completedCount}/{stageTasks.length}</Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2 pt-1">
                          {stageTasks.map(task => {
                            const taskResp = getProfileById(profiles, task.responsible);
                            const hp = task.estimatedHours > 0 ? Math.round((task.hoursWorked / task.estimatedHours) * 100) : 0;
                            const isOverdue = parseLocalDate(task.endDate) < new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()) && !["concluida", "aprovada"].includes(task.status);
                            return (
                              <div key={task.id} className={`flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/30 transition-colors cursor-pointer ${isOverdue ? "border-destructive/40" : ""}`} onClick={() => navigate(`/tarefas/${task.id}`)}>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium">{task.name}</p>
                                  <p className="text-xs text-muted-foreground">{taskResp?.name || "—"}</p>
                                </div>
                                <div className="hidden sm:flex items-center gap-2 w-24">
                                  <Progress value={Math.min(hp, 100)} className={`h-1.5 flex-1 ${hp > 100 ? "[&>div]:bg-destructive" : ""}`} />
                                  <span className="text-xs tabular-nums text-muted-foreground">{task.hoursWorked}/{task.estimatedHours}h</span>
                                </div>
                                <Badge variant="secondary" className={taskStatusColors[task.status]}>{TASK_STATUS_LABELS[task.status]}</Badge>
                              </div>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </CardContent>
        </Card>

        <MeetingsSection projectId={project.id} />
      </div>

      {/* Edit Project Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Projeto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome do Projeto *</Label>
              <Input id="edit-name" value={editName} onChange={e => setEditName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Popover open={editClientPopoverOpen} onOpenChange={setEditClientPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                    {editClient || "Selecionar ou digitar cliente..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar cliente..." value={editClientSearch} onValueChange={v => { setEditClientSearch(v); setEditClient(v); }} />
                    <CommandList>
                      <CommandEmpty>
                        {editClientSearch ? (
                          <button className="w-full px-2 py-2 text-sm text-left hover:bg-accent rounded" onClick={() => { setEditClient(editClientSearch); setEditClientPopoverOpen(false); }}>
                            Usar: <strong>&quot;{editClientSearch}&quot;</strong>
                          </button>
                        ) : "Nenhum cliente encontrado."}
                      </CommandEmpty>
                      <CommandGroup>
                        {filteredEditClients.map(c => (
                          <CommandItem key={c} value={c} onSelect={() => { setEditClient(c); setEditClientSearch(""); setEditClientPopoverOpen(false); }}>
                            <Check className={cn("mr-2 h-4 w-4", editClient === c ? "opacity-100" : "opacity-0")} />
                            {c}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Disciplina *</Label>
              <select value={editDiscipline} onChange={e => setEditDiscipline(e.target.value as Discipline)} className="h-10 w-full rounded-md border bg-card px-3 text-sm">
                {(["estrutural", "hidraulica", "eletrica"] as Discipline[]).map(d => (
                  <option key={d} value={d}>{DISCIPLINE_SHORT[d]}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Coordenador *</Label>
              <select value={editResponsible} onChange={e => setEditResponsible(e.target.value)} className="h-10 w-full rounded-md border bg-card px-3 text-sm">
                <option value="">Selecione...</option>
                {editActiveUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Valor de Venda (R$) *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                <Input type="text" inputMode="decimal" value={editSaleValue} onChange={e => setEditSaleValue(e.target.value)} placeholder="Ex: 12.050,89" className="pl-10" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-start">Data de Início *</Label>
                <Input id="edit-start" type="date" value={editStartDate} onChange={e => setEditStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-deadline">Data Final *</Label>
                <Input id="edit-deadline" type="date" value={editDeadline} onChange={e => setEditDeadline(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status *</Label>
              <select value={editStatus} onChange={e => setEditStatus(e.target.value as ProjectStatus)} className="h-10 w-full rounded-md border bg-card px-3 text-sm">
                {(Object.entries(STATUS_LABELS) as [ProjectStatus, string][]).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleEditSave} disabled={editSaving}>
              {editSaving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
