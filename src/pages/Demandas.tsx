import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { ProjectCombobox } from "@/components/ProjectCombobox";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, ClipboardCheck } from "lucide-react";

interface ProjectOption {
  id: string;
  name: string;
  status?: string;
}

interface Demand {
  id: string;
  project_id: string;
  description: string;
  created_by: string;
  is_done: boolean;
  done_at: string | null;
  created_at: string;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR");
}

export default function Demandas() {
  const { profile, isDiretorOrGerente, isPlanejamento } = useAuth();
  const { toast } = useToast();

  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [demands, setDemands] = useState<Demand[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [formProject, setFormProject] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  const sortedDemands = useMemo(() => {
    const pending = demands.filter((d) => !d.is_done);
    const done = demands.filter((d) => d.is_done);
    return [...pending, ...done];
  }, [demands]);

  const pendingCount = useMemo(() => demands.filter((d) => !d.is_done).length, [demands]);

  const resetForm = () => {
    setFormProject("");
    setFormDescription("");
  };

  const handleCreate = async () => {
    if (!profile || !formProject || !formDescription.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("demands").insert({
      project_id: formProject,
      description: formDescription.trim(),
      created_by: profile.id,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Erro ao criar demanda", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Demanda criada com sucesso" });
    setDialogOpen(false);
    resetForm();
    fetchAll();
  };

  const handleToggle = async (demand: Demand, checked: boolean) => {
    if (!profile || demand.created_by !== profile.id) return;
    const previous = demands;
    const optimistic = demands.map((d) =>
      d.id === demand.id
        ? { ...d, is_done: checked, done_at: checked ? new Date().toISOString() : null }
        : d
    );
    setDemands(optimistic);
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

          <Dialog
            open={dialogOpen}
            onOpenChange={(o) => {
              setDialogOpen(o);
              if (!o) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Demanda
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Demanda</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Projeto</Label>
                  <ProjectCombobox
                    projects={projects.filter((p) => p.status !== "concluido")}
                    value={formProject}
                    onValueChange={setFormProject}
                    placeholder="Selecionar projeto..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea
                    placeholder="Ex: Fazer furação do TIPO X"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    rows={4}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleCreate}
                  disabled={!formProject || !formDescription.trim() || submitting}
                >
                  {submitting ? "Criando..." : "Criar Demanda"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : sortedDemands.length === 0 ? (
            <Card className="shadow-sm">
              <CardContent className="py-10 flex flex-col items-center text-center gap-2">
                <ClipboardCheck className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Nenhuma demanda registrada.</p>
              </CardContent>
            </Card>
          ) : (
            sortedDemands.map((demand, i) => {
              const canToggle = profile?.id === demand.created_by;
              return (
                <Card
                  key={demand.id}
                  className="shadow-sm animate-reveal-up"
                  style={{
                    animationDelay: `${(i + 1) * 40}ms`,
                    animationFillMode: "backwards",
                  }}
                >
                  <CardContent className="flex items-start gap-3 py-4">
                    <div className="pt-0.5">
                      <Checkbox
                        checked={demand.is_done}
                        disabled={!canToggle}
                        onCheckedChange={(c) => handleToggle(demand, Boolean(c))}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={
                          demand.is_done
                            ? "text-sm line-through text-muted-foreground/60"
                            : "text-sm font-medium"
                        }
                      >
                        {demand.description}
                      </p>
                      <div className="mt-1.5">
                        <Badge variant="secondary" className="text-xs font-normal">
                          {projectName(demand.project_id)}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0">
                      {formatDate(demand.created_at)}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </AppLayout>
  );
}
