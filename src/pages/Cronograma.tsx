import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ProjectCombobox } from "@/components/ProjectCombobox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { ChevronLeft, ChevronRight, CalendarRange, CalendarDays, Plus, Loader2, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { canEditAllCronograma } from "@/utils/permissions";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const WEEKDAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];

type EntryType = "trabalho" | "feriado" | "ferias" | "casual";

const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  trabalho: "Trabalho",
  feriado: "Feriado",
  ferias: "Férias",
  casual: "Casual",
};

const disciplineBorder = (d: string) => {
  const k = (d || "").toLowerCase();
  if (k.includes("estrut")) return "border-l-blue-500";
  if (k.includes("hidr")) return "border-l-emerald-500";
  if (k.includes("elétr") || k.includes("eletr")) return "border-l-amber-500";
  if (k.includes("funda")) return "border-l-purple-500";
  return "border-l-border";
};

interface Coordenador {
  id: string;
  name: string;
  discipline: string | null;
}

interface Allocation {
  id: string;
  coordenador_id: string;
  projetista_nome: string;
  date: string;
  entry_type: EntryType;
  label: string | null;
  project_id: string | null;
  notes: string | null;
  created_at?: string;
}

interface PersonOption {
  key: string;
  nome: string;
  coordenadorId: string;
  coordenadorNome: string;
  discipline: string;
}


// --- date helpers (pure YYYY-MM-DD, no timezone) ---
function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function mondayOf(ref: Date) {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const dow = d.getDay(); // 0=Sun
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d;
}
function addDays(d: Date, n: number) {
  const c = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  c.setDate(c.getDate() + n);
  return c;
}
const dd = (d: Date) => String(d.getDate()).padStart(2, "0");
const mm = (d: Date) => String(d.getMonth() + 1).padStart(2, "0");

export default function Cronograma() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const role = profile?.role ?? "projetista";
  const editAll = canEditAllCronograma(role);

  const [refDate, setRefDate] = useState(new Date());
  const [discipline, setDiscipline] = useState<string>("todas");
  const [editing, setEditing] = useState<{
    coordenadorId: string;
    projetista: string;
    date: string;
    allocation?: Allocation;
  } | null>(null);

  const [monthOpen, setMonthOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<PersonOption | null>(null);
  const [monthRef, setMonthRef] = useState(new Date());



  const weekStart = useMemo(() => mondayOf(refDate), [refDate]);
  const weekDays = useMemo(() => [0, 1, 2, 3, 4].map((i) => addDays(weekStart, i)), [weekStart]);
  const weekStartISO = toISO(weekDays[0]);
  const weekEndISO = toISO(weekDays[4]);

  const weekLabel = useMemo(() => {
    const a = weekDays[0];
    const b = weekDays[4];
    if (a.getMonth() === b.getMonth()) {
      return `${dd(a)} a ${dd(b)} de ${MONTHS[a.getMonth()]} de ${a.getFullYear()}`;
    }
    return `${dd(a)} de ${MONTHS[a.getMonth()]} a ${dd(b)} de ${MONTHS[b.getMonth()]} de ${b.getFullYear()}`;
  }, [weekDays]);

  // --- Coordenadores ---
  const { data: coordenadores = [], isLoading: loadingCoords } = useQuery({
    queryKey: ["cronograma-coordenadores"],
    queryFn: async (): Promise<Coordenador[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, discipline")
        .eq("is_coordenador", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Coordenador[];
    },
  });

  const disciplineOptions = useMemo(() => {
    const set = new Set<string>();
    coordenadores.forEach((c) => { if (c.discipline) set.add(c.discipline); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [coordenadores]);

  const filteredCoords = useMemo(
    () => (discipline === "todas" ? coordenadores : coordenadores.filter((c) => c.discipline === discipline)),
    [coordenadores, discipline]
  );
  const coordIds = useMemo(() => filteredCoords.map((c) => c.id), [filteredCoords]);

  // --- Roster ---
  const { data: roster = [], isLoading: loadingRoster } = useQuery({
    queryKey: ["cronograma-roster", coordIds],
    enabled: coordIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coordenador_projetistas")
        .select("coordenador_id, projetista_nome")
        .in("coordenador_id", coordIds);
      if (error) throw error;
      return (data ?? []) as { coordenador_id: string; projetista_nome: string }[];
    },
  });

  // --- Allocations ---
  const { data: allocations = [], isLoading: loadingAlloc } = useQuery({
    queryKey: ["cronograma-allocations", coordIds, weekStartISO],
    enabled: coordIds.length > 0,
    queryFn: async (): Promise<Allocation[]> => {
      const { data, error } = await supabase
        .from("schedule_allocations")
        .select("id, coordenador_id, projetista_nome, date, entry_type, label, project_id, notes, created_at")
        .in("coordenador_id", coordIds)
        .gte("date", weekStartISO)
        .lte("date", weekEndISO)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Allocation[];
    },
  });

  // --- Projects ---
  const { data: projects = [] } = useQuery({
    queryKey: ["cronograma-projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id, name, client").order("name");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string; client: string }[];
    },
  });

  // --- Todas as pessoas (para a visão mensal) ---
  const { data: allPeople = [] } = useQuery({
    queryKey: ["cronograma-all-people"],
    enabled: monthOpen,
    queryFn: async (): Promise<PersonOption[]> => {
      const [{ data: coords, error: e1 }, { data: rows, error: e2 }] = await Promise.all([
        supabase.from("profiles").select("id, name, discipline").eq("is_coordenador", true).order("name"),
        supabase.from("coordenador_projetistas").select("coordenador_id, projetista_nome"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      const coordList = (coords ?? []) as Coordenador[];
      const coordById = new Map(coordList.map((c) => [c.id, c]));
      const out: PersonOption[] = [];
      const seen = new Set<string>();
      const push = (nome: string, coordenadorId: string) => {
        const c = coordById.get(coordenadorId);
        if (!c) return;
        const key = `${coordenadorId}|${nome}`;
        if (seen.has(key)) return;
        seen.add(key);
        out.push({
          key,
          nome,
          coordenadorId,
          coordenadorNome: c.name,
          discipline: c.discipline || "",
        });
      };
      coordList.forEach((c) => push(c.name, c.id));
      ((rows ?? []) as { coordenador_id: string; projetista_nome: string }[]).forEach((r) =>
        push(r.projetista_nome, r.coordenador_id)
      );
      return out.sort((a, b) => a.nome.localeCompare(b.nome));
    },
  });

  // --- Semanas do mês (Seg-Sex) ---
  const monthYear = monthRef.getFullYear();
  const monthIndex = monthRef.getMonth();
  const monthWeeks = useMemo(() => {
    const first = new Date(monthYear, monthIndex, 1);
    const last = new Date(monthYear, monthIndex + 1, 0);
    const weeks: Date[][] = [];
    let cursor = mondayOf(first);
    while (cursor <= last) {
      weeks.push([0, 1, 2, 3, 4].map((i) => addDays(cursor, i)));
      cursor = addDays(cursor, 7);
    }
    return weeks;
  }, [monthYear, monthIndex]);

  const monthStartISO = toISO(new Date(monthYear, monthIndex, 1));
  const monthEndISO = toISO(new Date(monthYear, monthIndex + 1, 0));

  const { data: monthAllocations = [], isLoading: loadingMonth } = useQuery({
    queryKey: ["cronograma-allocations-mensal", selectedPerson?.coordenadorId, selectedPerson?.nome, monthYear, monthIndex],
    enabled: monthOpen && !!selectedPerson,
    queryFn: async (): Promise<Allocation[]> => {
      const { data, error } = await supabase
        .from("schedule_allocations")
        .select("id, coordenador_id, projetista_nome, date, entry_type, label, project_id, notes, created_at")
        .eq("coordenador_id", selectedPerson!.coordenadorId)
        .eq("projetista_nome", selectedPerson!.nome)
        .gte("date", monthStartISO)
        .lte("date", monthEndISO)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Allocation[];
    },
  });

  const monthAllocMap = useMemo(() => {
    const m = new Map<string, Allocation[]>();
    monthAllocations.forEach((a) => {
      const arr = m.get(a.date);
      if (arr) arr.push(a);
      else m.set(a.date, [a]);
    });
    return m;
  }, [monthAllocations]);



  const allocMap = useMemo(() => {
    const m = new Map<string, Allocation[]>();
    allocations.forEach((a) => {
      const k = `${a.coordenador_id}|${a.projetista_nome}|${a.date}`;
      const arr = m.get(k);
      if (arr) arr.push(a);
      else m.set(k, [a]);
    });
    return m;
  }, [allocations]);

  const rosterByCoord = useMemo(() => {
    const m = new Map<string, string[]>();
    filteredCoords.forEach((c) => {
      const names = roster.filter((r) => r.coordenador_id === c.id).map((r) => r.projetista_nome);
      const all = Array.from(new Set([c.name, ...names])).sort((a, b) => a.localeCompare(b));
      m.set(c.id, all);
    });
    return m;
  }, [filteredCoords, roster]);

  const canEditCoord = (coordenadorId: string) =>
    editAll || (role === "coordenador" && profile?.id === coordenadorId);

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      id?: string;
      coordenador_id: string;
      projetista_nome: string;
      date: string;
      entry_type: EntryType;
      label: string | null;
      project_id: string | null;
      notes: string | null;
    }) => {
      if (payload.id) {
        const { error } = await supabase
          .from("schedule_allocations")
          .update({
            entry_type: payload.entry_type,
            label: payload.label,
            project_id: payload.project_id,
            notes: payload.notes,
          })
          .eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("schedule_allocations").insert({
          coordenador_id: payload.coordenador_id,
          projetista_nome: payload.projetista_nome,
          date: payload.date,
          entry_type: payload.entry_type,
          label: payload.label,
          project_id: payload.project_id,
          notes: payload.notes,
          created_by: profile!.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cronograma-allocations"] });
      qc.invalidateQueries({ queryKey: ["cronograma-allocations-mensal"] });
      setEditing(null);
      toast.success("Alocação salva");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar alocação"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("schedule_allocations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cronograma-allocations"] });
      qc.invalidateQueries({ queryKey: ["cronograma-allocations-mensal"] });
      setEditing(null);
      toast.success("Alocação removida");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao remover alocação"),
  });

  const loading = loadingCoords || loadingRoster || loadingAlloc;

  return (
    <AppLayout>
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CalendarRange className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Cronograma de Execução</h1>
              <p className="text-sm text-muted-foreground">Alocação semanal da equipe</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={discipline} onValueChange={setDiscipline}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Disciplina" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as disciplinas</SelectItem>
                {disciplineOptions.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={() => setMonthOpen(true)}>
              <CalendarDays className="h-4 w-4 mr-2" />
              Ver mês do projetista
            </Button>



            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={() => setRefDate(addDays(weekStart, -7))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => setRefDate(new Date())}>Hoje</Button>
              <Button variant="outline" size="icon" onClick={() => setRefDate(addDays(weekStart, 7))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <span className="text-sm font-medium">{weekLabel}</span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
          </div>
        ) : filteredCoords.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
            Nenhum coordenador encontrado para a disciplina selecionada.
          </div>
        ) : (
          <div className="space-y-8">
            {filteredCoords.map((coord) => {
              const names = rosterByCoord.get(coord.id) ?? [];
              const editable = canEditCoord(coord.id);
              return (
                <section key={coord.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">{coord.name}</h2>
                    {coord.discipline && (
                      <span className="text-xs text-muted-foreground">{coord.discipline}</span>
                    )}
                  </div>

                  {names.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-sm text-center text-muted-foreground">
                      Nenhum projetista na equipe deste coordenador.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/50">
                            <th className="text-left p-3 w-[220px] font-medium">Projetista</th>
                            {weekDays.map((d, i) => (
                              <th key={i} className="text-left p-3 font-medium min-w-[180px]">
                                {WEEKDAYS[i]}{" "}
                                <span className="text-muted-foreground font-normal">{dd(d)}/{mm(d)}</span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {names.map((nome) => (
                            <tr key={nome} className="border-t align-top">
                              <td className="p-3 font-medium">{nome}</td>
                              {weekDays.map((d, i) => {
                                const iso = toISO(d);
                                const allocs = allocMap.get(`${coord.id}|${nome}|${iso}`) ?? [];
                                return (
                                  <td key={i} className="p-2 group">
                                    <Cell
                                      allocations={allocs}
                                      discipline={coord.discipline || ""}
                                      editable={editable}
                                      onOpen={(a) =>
                                        setEditing({
                                          coordenadorId: coord.id,
                                          projetista: nome,
                                          date: iso,
                                          allocation: a,
                                        })
                                      }
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={monthOpen} onOpenChange={setMonthOpen}>
        <DialogContent className="max-w-[1200px] w-[95vw] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Visão mensal do projetista
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2 max-w-[520px]">
              <Label>Projetista</Label>
              <PersonCombobox
                people={allPeople}
                value={selectedPerson?.key ?? ""}
                onSelect={(p) => setSelectedPerson(p)}
              />
            </div>

            {!selectedPerson ? (
              <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
                Selecione um projetista para visualizar o mês.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => setMonthRef(new Date(monthYear, monthIndex - 1, 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" onClick={() => setMonthRef(new Date())}>Hoje</Button>
                  <Button variant="outline" size="icon" onClick={() => setMonthRef(new Date(monthYear, monthIndex + 1, 1))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium ml-2">
                    {MONTHS[monthIndex]} de {monthYear}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {selectedPerson.nome}
                    {selectedPerson.discipline ? ` — ${selectedPerson.discipline}` : ""} (Coordenador: {selectedPerson.coordenadorNome})
                  </span>
                </div>

                {loadingMonth ? (
                  <div className="flex items-center justify-center py-20 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm table-fixed">
                      <thead>
                        <tr className="bg-muted/50">
                          {WEEKDAYS.map((w) => (
                            <th key={w} className="text-left p-3 font-medium min-w-[160px]">{w}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {monthWeeks.map((week, wi) => (
                          <tr key={wi} className="border-t align-top">
                            {week.map((d, di) => {
                              const inMonth = d.getMonth() === monthIndex && d.getFullYear() === monthYear;
                              if (!inMonth) {
                                return <td key={di} className="p-2 bg-muted/20" />;
                              }
                              const iso = toISO(d);
                              const allocs = monthAllocMap.get(iso) ?? [];
                              const editable =
                                editAll || (role === "coordenador" && profile?.id === selectedPerson.coordenadorId);
                              return (
                                <td key={di} className="p-2 group">
                                  <p className="text-[11px] text-muted-foreground mb-1">{dd(d)}/{mm(d)}</p>
                                  <Cell
                                    allocations={allocs}
                                    discipline={selectedPerson.discipline}
                                    editable={editable}
                                    onOpen={(a) =>
                                      setEditing({
                                        coordenadorId: selectedPerson.coordenadorId,
                                        projetista: selectedPerson.nome,
                                        date: iso,
                                        allocation: a,
                                      })
                                    }
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMonthOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



      {editing && (
        <AllocationDialog
          key={editing.allocation?.id ?? `new-${editing.coordenadorId}-${editing.projetista}-${editing.date}`}
          open
          onOpenChange={(o) => { if (!o) setEditing(null); }}
          projetista={editing.projetista}
          date={editing.date}
          allocation={editing.allocation}
          projects={projects}
          saving={saveMutation.isPending || deleteMutation.isPending}
          onSave={(values) =>
            saveMutation.mutate({
              id: editing.allocation?.id,
              coordenador_id: editing.coordenadorId,
              projetista_nome: editing.projetista,
              date: editing.date,
              ...values,
            })
          }
          onDelete={editing.allocation ? () => deleteMutation.mutate(editing.allocation!.id) : undefined}
        />
      )}
    </AppLayout>
  );
}

function cellClasses(alloc: Allocation | undefined, discipline: string) {
  if (!alloc) return "";
  switch (alloc.entry_type) {
    case "feriado":
      return "bg-red-500/10 text-red-700 dark:text-red-300 border-l-red-500";
    case "ferias":
      return "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-l-purple-500";
    case "casual":
      return "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-l-blue-500";
    default:
      return cn("bg-card", disciplineBorder(discipline));
  }
}

function displayLabel(alloc: Allocation) {
  if (alloc.label && alloc.label.trim()) return alloc.label;
  if (alloc.entry_type === "feriado") return "Feriado";
  if (alloc.entry_type === "ferias") return "Férias";
  if (alloc.entry_type === "casual") return "Casual";
  return "Trabalho";
}

function Cell({
  allocations, discipline, editable, onOpen,
}: {
  allocations: Allocation[];
  discipline: string;
  editable: boolean;
  onOpen: (allocation?: Allocation) => void;
}) {
  const addButton = editable ? (
    <button
      type="button"
      onClick={() => onOpen(undefined)}
      className={cn(
        "h-8 w-full rounded-md border border-dashed text-xs text-muted-foreground flex items-center justify-center gap-1 hover:bg-muted/50 transition-opacity",
        allocations.length === 0 && "h-12 opacity-0 group-hover:opacity-100"
      )}
    >
      <Plus className="h-3 w-3" /> adicionar
    </button>
  ) : null;

  if (allocations.length === 0) {
    if (!editable) return <div className="h-12" />;
    return addButton;
  }

  return (
    <div className="space-y-1">
      {allocations.map((allocation) => (
        <AllocationCard
          key={allocation.id}
          allocation={allocation}
          discipline={discipline}
          editable={editable}
          onOpen={() => onOpen(allocation)}
        />
      ))}
      {addButton}
    </div>
  );
}

function AllocationCard({
  allocation, discipline, editable, onOpen,
}: {
  allocation: Allocation;
  discipline: string;
  editable: boolean;
  onOpen: () => void;
}) {
  const content = (
    <div
      className={cn(
        "min-h-12 w-full rounded-md border border-l-4 p-2 text-left text-xs",
        cellClasses(allocation, discipline)
      )}
    >
      <p className="font-medium leading-snug break-words">{displayLabel(allocation)}</p>
      {allocation.notes && (
        <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{allocation.notes}</p>
      )}
    </div>
  );

  if (editable) {
    return (
      <button type="button" onClick={onOpen} className="w-full">
        {content}
      </button>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="w-full cursor-default">{content}</button>
      </PopoverTrigger>
      <PopoverContent className="w-64 text-sm space-y-1">
        <p className="font-medium">{displayLabel(allocation)}</p>
        <p className="text-xs text-muted-foreground">
          {ENTRY_TYPE_LABELS[allocation.entry_type]}
        </p>
        {allocation.notes && <p className="text-xs">{allocation.notes}</p>}
        <p className="text-[11px] text-muted-foreground pt-1">Somente leitura</p>
      </PopoverContent>
    </Popover>
  );
}

function AllocationDialog({
  open, onOpenChange, projetista, date, allocation, projects, saving, onSave, onDelete,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projetista: string;
  date: string;
  allocation?: Allocation;
  projects: { id: string; name: string; client: string }[];
  saving: boolean;
  onSave: (v: {
    entry_type: EntryType;
    label: string | null;
    project_id: string | null;
    notes: string | null;
  }) => void;
  onDelete?: () => void;
}) {
  const [entryType, setEntryType] = useState<EntryType>(allocation?.entry_type ?? "trabalho");
  const [projectId, setProjectId] = useState<string>(allocation?.project_id ?? "");
  const [label, setLabel] = useState<string>(allocation?.label ?? "");
  const [notes, setNotes] = useState<string>(allocation?.notes ?? "");

  const [y, m, d] = date.split("-");
  const showProject = entryType === "trabalho" || entryType === "casual";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            {projetista} — {d}/{m}/{y}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={entryType} onValueChange={(v) => setEntryType(v as EntryType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(ENTRY_TYPE_LABELS) as EntryType[]).map((t) => (
                  <SelectItem key={t} value={t}>{ENTRY_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showProject && (
            <div className="space-y-2">
              <Label>Projeto (opcional)</Label>
              <ProjectCombobox
                projects={projects}
                value={projectId}
                onValueChange={(v) => {
                  setProjectId(v);
                  const p = projects.find((pr) => pr.id === v);
                  if (p && !label.trim()) setLabel(p.name);
                }}
                placeholder="Vincular projeto"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Rótulo</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Texto exibido na célula"
            />
          </div>

          <div className="space-y-2">
            <Label>Observação</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <div>
            {onDelete && (
              <Button variant="destructive" onClick={onDelete} disabled={saving}>Excluir</Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            <Button
              onClick={() =>
                onSave({
                  entry_type: entryType,
                  label: label.trim() ? label.trim() : null,
                  project_id: showProject && projectId ? projectId : null,
                  notes: notes.trim() ? notes.trim() : null,
                })
              }
              disabled={saving}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PersonCombobox({
  people, value, onSelect,
}: {
  people: PersonOption[];
  value: string;
  onSelect: (p: PersonOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const norm = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const selected = people.find((p) => p.key === value);
  const filtered = useMemo(() => {
    if (!search) return people;
    const q = norm(search);
    return people.filter(
      (p) => norm(p.nome).includes(q) || norm(p.discipline).includes(q) || norm(p.coordenadorNome).includes(q)
    );
  }, [people, search]);

  const optionLabel = (p: PersonOption) =>
    `${p.nome}${p.discipline ? ` — ${p.discipline}` : ""} (Coordenador: ${p.coordenadorNome})`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", !selected && "text-muted-foreground")}
        >
          <span className="truncate flex-1 text-left">
            {selected ? optionLabel(selected) : "Selecionar projetista..."}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="min-w-[320px] max-w-[520px] w-max p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar pessoa..." value={search} onValueChange={setSearch} />
          <CommandList className="max-h-[340px]">
            <CommandEmpty>Nenhuma pessoa encontrada.</CommandEmpty>
            <CommandGroup>
              {filtered.map((p) => (
                <CommandItem
                  key={p.key}
                  value={p.key}
                  onSelect={() => {
                    onSelect(p);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4 shrink-0", value === p.key ? "opacity-100" : "opacity-0")} />
                  <div className="flex flex-col min-w-0">
                    <span className="whitespace-normal break-words leading-snug">{p.nome}</span>
                    <span className="text-xs text-muted-foreground whitespace-normal break-words">
                      {p.discipline || "Sem disciplina"} · Coordenador: {p.coordenadorNome}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
