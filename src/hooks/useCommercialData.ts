import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

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

export type ProposalStatus = "lead" | "contato_feito" | "em_elaboracao" | "enviada" | "em_negociacao" | "aprovada" | "reprovada";

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
  "lead", "contato_feito", "em_elaboracao", "enviada", "em_negociacao", "aprovada", "reprovada",
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
    }: {
      proposal: CommercialProposal;
      discounts: ProposalDiscounts;
      userId: string;
    }) => {
      if (proposal.linked_project_id) {
        throw new Error("Proposta já possui projeto vinculado");
      }

      // Calculate final values with discounts
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

      // Create projects in planning for each discipline using FINAL values
      const createdProjectIds: string[] = [];

      for (const disc of disciplineKeys) {
        const discValue = finalDisciplines[disc] || 0;
        const { data: project, error: projError } = await supabase
          .from("projects")
          .insert({
            name: proposal.project_name,
            client: proposal.client?.name || "",
            discipline: disc,
            start_date: new Date().toISOString().split("T")[0],
            deadline: new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0],
            responsible: proposal.responsible_id,
            sale_value: discValue,
            status: "em_andamento",
          } as any)
          .select()
          .single();
        if (projError) throw projError;
      if (project) {
        createdProjectIds.push((project as any).id);

        // Create default tasks for each stage
        const STAGE_NAMES = ["Estudo Preliminar","Anteprojeto","Pré-executivo","Executivo","Liberação para Obra","Revisão"];
        const defaultTasksByStage: Record<string, string[]> = {
          "Estudo Preliminar": ["Tarefa Teste 1", "Tarefa Teste 2"],
          "Anteprojeto": ["Tarefa Teste 3"],
          "Pré-executivo": ["Tarefa Teste 4"],
          "Executivo": ["Tarefa Teste 5"],
          "Liberação para Obra": ["Tarefa Teste 6"],
          "Revisão": ["Tarefa Teste 7"],
        };
        const taskRows = STAGE_NAMES.flatMap((stageName) =>
          (defaultTasksByStage[stageName] || []).map((taskName) => ({
            name: taskName,
            project_id: (project as any).id,
            discipline: disc,
            stage_name: stageName,
            estimated_hours: 0,
            hours_worked: 0,
            status: "nao_iniciada",
          }))
        );
        if (taskRows.length > 0) {
          await supabase.from("tasks").insert(taskRows as any);
        }
      }
      }

      // Update proposal with approval data
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
