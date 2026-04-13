import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// ---- Types ----

export interface Receivable {
  id: string;
  description: string;
  project_id: string | null;
  proposal_id: string | null;
  client_name: string;
  amount: number;
  due_date: string;
  received_date: string | null;
  status: string;
  category: string;
  notes: string | null;
  created_by: string;
  created_at: string;
}

export interface Payable {
  id: string;
  description: string;
  supplier: string | null;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: string;
  category: string;
  recurrent: boolean;
  recurrent_day: number | null;
  notes: string | null;
  created_by: string;
  created_at: string;
}

export interface ReceivableFilters {
  month?: number;
  year?: number;
  status?: string;
  search?: string;
}

export interface PayableFilters {
  month?: number;
  year?: number;
  status?: string;
  category?: string;
  search?: string;
}

export interface RentabilidadeFilters {
  month?: number;
  year?: number;
  projectId?: string;
  discipline?: string;
}

export interface RentabilidadeRow {
  projectId: string;
  projectName: string;
  client: string;
  discipline: string;
  status: string;
  receita: number;
  custoReal: number;
  margemRs: number;
  margemPct: number;
  horasVendidas: number;
  horasGastas: number;
  eficiencia: number;
}

// ---- Receivables ----

export function useReceivables(filters?: ReceivableFilters) {
  return useQuery({
    queryKey: ["receivables", filters],
    queryFn: async () => {
      let q = supabase.from("receivables").select("*").order("due_date", { ascending: true });
      if (filters?.status && filters.status !== "todos") q = q.eq("status", filters.status);
      if (filters?.search) q = q.ilike("client_name", `%${filters.search}%`);
      if (filters?.year && filters?.month !== undefined) {
        const start = `${filters.year}-${String(filters.month + 1).padStart(2, "0")}-01`;
        const endDate = new Date(filters.year, filters.month + 1, 0);
        const end = `${filters.year}-${String(filters.month + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;
        q = q.gte("due_date", start).lte("due_date", end);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Receivable[];
    },
  });
}

export function useCreateReceivable() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: Omit<Receivable, "id" | "created_at" | "created_by">) => {
      const { error } = await supabase.from("receivables").insert({ ...input, created_by: user!.id } as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["receivables"] }); toast.success("Conta a receber criada"); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateReceivable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Receivable> & { id: string }) => {
      const { error } = await supabase.from("receivables").update(data as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["receivables"] }); toast.success("Atualizado"); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteReceivable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("receivables").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["receivables"] }); toast.success("Excluído"); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useMarkReceived() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, date }: { id: string; date: string }) => {
      const { error } = await supabase.from("receivables").update({ status: "recebido", received_date: date } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["receivables"] }); toast.success("Marcado como recebido"); },
    onError: (e: any) => toast.error(e.message),
  });
}

// ---- Payables ----

export function usePayables(filters?: PayableFilters) {
  return useQuery({
    queryKey: ["payables", filters],
    queryFn: async () => {
      let q = supabase.from("payables").select("*").order("due_date", { ascending: true });
      if (filters?.status && filters.status !== "todos") q = q.eq("status", filters.status);
      if (filters?.category && filters.category !== "todos") q = q.eq("category", filters.category);
      if (filters?.search) q = q.or(`description.ilike.%${filters.search}%,supplier.ilike.%${filters.search}%`);
      if (filters?.year && filters?.month !== undefined) {
        const start = `${filters.year}-${String(filters.month + 1).padStart(2, "0")}-01`;
        const endDate = new Date(filters.year, filters.month + 1, 0);
        const end = `${filters.year}-${String(filters.month + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;
        q = q.gte("due_date", start).lte("due_date", end);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Payable[];
    },
  });
}

export function useCreatePayable() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: Omit<Payable, "id" | "created_at" | "created_by">) => {
      const { error } = await supabase.from("payables").insert({ ...input, created_by: user!.id } as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payables"] }); toast.success("Conta a pagar criada"); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdatePayable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Payable> & { id: string }) => {
      const { error } = await supabase.from("payables").update(data as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payables"] }); toast.success("Atualizado"); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeletePayable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payables").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payables"] }); toast.success("Excluído"); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useMarkPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, date }: { id: string; date: string }) => {
      const { error } = await supabase.from("payables").update({ status: "pago", paid_date: date } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payables"] }); toast.success("Marcado como pago"); },
    onError: (e: any) => toast.error(e.message),
  });
}

// ---- Projeto Custo ----

export interface ProjetoCustoRow {
  projectId: string;
  projectName: string;
  client: string;
  discipline: string;
  status: string;
  receita: number;
  custoAcumulado: number;
  margemRs: number;
  margemPct: number;
  horasGastas: number;
  detalhesPorUsuario: {
    userId: string;
    userName: string;
    horasGastas: number;
    custo: number;
  }[];
  detalhesPorTarefa: {
    taskId: string;
    taskName: string;
    stageName: string;
    horasGastas: number;
    custo: number;
    responsavelNome: string;
  }[];
}

export function useProjetoCusto(projectId: string | null) {
  return useQuery({
    queryKey: ["projeto-custo", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data: project } = await supabase
        .from("projects").select("*").eq("id", projectId!).single();
      const { data: entries } = await supabase
        .from("time_entries").select("*").eq("project_id", projectId!);
      const { data: tasks } = await supabase
        .from("tasks").select("id, name, stage_name, responsible").eq("project_id", projectId!);
      const { data: profiles } = await supabase
        .from("profiles").select("id, name, cost_per_hour");

      const costMap = new Map<string, { name: string; cost: number }>();
      (profiles || []).forEach((p: any) =>
        costMap.set(p.id, { name: p.name, cost: p.cost_per_hour || 0 })
      );
      const taskMap = new Map<string, any>();
      (tasks || []).forEach((t: any) => taskMap.set(t.id, t));

      const byUser = new Map<string, { horasGastas: number; custo: number }>();
      const byTask = new Map<string, { horasGastas: number; custo: number }>();
      let totalMinutes = 0;
      let totalCusto = 0;

      (entries || []).forEach((e: any) => {
        const mins = e.duration_minutes || 0;
        const horas = mins / 60;
        const profile = costMap.get(e.user_id);
        const custo = horas * (profile?.cost || 0);
        totalMinutes += mins;
        totalCusto += custo;

        const u = byUser.get(e.user_id) || { horasGastas: 0, custo: 0 };
        u.horasGastas += horas;
        u.custo += custo;
        byUser.set(e.user_id, u);

        if (e.task_id) {
          const t = byTask.get(e.task_id) || { horasGastas: 0, custo: 0 };
          t.horasGastas += horas;
          t.custo += custo;
          byTask.set(e.task_id, t);
        }
      });

      const receita = project?.sale_value || 0;
      const margemRs = receita - totalCusto;

      return {
        projectId: project?.id,
        projectName: project?.name,
        client: project?.client,
        discipline: project?.discipline,
        status: project?.status,
        receita,
        custoAcumulado: Math.round(totalCusto * 100) / 100,
        margemRs: Math.round(margemRs * 100) / 100,
        margemPct: receita > 0 ? Math.round((margemRs / receita) * 1000) / 10 : 0,
        horasGastas: Math.round((totalMinutes / 60) * 100) / 100,
        detalhesPorUsuario: Array.from(byUser.entries()).map(([userId, v]) => ({
          userId,
          userName: costMap.get(userId)?.name || "Desconhecido",
          horasGastas: Math.round(v.horasGastas * 100) / 100,
          custo: Math.round(v.custo * 100) / 100,
        })).sort((a, b) => b.custo - a.custo),
        detalhesPorTarefa: Array.from(byTask.entries()).map(([taskId, v]) => {
          const task = taskMap.get(taskId);
          const resp = task?.responsible ? costMap.get(task.responsible)?.name || "—" : "—";
          return {
            taskId,
            taskName: task?.name || "Tarefa",
            stageName: task?.stage_name || "—",
            horasGastas: Math.round(v.horasGastas * 100) / 100,
            custo: Math.round(v.custo * 100) / 100,
            responsavelNome: resp,
          };
        }).sort((a, b) => b.custo - a.custo),
      } as ProjetoCustoRow;
    },
  });
}

// ---- Rentabilidade ----

export function useRentabilidadePorProjeto(filters?: RentabilidadeFilters) {
  return useQuery({
    queryKey: ["rentabilidade", filters],
    queryFn: async () => {
      // Fetch projects
      let pq = supabase.from("projects").select("*");
      if (filters?.projectId) pq = pq.eq("id", filters.projectId);
      if (filters?.discipline) pq = pq.eq("discipline", filters.discipline);
      const { data: projects, error: pe } = await pq;
      if (pe) throw pe;

      // Fetch time entries
      const { data: timeEntries, error: te } = await supabase.from("time_entries").select("*");
      if (te) throw te;

      // Fetch profiles for cost_per_hour
      const { data: profiles, error: pre } = await supabase.from("profiles").select("id, cost_per_hour");
      if (pre) throw pre;

      // Fetch receivables with status "recebido" for tax cost
      const { data: receivablesData } = await supabase
        .from("receivables")
        .select("project_id, amount, tax_percentage")
        .eq("status", "recebido");

      // Aggregate tax cost per project
      const taxCostByProject = new Map<string, number>();
      (receivablesData || []).forEach((r: any) => {
        if (r.project_id) {
          const cur = taxCostByProject.get(r.project_id) || 0;
          taxCostByProject.set(r.project_id, cur + (Number(r.amount) * (Number(r.tax_percentage) || 0) / 100));
        }
      });

      const costMap = new Map<string, number>();
      (profiles || []).forEach((p: any) => costMap.set(p.id, p.cost_per_hour || 0));

      // Filter time entries by period if needed
      let filteredEntries = timeEntries || [];
      if (filters?.year && filters?.month !== undefined) {
        filteredEntries = filteredEntries.filter((e: any) => {
          const d = new Date(e.date);
          return d.getFullYear() === filters.year && d.getMonth() === filters.month;
        });
      }

      // Aggregate time entries per project
      const projectHours = new Map<string, { totalMinutes: number; cost: number }>();
      filteredEntries.forEach((e: any) => {
        const cur = projectHours.get(e.project_id) || { totalMinutes: 0, cost: 0 };
        cur.totalMinutes += e.duration_minutes || 0;
        cur.cost += ((e.duration_minutes || 0) / 60) * (costMap.get(e.user_id) || 0);
        projectHours.set(e.project_id, cur);
      });

      const rows: RentabilidadeRow[] = (projects || []).map((p: any) => {
        const ph = projectHours.get(p.id) || { totalMinutes: 0, cost: 0 };
        const receita = p.sale_value || 0;
        const custoHoras = Math.round(ph.cost * 100) / 100;
        const custoImpostos = Math.round((taxCostByProject.get(p.id) || 0) * 100) / 100;
        const custoReal = custoHoras + custoImpostos;
        const margemRs = receita - custoReal;
        const margemPct = receita > 0 ? (margemRs / receita) * 100 : 0;
        const horasGastas = Math.round((ph.totalMinutes / 60) * 100) / 100;
        const horasVendidas = p.hours_sold || 0;
        const eficiencia = horasGastas > 0 ? (horasVendidas / horasGastas) * 100 : 0;
        return {
          projectId: p.id,
          projectName: p.name,
          client: p.client,
          discipline: p.discipline,
          status: p.status,
          receita,
          custoReal,
          margemRs,
          margemPct: Math.round(margemPct * 10) / 10,
          horasVendidas,
          horasGastas,
          eficiencia: Math.round(eficiencia * 10) / 10,
        };
      });

      return rows;
    },
  });
}
