import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { STAGE_NAMES, DISCIPLINE_SHORT, type Discipline } from "@/types";
import { parseBRL } from "@/lib/utils";
import { toast } from "sonner";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

const DEFAULT_TASKS_BY_DISCIPLINE: Record<string, Record<string, string[]>> = {
  estrutural: {
    "Estudo Preliminar": ["Recebimento da Arquitetura em EP + Normas do Condomínio","Kick-off Interno do Projeto + Cronograma Interno","Elaboração da Modelagem","Checklist da Modelagem","Elaboração das Formas","Checklist das Formas","Gerar IFC","Enviar arvore para TQS.CON","Envio do projeto para o cliente"],
    "Anteprojeto": ["Recebimento da Arquitetura/Comentários do EP","Validação dos Comentários","Validação do cronograma Externo/Interno","Atender/Incorporar comentários/arquitetura no Modelo","Elaboração das Formas","Checklist das Formas","Compatibilizar com projeto de Hidráulica/Eletrica/Bombeiro","Gerar IFC","Enviar arvore para TQS.CON","Envio do projeto para o cliente"],
    "Pré-executivo": ["Recebimento da Arquitetura/Comentários do AP","Validar comentários","Validar Cronograma Externo/Interno","Atender/Incorporar Comentários/Arquitetura no Modelo","Elaboração das Formas","Checklist das Formas","Compatibilizar com projeto de Hidráulica/Eletrica/Bombeiro","Gerar IFC","Enviar arvore para TQS.CON","Enviar para o cliente"],
    "Executivo": ["Recebimento da Arquitetura/Comentários do PR","Validar comentários","Validar Cronograma Externo/Interno","Atender/Incorporar Comentários/Arquitetura no Modelo","Compatibilizar com projeto de Hidráulica/Eletrica/Bombeiro","Elaboração das Formas","Checklist das Formas","Elaboração das Armações","Checklist das Armações","Elaboração folha Markup","Elaboração da Furação","Gerar IFC","Enviar arvore para TQS.CON","Enviar para o Cliente"],
    "Liberação para Obra": ["Recebimento da Arquitetura/Comentários do EX","Validar comentários","Validar Cronograma Externo/Interno","Atender/Incorporar Comentários/Arquitetura de Forma","Checklist da Forma","Atender/Incorporar Comentários/Arquitetura de Armação","Checklist da Armação","Compatibilizar com projeto de Hidráulica/Eletrica/Bombeiro","Revisão da Furação","Gerar IFC","Enviar arvore para TQS.CON","Enviar para o Cliente"],
    "Revisão": ["Revisão 01","Revisão 02","Revisão 03"],
  },
  hidraulica: {
    "Estudo Preliminar": ["Recebimento da Arquitetura em EP + Normas do Condomínio","Briefing/Kickoff com Cliente","Kick-off Interno do Projeto + Cronograma Interno","Elaboração do Projeto","Checklist do Projeto","Compatibilizar com projeto de Estrutura/Eletrica/Bombeiro","Gerar IFC","Envio do projeto para o cliente"],
    "Anteprojeto": ["Recebimento da Arquitetura/Comentários do EP","Validação dos Comentários","Validação do cronograma Externo/Interno","Atender/Incorporar comentários/arquitetura","Elaboração do Projeto","Checklist do Projeto","Compatibilizar com projeto de Estrutura/Eletrica/Bombeiro","Gerar IFC","Projeto de PPCI e Protocolo junto ao CB","Envio do projeto para o cliente"],
    "Pré-executivo": ["Recebimento da Arquitetura/Comentários do AP","Validar comentários","Validar Cronograma Externo/Interno","Atender/Incorporar Comentários/Arquitetura no Modelo","Elaboração do Projeto","Checklist do Projeto","Elaboração do Markup","Compatibilizar com projeto de Estrutura/Eletrica/Bombeiro","Gerar IFC","Projeto de PPCI e Protocolo junto ao CB","Enviar para o cliente"],
    "Executivo": ["Recebimento da Arquitetura/Comentários do PR","Validar comentários","Validar Cronograma Externo/Interno","Atender/Incorporar Comentários/Arquitetura","Elaboração da Modelagem","Checklist da Modelagem","Elaboração dos Detalhamentos","Checklist dos Detalhamentos","Elaboração da Implantação/Anexos","Checklist da Implantação/Anexos","Compatibilizar com projeto de Estrutura/Eletrica/Bombeiro","Elaboração folha Markup","Gerar IFC","Projeto de PPCI e Protocolo junto ao CB","Enviar para o Cliente"],
    "Liberação para Obra": ["Recebimento da Arquitetura/Comentários do PR","Validar comentários","Validar Cronograma Externo/Interno","Atender/Incorporar Comentários/Arquitetura","Revisar Modelagem","Checklist da Modelagem","Revisar Detalhamentos","Checklist dos Detalhamentos","Revisar Implantação/Anexos","Checklist da Implantação/Anexos","Compatibilizar com projeto de Estrutura/Eletrica/Bombeiro","Gerar IFC","Revisar Projeto de PPCI e Protocolo junto ao CB","Enviar para o Cliente"],
    "Revisão": ["Revisão 01","Revisão 02","Revisão 03"],
  },
  eletrica: {
    "Estudo Preliminar": ["Recebimento da Arquitetura em EP + Normas do Condomínio","Briefing/Kickoff com Cliente","Kick-off Interno do Projeto + Cronograma Interno","Elaboração do Projeto","Checklist do Projeto","Compatibilizar com projeto de Estrutura/Hidráulica/Bombeiro","Gerar IFC","Envio do projeto para o cliente"],
    "Anteprojeto": ["Recebimento da Arquitetura/Comentários do EP","Validação dos Comentários","Validação do cronograma Externo/Interno","Atender/Incorporar comentários/arquitetura","Elaboração do Projeto","Checklist do Projeto","Compatibilizar com projeto de Estrutura/Hidráulica/Bombeiro","Gerar IFC","Envio do projeto para o cliente"],
    "Pré-executivo": ["Recebimento da Arquitetura/Comentários do AP","Validar comentários","Validar Cronograma Externo/Interno","Atender/Incorporar Comentários/Arquitetura","Elaboração da Modelagem","Checklist da Modelagem","Compatibilizar com projeto de Estrutura/Hidráulica/Bombeiro","Elaboração do Markup","Gerar IFC","Enviar para o cliente"],
    "Executivo": ["Recebimento da Arquitetura/Comentários do PR","Validar comentários","Validar Cronograma Externo/Interno","Atender/Incorporar Comentários/Arquitetura","Elaboração dos Detalhamentos","Checklist dos Detalhamentos","Elaboração da Implantação/Anexos","Checklist da Implantação/Anexos","Elaboração da Entrada de Energia","Elaboração do SPDA","Compatibilizar com projeto de Estrutura/Hidráulica/Bombeiro","Elaboração folha Markup","Gerar IFC","Enviar para o Cliente"],
    "Liberação para Obra": ["Recebimento da Arquitetura/Comentários do PR","Validar comentários","Validar Cronograma Externo/Interno","Atender/Incorporar Comentários/Arquitetura","Revisar Detalhamentos","Checklist dos Detalhamentos","Revisar Implantação/Anexos","Checklist da Implantação/Anexos","Compatibilizar com projeto de Estrutura/Hidráulica/Bombeiro","Revisar folha Markup","Gerar IFC","Enviar para o Cliente"],
    "Revisão": ["Revisão 01","Revisão 02","Revisão 03"],
  },
  fundacoes: {
    "Estudo Preliminar": [],
    "Anteprojeto": [],
    "Pré-executivo": [],
    "Executivo": [],
    "Liberação para Obra": [],
    "Revisão": ["Revisão 01","Revisão 02","Revisão 03"],
  },
};

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectsCreated: () => void;
}

export function NewProjectDialog({ open, onOpenChange, onProjectsCreated }: NewProjectDialogProps) {
  const [name, setName] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [clientValue, setClientValue] = useState("");
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [clients, setClients] = useState<string[]>([]);
  const [activeUsers, setActiveUsers] = useState<{ id: string; name: string }[]>([]);
  const [disciplines, setDisciplines] = useState<Record<Discipline, boolean>>({
    estrutural: false, hidraulica: false, eletrica: false,
  });
  const [startDate, setStartDate] = useState("");
  const [deadline, setDeadline] = useState("");
  const [coordinators, setCoordinators] = useState<Record<Discipline, string>>({
    estrutural: "", hidraulica: "", eletrica: "",
  });
  const [saleValues, setSaleValues] = useState<Record<Discipline, string>>({
    estrutural: "", hidraulica: "", eletrica: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      supabase.from("clients").select("name").order("name").then(({ data }) => {
        if (data) setClients(data.map((c) => c.name));
      });
      supabase.from("profiles").select("id, name").eq("status", "active").order("name").then(({ data }) => {
        if (data) setActiveUsers(data.map((u) => ({ id: u.id, name: u.name })));
      });
    }
  }, [open]);

  const selectedDisciplines = (Object.keys(disciplines) as Discipline[]).filter((d) => disciplines[d]);

  const filteredClients = useMemo(() => {
    if (!clientSearch) return clients;
    return clients.filter((c) => c.toLowerCase().includes(clientSearch.toLowerCase()));
  }, [clients, clientSearch]);

  const isNewClient = clientValue && !clients.some((c) => c.toLowerCase() === clientValue.toLowerCase());

  const resetForm = () => {
    setName(""); setClientValue(""); setClientSearch("");
    setDisciplines({ estrutural: false, hidraulica: false, eletrica: false });
    setStartDate(""); setDeadline("");
    setCoordinators({ estrutural: "", hidraulica: "", eletrica: "" });
    setSaleValues({ estrutural: "", hidraulica: "", eletrica: "" });
  };

  const handleCreate = async () => {
    if (!name || !clientValue || selectedDisciplines.length === 0 || !startDate || !deadline) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    for (const d of selectedDisciplines) {
      if (!coordinators[d]) {
        toast.error(`Selecione o coordenador de ${DISCIPLINE_SHORT[d]}.`);
        return;
      }
      if (!saleValues[d] || parseBRL(saleValues[d]) <= 0) {
        toast.error(`Informe o valor de venda para ${DISCIPLINE_SHORT[d]}.`);
        return;
      }
    }

    setSaving(true);

    // Save new client if needed
    if (isNewClient) {
      await supabase.from("clients").insert({ name: clientValue });
    }

    // stages are now created inline per discipline in projectRows

    const projectRows = selectedDisciplines.map((disc) => {
      const suffix = selectedDisciplines.length > 1 ? ` - ${DISCIPLINE_SHORT[disc]}` : "";
      const coord = coordinators[disc];
      return {
        name: `${name}${suffix}`,
        client: clientValue,
        discipline: disc,
        start_date: startDate,
        deadline,
        status: "em_andamento",
        responsible: coord,
        team: [coord],
        hours_sold: 0,
        sale_value: parseBRL(saleValues[disc]),
        hours_worked: 0,
        stages: STAGE_NAMES.map((stageName, i) => ({
          id: `s_${Date.now()}_${disc}_${i}`,
          name: stageName,
          responsible: coord,
          deadline,
          status: "pendente",
          hoursSpent: 0,
        })),
        revisions: [],
      };
    });

    const { data: insertedProjects, error } = await supabase.from("projects").insert(projectRows).select("id, discipline, responsible, start_date, deadline");

    if (error) {
      setSaving(false);
      toast.error("Erro ao criar projeto: " + error.message);
      return;
    }

    // Auto-create default tasks for each project
    if (insertedProjects && insertedProjects.length > 0) {
      const taskRows = insertedProjects.flatMap((proj: any) => {
        const discTasks = DEFAULT_TASKS_BY_DISCIPLINE[proj.discipline] || {};
        return STAGE_NAMES.flatMap((stageName) =>
          (discTasks[stageName] || []).map((taskName: string) => ({
            name: taskName,
            project_id: proj.id,
            discipline: proj.discipline,
            stage_name: stageName,
            estimated_hours: 0,
            hours_worked: 0,
            status: "nao_iniciada",
          }))
        );
      });

      if (taskRows.length > 0) {
        await supabase.from("tasks").insert(taskRows as any);
      }
    }

    setSaving(false);
    onProjectsCreated();
    onOpenChange(false);
    resetForm();
    toast.success(
      projectRows.length > 1
        ? `${projectRows.length} projetos criados com sucesso!`
        : "Projeto criado com sucesso!"
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Projeto</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="proj-name">Nome do Projeto *</Label>
            <Input id="proj-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Edifício Central Park" />
          </div>

          <div className="space-y-2">
            <Label>Cliente *</Label>
            <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                  {clientValue || "Selecionar ou digitar cliente..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar cliente..." value={clientSearch} onValueChange={(v) => { setClientSearch(v); setClientValue(v); }} />
                  <CommandList>
                    <CommandEmpty>
                      {clientSearch ? (
                        <button className="w-full px-2 py-2 text-sm text-left hover:bg-accent rounded" onClick={() => { setClientValue(clientSearch); setClientPopoverOpen(false); }}>
                          Criar novo: <strong>&quot;{clientSearch}&quot;</strong>
                        </button>
                      ) : "Nenhum cliente encontrado."}
                    </CommandEmpty>
                    <CommandGroup>
                      {filteredClients.map((c) => (
                        <CommandItem key={c} value={c} onSelect={() => { setClientValue(c); setClientSearch(""); setClientPopoverOpen(false); }}>
                          <Check className={cn("mr-2 h-4 w-4", clientValue === c ? "opacity-100" : "opacity-0")} />
                          {c}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {isNewClient && <p className="text-xs text-warning">Novo cliente será cadastrado automaticamente.</p>}
          </div>

          <div className="space-y-2">
            <Label>Disciplinas, Coordenador e Valor *</Label>
            <div className="flex flex-col gap-4">
              {(["estrutural", "hidraulica", "eletrica"] as Discipline[]).map((d) => (
                <div key={d} className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={disciplines[d]} onCheckedChange={(checked) => setDisciplines((prev) => ({ ...prev, [d]: !!checked }))} />
                    <span className="text-sm font-medium">{DISCIPLINE_SHORT[d]}</span>
                  </label>
                  {disciplines[d] && (
                    <div className="grid grid-cols-2 gap-3 pl-6">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Coordenador {DISCIPLINE_SHORT[d]} *</Label>
                        <select value={coordinators[d]} onChange={(e) => setCoordinators((prev) => ({ ...prev, [d]: e.target.value }))} className="h-10 w-full rounded-md border bg-card px-3 text-sm">
                          <option value="">Selecione...</option>
                          {activeUsers.map((u) => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Valor do Projeto (R$) *</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                          <Input type="text" inputMode="decimal" value={saleValues[d]} onChange={(e) => setSaleValues((prev) => ({ ...prev, [d]: e.target.value }))} placeholder="Ex: 12.050,89" className="pl-10" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {selectedDisciplines.length > 1 && (
              <p className="text-xs text-muted-foreground">Serão criados {selectedDisciplines.length} projetos separados, cada um com seu coordenador.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="proj-start">Data de Início *</Label>
              <Input id="proj-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proj-deadline">Data Final *</Label>
              <Input id="proj-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); resetForm(); }}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? "Salvando..." : selectedDisciplines.length > 1 ? `Criar ${selectedDisciplines.length} Projetos` : "Criar Projeto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
