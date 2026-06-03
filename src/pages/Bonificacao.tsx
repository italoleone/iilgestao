import { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Award, ChevronRight, TrendingUp, TrendingDown, Minus, Settings, Search } from "lucide-react";
import { toast } from "sonner";

interface BonusConfig {
  id?: string;
  year: number;
  working_days_total: number;
  working_days_after_discounts: number;
  target_days: number;
  start_date: string;
  end_date: string;
}

interface BonusSalary {
  id?: string;
  user_id: string;
  year: number;
  gross_salary: number;
}

interface Profile {
  id: string;
  name: string;
  role: string;
  discipline: string | null;
  status: string;
}

interface TaskRow {
  id: string;
  name: string;
  project_name: string;
  estimated_hours: number;
  hours_worked: number;
  status: string;
  stage_name: string;
  isPending: boolean;
}

interface CollaboratorResult {
  profile: Profile;
  salary: number;
  realDays: number;
  pendingDays: number;
  projectedDays: number;
  availableDays: number;
  feasible: "ok" | "warning" | "impossible";
  totalTasks: number;
  lateTasks: number;
  onTimePct: number;
  criterion60: number;
  criterion40: number;
  totalBonus: number;
  bonusPct: number;
  tasks: TaskRow[];
}

const HOURS_PER_DAY = 8;

const ROLE_LABELS: Record<string, string> = {
  admin_geral: "Diretor",
  admin: "Gerente",
  planejamento: "Planejamento",
  coordenador: "Coordenador",
  projetista: "Projetista",
};

const DISCIPLINE_LABELS: Record<string, string> = {
  estrutural: "Estrutural",
  hidraulica: "Hidráulica",
  eletrica: "Elétrica",
};

const STATUS_FINAL = ["concluida", "aprovada", "enviado_cliente"];
const STATUS_PENDING = ["nao_iniciada", "em_andamento", "pausada", "aguardando_validacao", "reprovada"];

function roundDec(n: number, dec = 2): number {
  return Math.round(n * 10 ** dec) / 10 ** dec;
}

function pctColor(pct: number): string {
  if (pct >= 100) return "text-emerald-600";
  if (pct >= 80) return "text-amber-600";
  return "text-red-600";
}

function pctBadge(pct: number): string {
  if (pct >= 100) return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (pct >= 80) return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-red-100 text-red-700 border-red-200";
}

function taskSaldoBadge(estimated: number, worked: number) {
  if (worked <= 0) return null;
  const diff = estimated - worked;
  if (diff > 0) return { label: `−${roundDec(diff / HOURS_PER_DAY)}d`, style: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: "adiantado" as const };
  if (diff < 0) return { label: `+${roundDec(Math.abs(diff) / HOURS_PER_DAY)}d`, style: "bg-red-100 text-red-700 border-red-200", icon: "atrasado" as const };
  return { label: "no prazo", style: "bg-slate-100 text-slate-600 border-slate-200", icon: "no prazo" as const };
}

function feasibilityConfig(f: "ok" | "warning" | "impossible") {
  if (f === "ok") return {
    label: "Bônus viável",
    sublabel: "Ainda há dias disponíveis",
    badgeClass: "bg-emerald-100 text-emerald-700 border-emerald-200",
    dotClass: "bg-emerald-500",
  };
  if (f === "warning") return {
    label: "No limite",
    sublabel: "Sem folga, qualquer atraso perde o bônus",
    badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
    dotClass: "bg-amber-500",
  };
  return {
    label: "Bônus inviável",
    sublabel: "Dias insuficientes para concluir as tarefas",
    badgeClass: "bg-red-100 text-red-700 border-red-200",
    dotClass: "bg-red-500",
  };
}

export default function Bonificacao() {
  const { profile: authProfile } = useAuth();

  const [config, setConfig] = useState<BonusConfig | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [salaries, setSalaries] = useState<BonusSalary[]>([]);
  const [allTasks, setAllTasks] = useState<(TaskRow & { responsible: string })[]>([]);
  const [, setProjects] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [configOpen, setConfigOpen] = useState(false);
  const [configDraft, setConfigDraft] = useState<Partial<BonusConfig>>({});

  const [salaryOpen, setSalaryOpen] = useState(false);
  const [salaryDraft, setSalaryDraft] = useState<{ userId: string; name: string; value: string }>({ userId: "", name: "", value: "" });

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailCollab, setDetailCollab] = useState<CollaboratorResult | null>(null);

  const canEdit = authProfile?.role === "admin_geral" || authProfile?.role === "admin";
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [configRes, profilesRes, rolesRes, salariesRes, tasksRes, projectsRes] = await Promise.all([
        supabase.from("bonus_config").select("*").eq("year", currentYear).maybeSingle(),
        supabase.from("profiles").select("id, name, discipline, status").eq("status", "active"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("bonus_salary").select("*").eq("year", currentYear),
        supabase.from("tasks").select("id, name, project_id, estimated_hours, hours_worked, status, stage_name, responsible").in("status", STATUS_FINAL),
        supabase.from("projects").select("id, name"),
      ]);

      if (configRes.data) setConfig(configRes.data as unknown as BonusConfig);
      if (profilesRes.data) {
        const rolesMap: Record<string, string> = {};
        (rolesRes.data || []).forEach((r: { user_id: string; role: string }) => {
          rolesMap[r.user_id] = r.role;
        });
        const mapped = (profilesRes.data as Array<{
          id: string; name: string; discipline: string | null; status: string;
        }>).map((p) => ({
          id: p.id,
          name: p.name,
          discipline: p.discipline,
          status: p.status,
          role: rolesMap[p.id] ?? "projetista",
        }));
        setProfiles(mapped);
      }
      if (salariesRes.data) setSalaries(salariesRes.data as unknown as BonusSalary[]);

      const projMap: Record<string, string> = {};
      (projectsRes.data || []).forEach((p: { id: string; name: string }) => { projMap[p.id] = p.name; });
      setProjects(projMap);

      const tasks = (tasksRes.data || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        project_name: projMap[t.project_id] || "—",
        estimated_hours: Number(t.estimated_hours) || 0,
        hours_worked: Number(t.hours_worked) || 0,
        status: t.status,
        stage_name: t.stage_name,
        responsible: t.responsible || "",
      }));
      setAllTasks(tasks);
    } catch {
      toast.error("Erro ao carregar dados de bonificação");
    } finally {
      setLoading(false);
    }
  }

  const results: CollaboratorResult[] = useMemo(() => {
    if (!config) return [];
    const potentialExtra = config.working_days_after_discounts - config.target_days;

    return profiles.map((p) => {
      const sal = salaries.find((s) => s.user_id === p.id);
      const salary = sal?.gross_salary || 0;
      const myTasks = allTasks.filter((t) => t.responsible === p.id);

      const totalHoursWorked = myTasks.reduce((acc, t) => acc + (t.hours_worked || 0), 0);
      const realDays = roundDec(totalHoursWorked / HOURS_PER_DAY);
      const extraDays = roundDec(realDays - config.target_days);
      const bonusDays = Math.max(0, Math.min(extraDays, potentialExtra));

      const dayBonusValue = potentialExtra > 0 ? roundDec(salary / potentialExtra) : 0;

      const criterion60 = realDays >= config.target_days
        ? roundDec(bonusDays * dayBonusValue * 0.6)
        : 0;

      const totalTasks = myTasks.length;
      const lateTasks = myTasks.filter((t) => t.hours_worked > t.estimated_hours).length;
      const onTimePct = totalTasks > 0 ? (totalTasks - lateTasks) / totalTasks : 1;
      const criterion40 = roundDec(salary * onTimePct * 0.4);

      const totalBonus = roundDec(criterion60 + criterion40);
      const bonusPct = salary > 0 ? roundDec((totalBonus / salary) * 100) : 0;

      const tasks: TaskRow[] = myTasks.map((t) => ({
        id: t.id,
        name: t.name,
        project_name: t.project_name,
        estimated_hours: t.estimated_hours,
        hours_worked: t.hours_worked,
        status: t.status,
        stage_name: t.stage_name,
      }));

      return {
        profile: p,
        salary,
        realDays,
        extraDays,
        dayBonusValue,
        bonusDays,
        totalTasks,
        lateTasks,
        onTimePct: roundDec(onTimePct * 100),
        criterion60,
        criterion40,
        totalBonus,
        bonusPct,
        tasks,
      };
    });
  }, [config, profiles, salaries, allTasks]);

  const filtered = useMemo(
    () => results.filter((r) => r.profile.name.toLowerCase().includes(search.toLowerCase())),
    [results, search]
  );

  async function saveConfig() {
    if (!configDraft.year) return;
    const payload = {
      year: configDraft.year,
      working_days_total: configDraft.working_days_total ?? 0,
      working_days_after_discounts: configDraft.working_days_after_discounts ?? 0,
      target_days: configDraft.target_days ?? 0,
      start_date: configDraft.start_date ?? "",
      end_date: configDraft.end_date ?? "",
    };
    const { error } = await supabase.from("bonus_config").upsert(payload, { onConflict: "year" });
    if (error) { toast.error("Erro ao salvar configuração"); return; }
    toast.success("Configuração salva");
    setConfigOpen(false);
    loadAll();
  }

  async function saveSalary() {
    if (!salaryDraft.userId) return;
    const value = parseFloat(salaryDraft.value.replace(",", "."));
    if (isNaN(value) || value <= 0) { toast.error("Valor inválido"); return; }
    const { error } = await supabase.from("bonus_salary").upsert(
      { user_id: salaryDraft.userId, year: currentYear, gross_salary: value },
      { onConflict: "user_id,year" }
    );
    if (error) { toast.error("Erro ao salvar salário"); return; }
    toast.success("Salário salvo");
    setSalaryOpen(false);
    loadAll();
  }

  function openDetail(r: CollaboratorResult) {
    setDetailCollab(r);
    setDetailOpen(true);
  }

  function openSalaryEdit(userId: string, name: string) {
    const existing = salaries.find((s) => s.user_id === userId);
    setSalaryDraft({ userId, name, value: existing ? String(existing.gross_salary) : "" });
    setSalaryOpen(true);
  }

  const fmt = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDays = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  if (loading) {
    return (
      <AppLayout>
        <div className="p-8">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Award className="h-6 w-6" /> Bonificação {currentYear}
            </h1>
            {config && (
              <p className="text-sm text-muted-foreground mt-1">
                Meta: {config.target_days} dias · Período: {config.working_days_after_discounts} dias úteis disponíveis
              </p>
            )}
          </div>
          {canEdit && (
            <Button variant="outline" onClick={() => { setConfigDraft(config || { year: currentYear }); setConfigOpen(true); }}>
              <Settings className="h-4 w-4 mr-2" /> Configurar programa
            </Button>
          )}
        </div>

        {!config && (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Nenhuma configuração encontrada para {currentYear}. {canEdit ? 'Clique em "Configurar programa" para definir os parâmetros.' : "Aguarde a configuração pelo administrador."}
            </CardContent>
          </Card>
        )}

        <div className="relative max-w-sm">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar colaborador..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((r) => (
            <Card key={r.profile.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openDetail(r)}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-base truncate">{r.profile.name}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {ROLE_LABELS[r.profile.role] || r.profile.role}
                      {r.profile.discipline ? ` · ${DISCIPLINE_LABELS[r.profile.discipline] || r.profile.discipline}` : ""}
                    </p>
                  </div>
                  <Badge variant="outline" className={pctBadge(r.bonusPct)}>
                    {fmt(r.bonusPct)}%
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Progresso da meta</span>
                    <span>{fmtDays(r.realDays)}d / {config?.target_days ?? "—"}d mín.</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${r.bonusPct >= 100 ? "bg-emerald-500" : r.bonusPct >= 80 ? "bg-amber-500" : "bg-red-500"}`}
                      style={{ width: `${Math.min(r.bonusPct * (100 / 120), 100)}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Dias reais</p>
                    <p className="text-sm font-semibold">{fmtDays(r.realDays)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Atrasos</p>
                    <p className={`text-sm font-semibold ${r.lateTasks > 0 ? "text-red-600" : "text-emerald-600"}`}>{r.lateTasks}/{r.totalTasks}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Bônus</p>
                    <p className={`text-sm font-semibold ${pctColor(r.bonusPct)}`}>
                      {r.salary > 0 ? `R$ ${fmt(r.totalBonus)}` : "—"}
                    </p>
                  </div>
                </div>

                {r.salary === 0 && canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={(e) => { e.stopPropagation(); openSalaryEdit(r.profile.id, r.profile.name); }}
                  >
                    Definir salário base →
                  </Button>
                )}

                <div className="flex items-center justify-end text-xs text-muted-foreground">
                  Ver detalhes <ChevronRight className="h-3 w-3 ml-1" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Detail Dialog */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            {detailCollab && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center justify-between gap-4 pr-8">
                    <span>{detailCollab.profile.name}</span>
                    <Badge variant="outline" className={pctBadge(detailCollab.bonusPct)}>
                      {fmt(detailCollab.bonusPct)}% de bonificação
                    </Badge>
                  </DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Dias realizados", value: fmtDays(detailCollab.realDays) + "d" },
                    { label: "Meta mínima", value: (config?.target_days ?? "—") + "d" },
                    { label: "Tarefas no prazo", value: `${detailCollab.totalTasks - detailCollab.lateTasks}/${detailCollab.totalTasks}` },
                    { label: "Pontualidade", value: fmt(detailCollab.onTimePct) + "%" },
                  ].map((item) => (
                    <div key={item.label} className="border rounded-md p-3">
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="text-base font-semibold mt-1">{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                  <div className="border rounded-md p-4">
                    <p className="text-xs text-muted-foreground">Saldo de dias (60%)</p>
                    <p className="text-lg font-semibold mt-1">{detailCollab.salary > 0 ? `R$ ${fmt(detailCollab.criterion60)}` : "—"}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {detailCollab.bonusDays > 0
                        ? `${fmtDays(detailCollab.bonusDays)} dias além da meta × R$ ${fmt(detailCollab.dayBonusValue)}/dia`
                        : detailCollab.realDays < (config?.target_days ?? 0)
                          ? "Abaixo da meta mínima — critério zerado"
                          : "Nenhum dia excedente ainda"}
                    </p>
                  </div>
                  <div className="border rounded-md p-4">
                    <p className="text-xs text-muted-foreground">Pontualidade (40%)</p>
                    <p className="text-lg font-semibold mt-1">{detailCollab.salary > 0 ? `R$ ${fmt(detailCollab.criterion40)}` : "—"}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {detailCollab.lateTasks === 0
                        ? "Nenhum atraso registrado"
                        : `${detailCollab.lateTasks} tarefa(s) com horas excedidas`}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <h3 className="text-sm font-semibold mb-2">Detalhamento por tarefa</h3>
                  {detailCollab.tasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma tarefa concluída no período.</p>
                  ) : (
                    <div className="border rounded-md overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="text-left p-2">Tarefa</th>
                            <th className="text-right p-2">Est. (d)</th>
                            <th className="text-right p-2">Real (d)</th>
                            <th className="text-center p-2">Saldo</th>
                            <th className="text-center p-2">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailCollab.tasks.map((t) => {
                            const badge = taskSaldoBadge(t.estimated_hours, t.hours_worked);
                            return (
                              <tr key={t.id} className="border-t">
                                <td className="p-2">
                                  <p className="font-medium">{t.name}</p>
                                  <p className="text-xs text-muted-foreground">{t.project_name} · {t.stage_name}</p>
                                </td>
                                <td className="p-2 text-right">{fmtDays(t.estimated_hours / HOURS_PER_DAY)}</td>
                                <td className="p-2 text-right">{fmtDays(t.hours_worked / HOURS_PER_DAY)}</td>
                                <td className="p-2 text-center">
                                  {badge ? (
                                    <Badge variant="outline" className={badge.style}>
                                      {badge.icon === "adiantado" && <TrendingDown className="h-3 w-3 mr-1 inline" />}
                                      {badge.icon === "atrasado" && <TrendingUp className="h-3 w-3 mr-1 inline" />}
                                      {badge.icon === "no prazo" && <Minus className="h-3 w-3 mr-1 inline" />}
                                      {badge.label}
                                    </Badge>
                                  ) : "—"}
                                </td>
                                <td className="p-2 text-center">
                                  <Badge variant="outline" className="text-xs">
                                    {t.status === "concluida" ? "Concluída" : t.status === "aprovada" ? "Aprovada" : "Enviado ao cliente"}
                                  </Badge>
                                </td>
                              </tr>
                            );
                          })}
                          <tr className="border-t bg-muted/50 font-medium">
                            <td className="p-2">Total</td>
                            <td className="p-2 text-right">
                              {fmtDays(detailCollab.tasks.reduce((a, t) => a + t.estimated_hours, 0) / HOURS_PER_DAY)}d
                            </td>
                            <td className="p-2 text-right">{fmtDays(detailCollab.realDays)}d</td>
                            <td className="p-2 text-center">
                              <span className={detailCollab.extraDays >= 0 ? "text-emerald-600" : "text-red-600"}>
                                {detailCollab.extraDays >= 0 ? "+" : ""}{fmtDays(detailCollab.extraDays)}d
                              </span>
                            </td>
                            <td className="p-2" />
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {canEdit && (
                  <div className="flex justify-end mt-4">
                    <Button variant="outline" onClick={() => { setDetailOpen(false); openSalaryEdit(detailCollab.profile.id, detailCollab.profile.name); }}>
                      Editar salário base
                    </Button>
                  </div>
                )}
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Config Dialog */}
        <Dialog open={configOpen} onOpenChange={setConfigOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Configuração do programa {configDraft.year || currentYear}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {([
                { key: "year", label: "Ano", type: "number" },
                { key: "working_days_total", label: "Dias úteis do ano", type: "number" },
                { key: "working_days_after_discounts", label: "Dias úteis (após férias + recesso + jan/fev)", type: "number" },
                { key: "target_days", label: "Meta mínima de dias", type: "number" },
                { key: "start_date", label: "Início da vigência", type: "date" },
                { key: "end_date", label: "Fim da vigência", type: "date" },
              ] as const).map(({ key, label, type }) => (
                <div key={key}>
                  <Label>{label}</Label>
                  <Input
                    type={type}
                    value={(configDraft as Record<string, unknown>)[key] as string | number ?? ""}
                    onChange={(e) => setConfigDraft((prev) => ({ ...prev, [key]: type === "number" ? Number(e.target.value) : e.target.value }))}
                    className="mt-1"
                  />
                </div>
              ))}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setConfigOpen(false)}>Cancelar</Button>
                <Button onClick={saveConfig}>Salvar</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Salary Dialog */}
        <Dialog open={salaryOpen} onOpenChange={setSalaryOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Salário base — {salaryDraft.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Salário bruto (R$)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={salaryDraft.value}
                  onChange={(e) => setSalaryDraft((prev) => ({ ...prev, value: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setSalaryOpen(false)}>Cancelar</Button>
                <Button onClick={saveSalary}>Salvar</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
