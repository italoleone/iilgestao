import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProjectCombobox } from "@/components/ProjectCombobox";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, ClipboardCheck, Pencil, User, UserCheck, Hash, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  DEMAND_TYPES,
  DEMAND_TYPE_LABELS,
  DEMAND_TYPE_COLORS,
  type DemandType,
} from "@/types/demands";

interface ProjectOption {
  id: string;
  name: string;
  status?: string;
}

interface UserOption {
  id: string;
  name: string;
}

interface Demand {
  id: string;
  project_id: string;
  demand_type: DemandType;
  description: string;
  created_by: string;
  is_done: boolean;
  done_at: string | null;
  created_at: string;
  priority: number | null;
  assigned_to: string | null;
  assigned_profile?: { name: string } | null;
  coordenador_id: string | null;
  coordenador_profile?: { name: string } | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

interface DemandFormDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projects: ProjectOption[];
  users: UserOption[];
  coordenadores: UserOption[];
  demand?: Demand | null;
  onSaved: () => void;
}

function DemandFormDialog({ open, onOpenChange, projects, users, coordenadores, demand, onSaved }: DemandFormDialogProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const isEdit = !!demand;

  const [demandType, setDemandType] = useState<DemandType | "">("");
  const [projectId, setProjectId] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<string>("");
  const [assignedTo, setAssignedTo] = useState<string>("none");
  const [coordenadorId, setCoordenadorId] = useState<string>("none");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setDemandType(demand?.demand_type ?? "");
      setProjectId(demand?.project_id ?? "");
      setDescription(demand?.description ?? "");
      setPriority(demand?.priority != null ? String(demand.priority) : "");
      setAssignedTo(demand?.assigned_to ?? "none");
      setCoordenadorId(demand?.coordenador_id ?? "none");
    }
  }, [open, demand]);

  const handleSubmit = async () => {
    if (!profile || !demandType || !projectId || !description.trim()) return;
    setSubmitting(true);
    const priorityValue = priority.trim() === "" ? null : Math.max(1, parseInt(priority, 10));
    const assignedValue = assignedTo === "none" ? null : assignedTo;
    const coordenadorValue = coordenadorId === "none" ? null : coordenadorId;
    let error;
    if (isEdit && demand) {
      ({ error } = await supabase
        .from("demands")
        .update({
          demand_type: demandType,
          project_id: projectId,
          description: description.trim(),
          priority: priorityValue,
          assigned_to: assignedValue,
          coordenador_id: coordenadorValue,
        })
        .eq("id", demand.id));
    } else {
      ({ error } = await supabase.from("demands").insert({
        demand_type: demandType,
        project_id: projectId,
        description: description.trim(),
        created_by: profile.id,
        priority: priorityValue,
        assigned_to: assignedValue,
        coordenador_id: coordenadorValue,
      }));
    }
    setSubmitting(false);
    if (error) {
      toast({
        title: isEdit ? "Erro ao salvar demanda" : "Erro ao criar demanda",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    toast({ title: isEdit ? "Demanda atualizada" : "Demanda criada com sucesso" });
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Demanda" : "Nova Demanda"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Tipo de Demanda</Label>
            <Select value={demandType} onValueChange={(v) => setDemandType(v as DemandType)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar tipo..." />
              </SelectTrigger>
              <SelectContent>
                {DEMAND_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    <div className="flex items-center gap-2">
                      <span className={cn("h-2 w-2 rounded-full", DEMAND_TYPE_COLORS[t].dot)} />
                      {DEMAND_TYPE_LABELS[t]}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Projeto</Label>
            <ProjectCombobox
              projects={projects.filter((p) => p.status !== "concluido")}
              value={projectId}
              onValueChange={setProjectId}
              placeholder="Selecionar projeto..."
            />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              placeholder="Ex: Fazer furação do tipo X"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label>Prioridade</Label>
            <Input
              type="number"
              min={1}
              placeholder="Ex: 1"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Responsável</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar responsável..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem responsável</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Coordenador</Label>
            <Select value={coordenadorId} onValueChange={setCoordenadorId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar coordenador..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem coordenador</SelectItem>
                {coordenadores.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={!demandType || !projectId || !description.trim() || submitting}
          >
            {submitting ? "Salvando..." : isEdit ? "Salvar Alterações" : "Criar Demanda"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface PriorityCellProps {
  demand: Demand;
  canEdit: boolean;
  onUpdate: (id: string, priority: number | null) => Promise<void>;
}

function PriorityCell({ demand, canEdit, onUpdate }: PriorityCellProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<string>(demand.priority != null ? String(demand.priority) : "");

  useEffect(() => {
    setValue(demand.priority != null ? String(demand.priority) : "");
  }, [demand.priority]);

  const commit = async () => {
    setEditing(false);
    const trimmed = value.trim();
    const parsed = trimmed === "" ? null : parseInt(trimmed, 10);
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 1)) {
      setValue(demand.priority != null ? String(demand.priority) : "");
      return;
    }
    if (parsed === demand.priority) return;
    await onUpdate(demand.id, parsed);
  };

  if (editing && canEdit) {
    return (
      <input
        type="number"
        min={1}
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setValue(demand.priority != null ? String(demand.priority) : "");
            setEditing(false);
          }
        }}
        className="w-16 text-xs border-b border-input bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
    );
  }

  if (demand.priority == null) return null;

  const badge = (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold border bg-primary/10 text-primary border-primary/20">
      <Hash size={10} /> {demand.priority}
    </span>
  );

  if (!canEdit) return badge;

  return (
    <button type="button" onClick={() => setEditing(true)} className="focus:outline-none">
      {badge}
    </button>
  );
}

export default function Demandas() {
  const { profile, isDiretorOrGerente, isPlanejamento, isCoordenador } = useAuth();
  const { toast } = useToast();

  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [coordenadores, setCoordenadores] = useState<UserOption[]>([]);
  const [demands, setDemands] = useState<Demand[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editDemand, setEditDemand] = useState<Demand | null>(null);
  const [filter, setFilter] = useState<"all" | DemandType>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [deleteTarget, setDeleteTarget] = useState<Demand | null>(null);

  const seesAll = true;

  const fetchAll = async () => {
    if (!profile) return;
    const demandsQuery = supabase
      .from("demands")
      .select("*, assigned_profile:profiles!assigned_to(name), coordenador_profile:profiles!coordenador_id(name)")
      .order("created_at", { ascending: false });
    const [projectsRes, usersRes, demandsRes, rolesRes] = await Promise.all([
      supabase.from("projects").select("id, name, status").order("name"),
      supabase.from("profiles").select("id, name").order("name"),
      seesAll ? demandsQuery : demandsQuery.eq("created_by", profile.id),
      supabase.from("user_roles").select("user_id, role").eq("role", "coordenador"),
    ]);
    if (projectsRes.data) setProjects(projectsRes.data as ProjectOption[]);
    if (usersRes.data) {
      setUsers(usersRes.data as UserOption[]);
      const coordIds = new Set((rolesRes.data ?? []).map((r: { user_id: string }) => r.user_id));
      setCoordenadores((usersRes.data as UserOption[]).filter((u) => coordIds.has(u.id)));
    }
    if (demandsRes.data) setDemands(demandsRes.data as unknown as Demand[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, seesAll]);

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name || "Projeto";

  const sortDemands = (list: Demand[]) => {
    return [...list].sort((a, b) => {
      if (a.is_done !== b.is_done) return a.is_done ? 1 : -1;
      const ap = a.priority ?? Number.POSITIVE_INFINITY;
      const bp = b.priority ?? Number.POSITIVE_INFINITY;
      if (ap !== bp) return ap - bp;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  };

  const filteredDemands = useMemo(() => {
    let base = filter === "all" ? demands : demands.filter((d) => d.demand_type === filter);
    if (projectFilter !== "all") base = base.filter((d) => d.project_id === projectFilter);
    if (userFilter !== "all") base = base.filter((d) => d.assigned_to === userFilter);
    return sortDemands(base);
  }, [demands, filter, projectFilter, userFilter]);

  const pendingCount = useMemo(() => demands.filter((d) => !d.is_done).length, [demands]);

  const handleToggle = async (demand: Demand, checked: boolean) => {
    if (!profile) return;
    const previous = demands;
    setDemands(
      demands.map((d) =>
        d.id === demand.id
          ? { ...d, is_done: checked, done_at: checked ? new Date().toISOString() : null }
          : d,
      ),
    );
    const { error } = await supabase
      .from("demands")
      .update({ is_done: checked, done_at: checked ? new Date().toISOString() : null })
      .eq("id", demand.id);
    if (error) {
      setDemands(previous);
      toast({
        title: "Não foi possível atualizar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleUpdatePriority = async (id: string, priority: number | null) => {
    const previous = demands;
    setDemands(demands.map((d) => (d.id === id ? { ...d, priority } : d)));
    const { error } = await supabase.from("demands").update({ priority }).eq("id", id);
    if (error) {
      setDemands(previous);
      toast({
        title: "Não foi possível atualizar a prioridade",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (demand: Demand) => {
    const previous = demands;
    setDemands(demands.filter((d) => d.id !== demand.id));
    const { error } = await supabase.from("demands").delete().eq("id", demand.id);
    if (error) {
      setDemands(previous);
      toast({
        title: "Não foi possível excluir a demanda",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Demanda excluída" });
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div
          className="animate-reveal-up flex items-start justify-between gap-4"
          style={{ animationFillMode: "backwards" }}
        >
          <div>
            <h1 className="text-2xl font-bold">Demandas</h1>
            <p className="text-muted-foreground mt-1">
              {pendingCount} {pendingCount === 1 ? "demanda pendente" : "demandas pendentes"}
            </p>
          </div>

          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Demanda
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter("all")}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
              filter === "all"
                ? "bg-foreground text-background border-foreground"
                : "bg-muted text-muted-foreground border-transparent hover:bg-muted/70",
            )}
          >
            Todos
          </button>
          {DEMAND_TYPES.map((t) => {
            const c = DEMAND_TYPE_COLORS[t];
            const active = filter === t;
            return (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium border transition-colors flex items-center gap-1.5",
                  active ? c.badge : "bg-muted text-muted-foreground border-transparent hover:bg-muted/70",
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />
                {DEMAND_TYPE_LABELS[t]}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 max-w-sm">
            <ProjectCombobox
              projects={[{ id: "all", name: "Todos os projetos" }, ...projects]}
              value={projectFilter}
              onValueChange={setProjectFilter}
              placeholder="Filtrar por projeto..."
            />
          </div>
          {projectFilter !== "all" && (
            <button
              onClick={() => setProjectFilter("all")}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Limpar
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 max-w-sm">
            <ProjectCombobox
              projects={[{ id: "all", name: "Todos os usuários" }, ...users]}
              value={userFilter}
              onValueChange={setUserFilter}
              placeholder="Filtrar por responsável..."
            />
          </div>
          {userFilter !== "all" && (
            <button
              onClick={() => setUserFilter("all")}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Limpar
            </button>
          )}
        </div>

        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : filteredDemands.length === 0 ? (
            <Card className="shadow-sm">
              <CardContent className="py-10 flex flex-col items-center text-center gap-2">
                <ClipboardCheck className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Nenhuma demanda registrada.</p>
              </CardContent>
            </Card>
          ) : (
            filteredDemands.map((demand, i) => {
              const canEdit = true;
              const c = DEMAND_TYPE_COLORS[demand.demand_type];
              const assignedName = demand.assigned_profile?.name;
              return (
                <Card
                  key={demand.id}
                  className="shadow-sm animate-reveal-up"
                  style={{ animationDelay: `${(i + 1) * 40}ms`, animationFillMode: "backwards" }}
                >
                  <CardContent className="flex items-start gap-3 py-4">
                    <div className="pt-1">
                      <Checkbox
                        checked={demand.is_done}
                        disabled={!canEdit}
                        onCheckedChange={(v) => handleToggle(demand, Boolean(v))}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border",
                          c.badge,
                        )}
                      >
                        {DEMAND_TYPE_LABELS[demand.demand_type]}
                      </span>
                      <p
                        className={cn(
                          "mt-1.5 text-sm",
                          demand.is_done
                            ? "line-through text-muted-foreground/60"
                            : "font-medium",
                        )}
                      >
                        {demand.description}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {projectName(demand.project_id)}
                      </p>
                      <div className="mt-2 flex items-center justify-between min-h-[20px]">
                        <PriorityCell
                          demand={demand}
                          canEdit={!!canEdit}
                          onUpdate={handleUpdatePriority}
                        />
                        {assignedName ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <User size={12} /> {assignedName}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(demand.created_at)}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={!canEdit}
                        onClick={() => setEditDemand(demand)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(demand)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        <DemandFormDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          projects={projects}
          users={users}
          onSaved={fetchAll}
        />
        <DemandFormDialog
          open={!!editDemand}
          onOpenChange={(o) => !o && setEditDemand(null)}
          projects={projects}
          users={users}
          demand={editDemand}
          onSaved={fetchAll}
        />

        <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir demanda?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. A demanda será removida permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deleteTarget) handleDelete(deleteTarget);
                  setDeleteTarget(null);
                }}
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
