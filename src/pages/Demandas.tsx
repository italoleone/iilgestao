import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { Plus, ClipboardCheck, Pencil } from "lucide-react";
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

interface Demand {
  id: string;
  project_id: string;
  demand_type: DemandType;
  description: string;
  created_by: string;
  is_done: boolean;
  done_at: string | null;
  created_at: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

interface DemandFormDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projects: ProjectOption[];
  demand?: Demand | null;
  onSaved: () => void;
}

function DemandFormDialog({ open, onOpenChange, projects, demand, onSaved }: DemandFormDialogProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const isEdit = !!demand;

  const [demandType, setDemandType] = useState<DemandType | "">("");
  const [projectId, setProjectId] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setDemandType(demand?.demand_type ?? "");
      setProjectId(demand?.project_id ?? "");
      setDescription(demand?.description ?? "");
    }
  }, [open, demand]);

  const handleSubmit = async () => {
    if (!profile || !demandType || !projectId || !description.trim()) return;
    setSubmitting(true);
    let error;
    if (isEdit && demand) {
      ({ error } = await supabase
        .from("demands")
        .update({
          demand_type: demandType,
          project_id: projectId,
          description: description.trim(),
        })
        .eq("id", demand.id));
    } else {
      ({ error } = await supabase.from("demands").insert({
        demand_type: demandType,
        project_id: projectId,
        description: description.trim(),
        created_by: profile.id,
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

export default function Demandas() {
  const { profile, isDiretorOrGerente, isPlanejamento } = useAuth();
  const { toast } = useToast();

  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [demands, setDemands] = useState<Demand[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editDemand, setEditDemand] = useState<Demand | null>(null);
  const [filter, setFilter] = useState<"all" | DemandType>("all");

  const seesAll = isDiretorOrGerente || isPlanejamento;

  const fetchAll = async () => {
    if (!profile) return;
    const [projectsRes, demandsRes] = await Promise.all([
      supabase.from("projects").select("id, name, status").order("name"),
      seesAll
        ? supabase.from("demands").select("*").order("created_at", { ascending: false })
        : supabase
            .from("demands")
            .select("*")
            .eq("created_by", profile.id)
            .order("created_at", { ascending: false }),
    ]);
    if (projectsRes.data) setProjects(projectsRes.data as ProjectOption[]);
    if (demandsRes.data) setDemands(demandsRes.data as Demand[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, seesAll]);

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name || "Projeto";

  const filteredDemands = useMemo(() => {
    const base = filter === "all" ? demands : demands.filter((d) => d.demand_type === filter);
    const pending = base.filter((d) => !d.is_done);
    const done = base.filter((d) => d.is_done);
    return [...pending, ...done];
  }, [demands, filter]);

  const pendingCount = useMemo(() => demands.filter((d) => !d.is_done).length, [demands]);

  const handleToggle = async (demand: Demand, checked: boolean) => {
    if (!profile || demand.created_by !== profile.id) return;
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
              const canEdit = profile?.id === demand.created_by;
              const c = DEMAND_TYPE_COLORS[demand.demand_type];
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
          onSaved={fetchAll}
        />
        <DemandFormDialog
          open={!!editDemand}
          onOpenChange={(o) => !o && setEditDemand(null)}
          projects={projects}
          demand={editDemand}
          onSaved={fetchAll}
        />
      </div>
    </AppLayout>
  );
}
