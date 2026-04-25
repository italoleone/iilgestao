import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

import { DEFAULT_TASKS_BY_DISCIPLINE } from "@/data/defaultTasks";

// ─── Tipos de Clientes ───────────────────────────────────────────────────────

export interface CommercialClient {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  notes: string | null;
  created_at: string;
}

// ─── Tipos de Proposta ────────────────────────────────────────────────────────

export interface ProposalDisciplines {
  estrutural?: number;
  hidraulica?: number;
  eletrica?: number;
  fundacoes?: number;
}

export interface ProposalPricePerM2 {
  estrutural?: number;
  hidraulica?: number;
  eletrica?: number;
  fundacoes?: number;
}

export interface ProposalDiscounts {
  estrutural?: number;
  hidraulica?: number;
  eletrica?: number;
  fundacoes?: number;
}

export type ProposalStatus =
  | "lead"
  | "contato_feito"
  | "em_elaboracao"
  | "enviada"
  | "em_negociacao"
  | "aprovada"
  | "reprovada";

export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  lead: "Lead",
  contato_feito: "Contato Feito",
  em_elaboracao: "Em Elaboração",
  enviada: "Enviada",
  em_negociacao: "Em Negociação",
  aprovada: "Aprovada",
  reprovada: "Reprovada",
};

export const PIPELINE_COLUMNS: ProposalStatus[] = [
  "lead",
  "contato_feito",
  "em_elaboracao",
  "enviada",
  "em_negociacao",
  "aprovada",
  "reprovada",
];

export interface CommercialProposal {
  id: string;
  client_id: string;
  project_name: string;
  area_m2: number;
  disciplines: ProposalDisciplines;
  price_per_m2: ProposalPricePerM2;
  discounts: ProposalDiscounts;
  final_disciplines: ProposalDisciplines;
  total_value: number;
  final_total_value: number;
  proposal_date: string;
  responsible_id: string;
  status: ProposalStatus;
  notes: string | null;
  linked_project_id: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  client?: CommercialClient;
}

// ─── Tipos de Cronograma de Faturamento ──────────────────────────────────────

export type BillingStageKey =
  | "sinal"
  | "ep"
  | "ap"
  | "pre_executivo"
  | "executivo"
  | "liberado_obra";

export type BillingStatus = "previsto" | "faturado" | "recebido";

export interface BillingScheduleEntry {
  id: string;
  proposal_id: string;
  discipline_key: string;          // 'estrutural' | 'hidraulica' | 'eletrica' | 'fundacoes'
  discipline_label: string;
  stage_key: BillingStageKey;
  stage_label: string;
  amount: number;
  percentage: number;              // % do valor da disciplina
  billing_year: number;
  billing_month: number;
  is_installment: boolean;
  installment_count: number | null;
  status: BillingStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Configuração das etapas de faturamento — ordem e labels fixos */
export const BILLING_STAGES: { key: BillingStageKey; label: string }[] = [
  { key: "sinal",         label: "Sinal"             },
  { key: "ep",            label: "Estudo Preliminar" },
  { key: "ap",            label: "Ante Projeto"      },
  { key: "pre_executivo", label: "Pré Executivo"     },
  { key: "executivo",     label: "Executivo"         },
  { key: "liberado_obra", label: "Liberado para Obra"},
];

export const MONTH_LABELS = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

// ─── Hooks de Clientes ────────────────────────────────────────────────────────

export function useCommercialClients() {
  return useQuery({
    queryKey: ["commercial-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commercial_clients")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as CommercialClient[];
    },
  });
}

export function useClientHistory(clientId: string | null) {
  return useQuery({
    queryKey: ["commercial-client-history", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from("commercial_proposals")
        .select("*")
        .eq("client_id", clientId)
        .order("proposal_date", { ascending: false });
      if (error) throw error;
      return (data || []).map((p: any) => ({
        ...p,
        disciplines: p.disciplines as ProposalDisciplines,
        price_per_m2: (p.price_per_m2 || {}) as ProposalPricePerM2,
        status: p.status as ProposalStatus,
      })) as CommercialProposal[];
    },
    enabled: !!clientId,
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (client: Omit<CommercialClient, "id" | "created_at">) => {
      const { data, error } = await supabase
        .from("commercial_clients")
        .insert(client as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commercial-clients"] });
      toast.success("Cliente criado com sucesso");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CommercialClient> & { id: string }) => {
      const { error } = await supabase
        .from("commercial_clients")
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commercial-clients"] });
      toast.success("Cliente atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ─── Hooks de Propostas ───────────────────────────────────────────────────────

export function useCommercialProposals() {
  return useQuery({
    queryKey: ["commercial-proposals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commercial_proposals")
        .select("*, commercial_clients(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((p: any) => ({
        ...p,
        disciplines: p.disciplines as ProposalDisciplines,
        price_per_m2: (p.price_per_m2 || {}) as ProposalPricePerM2,
        discounts: (p.discounts || {}) as ProposalDiscounts,
        final_disciplines: (p.final_disciplines || {}) as ProposalDisciplines,
        final_total_value: p.final_total_value || 0,
        status: p.status as ProposalStatus,
        client: p.commercial_clients as CommercialClient,
      })) as CommercialProposal[];
    },
  });
}

export function useCreateProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (proposal: {
      client_id: string;
      project_name: string;
      area_m2: number;
      disciplines: ProposalDisciplines;
      price_per_m2: ProposalPricePerM2;
      total_value: number;
      proposal_date: string;
      responsible_id: string;
      status?: ProposalStatus;
      notes?: string;
      scope?: string;
    }) => {
      const { data, error } = await supabase
        .from("commercial_proposals")
        .insert(proposal as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commercial-proposals"] });
      toast.success("Proposta criada com sucesso");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CommercialProposal> & { id: string }) => {
      const { error } = await supabase
        .from("commercial_proposals")
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commercial-proposals"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useApproveProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      proposal,
      discounts,
      userId,
      coordinators,
    }: {
      proposal: CommercialProposal;
      discounts: ProposalDiscounts;
      userId: string;
      coordinators?: Record<string, string>;
    }) => {
      if (proposal.linked_project_id) {
        throw new Error("Proposta já possui projeto vinculado");
      }

      // Calcular valores finais com descontos
      const finalDisciplines: ProposalDisciplines = {};
      const disciplines = proposal.disciplines;
      const disciplineKeys = (Object.keys(disciplines) as (keyof ProposalDisciplines)[]).filter(
        (k) => disciplines[k] && disciplines[k]! > 0
      );

      for (const disc of disciplineKeys) {
        const original = disciplines[disc] || 0;
        const discountPct = Math.min(100, Math.max(0, discounts[disc] || 0));
        finalDisciplines[disc] = Math.max(0, original - original * (discountPct / 100));
      }

      const finalTotal = Object.values(finalDisciplines).reduce((s, v) => s + (v || 0), 0);

      // Criar projetos no planejamento para cada disciplina
      const createdProjectIds: string[] = [];

      for (const disc of disciplineKeys) {
        const discValue = finalDisciplines[disc] || 0;
        const coordId = coordinators?.[disc] || proposal.responsible_id;
        const { data: project, error: projError } = await supabase
          .from("projects")
          .insert({
            name: proposal.project_name,
            client: proposal.client?.name || "",
            discipline: disc,
            start_date: new Date().toISOString().split("T")[0],
            deadline: new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0],
            responsible: coordId,
            team: [coordId],
            sale_value: discValue,
            status: "em_andamento",
          } as any)
          .select()
          .single();
        if (projError) throw projError;

        if (project) {
          createdProjectIds.push((project as any).id);
          // Tarefas padrão NÃO são mais criadas automaticamente na aprovação da proposta.
          // O usuário deve criar as tarefas manualmente no Planejamento.
        }
      }

      // Atualizar proposta com dados de aprovação
      const { error } = await supabase
        .from("commercial_proposals")
        .update({
          status: "aprovada",
          discounts: discounts,
          final_disciplines: finalDisciplines,
          final_total_value: finalTotal,
          approved_by: userId,
          approved_at: new Date().toISOString(),
          linked_project_id: createdProjectIds[0] || null,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", proposal.id);
      if (error) throw error;

      return createdProjectIds;
    },
    onSuccess: (ids) => {
      qc.invalidateQueries({ queryKey: ["commercial-proposals"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success(`Proposta aprovada! ${ids.length} projeto(s) criado(s) no Planejamento.`);
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("commercial_proposals")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commercial-proposals"] });
      toast.success("Proposta excluída");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ─── Hooks de Cronograma de Faturamento ───────────────────────────────────────

/** Busca todas as entradas de cronograma de uma proposta específica */
export function useBillingSchedule(proposalId: string | null) {
  return useQuery({
    queryKey: ["billing-schedule", proposalId],
    queryFn: async () => {
      if (!proposalId) return [];
      const { data, error } = await supabase
        .from("proposal_billing_schedule")
        .select("*")
        .eq("proposal_id", proposalId)
        .order("billing_year")
        .order("billing_month");
      if (error) throw error;
      return (data || []) as BillingScheduleEntry[];
    },
    enabled: !!proposalId,
  });
}

/** Busca TODAS as entradas de cronograma (para o Dashboard Financeiro) */
export function useAllBillingSchedules() {
  return useQuery({
    queryKey: ["billing-schedule-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposal_billing_schedule")
        .select("*, commercial_proposals(project_name, client_id, commercial_clients(name))")
        .order("billing_year")
        .order("billing_month");
      if (error) throw error;
      return (data || []) as (BillingScheduleEntry & {
        commercial_proposals: {
          project_name: string;
          client_id: string;
          commercial_clients: { name: string } | null;
        } | null;
      })[];
    },
  });
}

export interface UpsertBillingScheduleInput {
  proposal_id: string;
  discipline_key: string;
  discipline_label: string;
  stage_key: BillingStageKey;
  stage_label: string;
  amount: number;
  percentage: number;
  billing_year: number;
  billing_month: number;
  is_installment: boolean;
  installment_count?: number | null;
  created_by: string;
}

/** Cria ou substitui entradas do cronograma de uma proposta (upsert por proposta completa) */
export function useSaveBillingSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      proposalId,
      entries,
    }: {
      proposalId: string;
      entries: UpsertBillingScheduleInput[];
    }) => {
      // Remove entradas anteriores desta proposta e re-insere
      const { error: delError } = await supabase
        .from("proposal_billing_schedule")
        .delete()
        .eq("proposal_id", proposalId);
      if (delError) throw delError;

      if (entries.length === 0) return;

      const { error: insError } = await supabase
        .from("proposal_billing_schedule")
        .insert(entries as any);
      if (insError) throw insError;
    },
    onSuccess: (_, { proposalId }) => {
      qc.invalidateQueries({ queryKey: ["billing-schedule", proposalId] });
      qc.invalidateQueries({ queryKey: ["billing-schedule-all"] });
      toast.success("Cronograma de faturamento salvo!");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateBillingStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: BillingStatus }) => {
      const { error } = await supabase
        .from("proposal_billing_schedule")
        .update({ status, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["billing-schedule-all"] });
      qc.invalidateQueries({ queryKey: ["billing-schedule"] });
      toast.success("Status atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });
}
