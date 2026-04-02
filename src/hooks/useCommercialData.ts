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
  total_value: number;
  proposal_date: string;
  responsible_id: string;
  status: ProposalStatus;
  notes: string | null;
  linked_project_id: string | null;
  created_at: string;
  updated_at: string;
  // joined
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
      total_value: number;
      proposal_date: string;
      responsible_id: string;
      status?: ProposalStatus;
      notes?: string;
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
    mutationFn: async (proposal: CommercialProposal) => {
      // 1. Check if already linked
      if (proposal.linked_project_id) {
        throw new Error("Proposta já possui projeto vinculado");
      }

      // 2. Create project in planning for each discipline
      const disciplines = proposal.disciplines;
      const disciplineKeys = Object.keys(disciplines).filter(
        (k) => disciplines[k as keyof ProposalDisciplines] && disciplines[k as keyof ProposalDisciplines]! > 0
      );

      const createdProjectIds: string[] = [];

      for (const disc of disciplineKeys) {
        const discValue = disciplines[disc as keyof ProposalDisciplines] || 0;
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
        if (project) createdProjectIds.push((project as any).id);
      }

      // 3. Update proposal status and link first project
      const { error } = await supabase
        .from("commercial_proposals")
        .update({
          status: "aprovada",
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
