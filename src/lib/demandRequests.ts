import { isPedido } from "@/lib/mentions";

type RequestRow = { assigned_to: string | null; created_by: string; is_done: boolean; created_at: string };
export function requestsForMe<T extends RequestRow>(demands: T[], userId: string | undefined): T[] {
  if (!userId) return [];
  return demands.filter(d => d.assigned_to === userId && !d.is_done)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}
export function filterRequestScope<T extends RequestRow>(demands: T[], scope: "all" | "assigned" | "created", userId: string | undefined): T[] {
  return demands.filter(d => scope === "all" || (scope === "assigned" ? d.assigned_to === userId : d.created_by === userId));
}
export function chatSendAction(encoded: string, replyingTo: string | null) {
  return replyingTo ? "responder_pedido" : isPedido(encoded) ? "pedido" : "reply";
}