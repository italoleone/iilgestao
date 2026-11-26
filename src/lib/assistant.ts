import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";

export type ChatMessage = Database["public"]["Tables"]["chat_messages"]["Row"];
export type Followup = Database["public"]["Tables"]["agent_followups"]["Row"];
export type AgentSettings = Database["public"]["Tables"]["agent_settings"]["Row"];
export const FOLLOWUP_LABELS: Record<string, string> = {
  aguardando_resposta: "Aguardando resposta", resposta_recebida: "Resposta recebida",
  aguardando_aprovacao: "Aguardando aprovação", resolvido: "Resolvida",
  sem_resposta: "Sem resposta", cancelado: "Cancelada",
};
export const DECISION_LABELS: Record<string, string> = {
  auto: "Automática", aprovado: "Aprovada pelo coordenador", recusado: "Recusada", simulado: "Simulada",
};
export function dateBR(value: string | null) { return value ? value.split("-").reverse().join("/") : "—"; }
export function timestampBR(value: string) {
  const parts = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? "";
  return `${get("day")}/${get("month")} ${get("hour")}:${get("minute")}`;
}
export function messageActions(actions: Json): { id: "aprovar" | "recusar"; label: string }[] {
  if (!Array.isArray(actions)) return [];
  return actions.flatMap(a => {
    if (!a || typeof a !== "object" || Array.isArray(a) || (a.id !== "aprovar" && a.id !== "recusar") || typeof a.label !== "string") return [];
    return [{ id: a.id, label: a.label }];
  });
}
export function canSeeDelayReasons(role: string, userId: string, taskResponsible: string | null, projectResponsible: string | null) {
  return ["admin_geral", "admin", "planejamento"].includes(role) || userId === taskResponsible || userId === projectResponsible;
}
export function canAccessAgents(role: string) { return role === "admin_geral"; }
export function needsActivationConfirmation(previous: string, next: string) { return previous !== "ativo" && next === "ativo"; }
export function validateAgentSettings(settings: AgentSettings): string | null {
  if (!["teste", "ativo", "desligado"].includes(settings.mode)) return "Selecione um modo válido.";
  if (settings.mode === "teste" && !settings.test_recipient_id) return "Selecione o destinatário do teste.";
  if (!settings.run_weekdays.length || settings.run_weekdays.some(d => !Number.isInteger(d) || d < 0 || d > 6)) return "Selecione pelo menos um dia da semana.";
  if (!Number.isInteger(settings.run_hour) || settings.run_hour < 0 || settings.run_hour > 23) return "A hora deve estar entre 0 e 23.";
  if (!Number.isInteger(settings.auto_limit_business_days) || settings.auto_limit_business_days < 0) return "Informe um limite válido de dias úteis.";
  if (!Number.isInteger(settings.max_reminders) || settings.max_reminders < 0) return "Informe um número válido de lembretes.";
  return null;
}
export async function callAssistant(body: { action: "reply" } | { action: "run"; force: true } | { action: "decide"; message_id: string; choice: "aprovar" | "recusar" }) {
  const { data, error } = await supabase.functions.invoke("agent-cobranca", { body });
  if (error) {
    const response = "context" in error ? error.context : null;
    let message = error.message;
    if (response instanceof Response) {
      const payload = await response.json().catch(() => null);
      message = payload?.error ?? payload?.message ?? message;
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}