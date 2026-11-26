import { supabase } from "@/integrations/supabase/client";

export interface ClientOption { id: string; name: string }

const norm = (s: string) => s.trim().toLowerCase();

/** Lista o cadastro único de clientes (commercial_clients) ordenado por nome. */
export async function fetchClientOptions(): Promise<ClientOption[]> {
  const { data } = await supabase.from("commercial_clients").select("id, name").order("name");
  return (data || []) as ClientOption[];
}

/**
 * Resolve o cliente pelo nome (sem diferenciar maiúsculas/minúsculas e ignorando espaços nas pontas).
 * Se não existir na lista nem no banco, cria em commercial_clients e devolve o novo registro.
 */
export async function resolveOrCreateClient(name: string, known: ClientOption[]): Promise<ClientOption> {
  const target = norm(name);
  const local = known.find((c) => norm(c.name) === target);
  if (local) return local;
  const fresh = await fetchClientOptions();
  const remote = fresh.find((c) => norm(c.name) === target);
  if (remote) return remote;
  const { data, error } = await supabase
    .from("commercial_clients")
    .insert({ name: name.trim() })
    .select("id, name")
    .single();
  if (error || !data) throw error || new Error("Erro ao cadastrar cliente");
  return data as ClientOption;
}
