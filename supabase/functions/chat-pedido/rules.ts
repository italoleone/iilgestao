import { extractMentions, stripMentions, pedidoDescription } from "../_shared/mentions.ts";

export const DAILY_LIMIT = 20;
export function demandTypeFor(discipline: string | null) {
  const d = (discipline ?? "").toLowerCase();
  if (d.startsWith("estrutur")) return "estrutura";
  if (d.startsWith("hidr")) return "hidraulica";
  if (d.startsWith("eletr") || d.startsWith("elétr")) return "eletrica";
  return null;
}
type Person = { id: string; status: string };
export function validatePedido(input: { text: string; authorId: string; project: { id: string } | null; people: Person[]; todayCounts: Record<string, number> }) {
  const ms = extractMentions(input.text);
  const projectIds = [...new Set(ms.filter(m => m.type === "p").map(m => m.id))];
  const personIds = [...new Set(ms.filter(m => m.type === "u").map(m => m.id))];
  if (projectIds.length !== 1 || personIds.length < 1) return { ok: false as const, error: "Para criar um pedido, mencione 1 projeto e pelo menos 1 pessoa." };
  if (personIds.length > 3) return { ok: false as const, error: "Mencione no máximo 3 pessoas por pedido." };
  if (!input.project) return { ok: false as const, error: "Não encontrei o projeto mencionado." };
  if (personIds.includes(input.authorId.toLowerCase())) return { ok: false as const, error: "Você não pode criar um pedido para si mesmo." };
  for (const id of personIds) {
    const p = input.people.find(x => x.id.toLowerCase() === id);
    if (!p || p.status !== "active") return { ok: false as const, error: "Uma das pessoas mencionadas não está ativa no sistema." };
    if ((input.todayCounts[id] ?? 0) >= DAILY_LIMIT) return { ok: false as const, error: `Uma das pessoas mencionadas já recebeu ${DAILY_LIMIT} pedidos hoje. Tente amanhã.` };
  }
  const description = pedidoDescription(input.text);
  if (stripMentions(input.text).length < 5) return { ok: false as const, error: "Escreva o pedido com pelo menos 5 caracteres além das menções." };
  return { ok: true as const, projectId: projectIds[0], personIds, description };
}
export function mayConclude(userId: string, assignedTo: string | null) { return !!assignedTo && userId === assignedTo; }
export function replyRecipient(userId: string, demand: { created_by: string; assigned_to: string | null }) {
  if (userId === demand.assigned_to) return demand.created_by;
  if (userId === demand.created_by) return demand.assigned_to;
  return null;
}
