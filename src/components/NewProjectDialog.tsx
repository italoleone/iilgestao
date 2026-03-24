import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { STAGE_NAMES, DISCIPLINE_SHORT, type Discipline, type Project } from "@/types";
import { toast } from "sonner";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectsCreated: (projects: Project[]) => void;
}

export function NewProjectDialog({ open, onOpenChange, onProjectsCreated }: NewProjectDialogProps) {
  const [name, setName] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [clientValue, setClientValue] = useState("");
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [clients, setClients] = useState<string[]>([]);
  const [activeUsers, setActiveUsers] = useState<{ id: string; name: string }[]>([]);
  const [disciplines, setDisciplines] = useState<Record<Discipline, boolean>>({
    estrutural: false,
    hidraulica: false,
    eletrica: false,
  });
  const [startDate, setStartDate] = useState("");
  const [deadline, setDeadline] = useState("");
  const [responsible, setResponsible] = useState("");
  const [saleValues, setSaleValues] = useState<Record<Discipline, string>>({
    estrutural: "",
    hidraulica: "",
    eletrica: "",
  });

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
    setName("");
    setClientValue("");
    setClientSearch("");
    setDisciplines({ estrutural: false, hidraulica: false, eletrica: false });
    setStartDate("");
    setDeadline("");
    setResponsible("");
    setSaleValues({ estrutural: "", hidraulica: "", eletrica: "" });
  };

  const handleCreate = async () => {
    if (!name || !clientValue || selectedDisciplines.length === 0 || !startDate || !deadline || !responsible) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }

    for (const d of selectedDisciplines) {
      if (!saleValues[d] || Number(saleValues[d]) <= 0) {
        toast.error(`Informe o valor de venda para ${DISCIPLINE_SHORT[d]}.`);
        return;
      }
    }

    // Save new client if needed
    if (isNewClient) {
      await supabase.from("clients").insert({ name: clientValue });
    }

    const newProjects: Project[] = selectedDisciplines.map((disc, idx) => {
      const suffix = selectedDisciplines.length > 1 ? ` - ${DISCIPLINE_SHORT[disc]}` : "";
      return {
        id: `p${Date.now()}_${idx}`,
        name: `${name}${suffix}`,
        client: clientValue,
        discipline: disc,
        startDate,
        deadline,
        status: "em_andamento" as const,
        responsible,
        team: [responsible],
        hoursSold: 0,
        saleValue: Number(saleValues[disc]) || 0,
        hoursWorked: 0,
        stages: STAGE_NAMES.map((stageName, i) => ({
          id: `ns${Date.now()}_${idx}_${i}`,
          name: stageName,
          responsible,
          deadline,
          status: "pendente" as const,
          hoursSpent: 0,
        })),
        revisions: [],
      };
    });

    onProjectsCreated(newProjects);
    onOpenChange(false);
    resetForm();
    toast.success(
      newProjects.length > 1
        ? `${newProjects.length} projetos criados com sucesso!`
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
          {/* Nome */}
          <div className="space-y-2">
            <Label htmlFor="proj-name">Nome do Projeto *</Label>
            <Input id="proj-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Edifício Central Park" />
          </div>

          {/* Cliente Autocomplete */}
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
                  <CommandInput
                    placeholder="Buscar cliente..."
                    value={clientSearch}
                    onValueChange={(v) => {
                      setClientSearch(v);
                      setClientValue(v);
                    }}
                  />
                  <CommandList>
                    <CommandEmpty>
                      {clientSearch ? (
                        <button
                          className="w-full px-2 py-2 text-sm text-left hover:bg-accent rounded"
                          onClick={() => {
                            setClientValue(clientSearch);
                            setClientPopoverOpen(false);
                          }}
                        >
                          Criar novo: <strong>"{clientSearch}"</strong>
                        </button>
                      ) : (
                        "Nenhum cliente encontrado."
                      )}
                    </CommandEmpty>
                    <CommandGroup>
                      {filteredClients.map((c) => (
                        <CommandItem
                          key={c}
                          value={c}
                          onSelect={() => {
                            setClientValue(c);
                            setClientSearch("");
                            setClientPopoverOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", clientValue === c ? "opacity-100" : "opacity-0")} />
                          {c}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {isNewClient && (
              <p className="text-xs text-amber-600 dark:text-amber-400">Novo cliente será cadastrado automaticamente.</p>
            )}
          </div>

          {/* Disciplinas - Checkboxes */}
          <div className="space-y-2">
            <Label>Disciplinas e Valores *</Label>
            <div className="flex flex-col gap-3">
              {(["estrutural", "hidraulica", "eletrica"] as Discipline[]).map((d) => (
                <div key={d} className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer min-w-[120px]">
                    <Checkbox
                      checked={disciplines[d]}
                      onCheckedChange={(checked) =>
                        setDisciplines((prev) => ({ ...prev, [d]: !!checked }))
                      }
                    />
                    <span className="text-sm">{DISCIPLINE_SHORT[d]}</span>
                  </label>
                  {disciplines[d] && (
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                      <Input
                        type="number"
                        value={saleValues[d]}
                        onChange={(e) => setSaleValues((prev) => ({ ...prev, [d]: e.target.value }))}
                        placeholder="Valor do projeto"
                        className="pl-10"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
            {selectedDisciplines.length > 1 && (
              <p className="text-xs text-muted-foreground">
                Serão criados {selectedDisciplines.length} projetos separados, um para cada disciplina.
              </p>
          </div>

          {/* Datas */}
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

          {/* Responsável */}
          <div className="space-y-2">
            <Label>Responsável *</Label>
            <select
              value={responsible}
              onChange={(e) => setResponsible(e.target.value)}
              className="h-10 w-full rounded-md border bg-card px-3 text-sm"
            >
              <option value="">Selecione...</option>
              {activeUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); resetForm(); }}>Cancelar</Button>
          <Button onClick={handleCreate}>
            {selectedDisciplines.length > 1 ? `Criar ${selectedDisciplines.length} Projetos` : "Criar Projeto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
