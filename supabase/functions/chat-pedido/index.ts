import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { requireActiveUser } from "../_shared/auth.ts";
import { extractMentions, mentionToken } from "../_shared/mentions.ts";
import { demandTypeFor, mayConclude, replyRecipient, validatePedido } from "./rules.ts";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("pedido"), body: z.string().min(1).max(10000) }).strict(),
  z.object({ action: z.literal("concluir_pedido"), message_id: z.string().uuid() }).strict(),
  z.object({ action: z.literal("ja_feito"), message_id: z.string().uuid() }).strict(),
  z.object({ action: z.literal("responder_pedido"), demand_id: z.string().uuid(), texto: z.string().trim().min(1).max(10000) }).strict(),
]);
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
function spDayStart() {
  const d = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return `${d}T00:00:00-03:00`;
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  try {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ error: "Ação ou parâmetros inválidos." }, 400);
    const auth = await requireActiveUser(req, corsHeaders);
    if (!auth.ok) return auth.response;
    const db = auth.admin; const userId = auth.userId; const input = parsed.data;
    const say = async (body: string, kind = "texto") => {
      const { error } = await db.from("chat_messages").insert({ user_id: userId, sender: "agente", kind, body });
      if (error) throw new Error(error.message);
    };

    if (input.action === "responder_pedido") {
      const { data: demand, error: demandError } = await db.from("demands").select("id,created_by,assigned_to,source").eq("id", input.demand_id).maybeSingle();
      if (demandError) throw new Error(demandError.message);
      if (!demand || demand.source !== "chat") return json({ error: "Este pedido não existe mais." }, 404);
      if (!replyRecipient(userId, demand)) return json({ error: "Somente participantes podem responder a este pedido." }, 403);
      const { error } = await db.rpc("fn_respond_chat_pedido", { _demand_id: demand.id, _actor: userId, _body: input.texto });
      if (error) throw new Error(error.message);
      return json({ success: true });
    }

    if (input.action === "concluir_pedido" || input.action === "ja_feito") {
      const { data: msg } = await db.from("chat_messages").select("id,user_id,kind,demand_id,action_taken").eq("id", input.message_id).maybeSingle();
      if (!msg || msg.kind !== "pedido" || !msg.demand_id || msg.user_id !== userId) return json({ error: "Este pedido não está disponível nesta conversa." }, 400);
      const { data: demand } = await db.from("demands").select("id,assigned_to,is_done").eq("id", msg.demand_id).maybeSingle();
      if (!demand) return json({ error: "Este pedido não existe mais." }, 404);
      if (!mayConclude(userId, demand.assigned_to)) return json({ error: "Somente o responsável pode concluir este pedido." }, 403);
      const { error } = await db.rpc("fn_finish_chat_pedido", { _demand_id: demand.id, _actor: userId, _kind: input.action === "ja_feito" ? "ja_feito" : "concluido" });
      if (error) throw new Error(error.message);
      const { error: actionError } = await db.from("chat_messages").update({ action_taken: input.action }).eq("demand_id", demand.id).eq("user_id", userId).eq("kind", "pedido").is("action_taken", null);
      if (actionError) throw new Error(actionError.message);
      return json({ success: true });
    }

    // pedido: the author message is stored here (already processed) so the collection agent never treats it as a reply.
    const text = input.body.trim();
    const { data: authorMsg, error: msgErr } = await db.from("chat_messages").insert({ user_id: userId, sender: "usuario", body: text, processed_at: new Date().toISOString() }).select("id").single();
    if (msgErr) throw new Error(msgErr.message);
    const ms = extractMentions(text);
    const projectId = ms.find(m => m.type === "p")?.id;
    const personIds = [...new Set(ms.filter(m => m.type === "u").map(m => m.id))].slice(0, 10);
    const [{ data: project }, { data: people }, { data: author }, { data: today }] = await Promise.all([
      projectId ? db.from("projects").select("id,name,discipline,responsible").eq("id", projectId).maybeSingle() : Promise.resolve({ data: null }),
      personIds.length ? db.from("profiles").select("id,name,status").in("id", personIds) : Promise.resolve({ data: [] }),
      db.from("profiles").select("name").eq("id", userId).maybeSingle(),
      personIds.length ? db.from("demands").select("assigned_to").eq("source", "chat").in("assigned_to", personIds).gte("created_at", spDayStart()) : Promise.resolve({ data: [] }),
    ]);
    const todayCounts: Record<string, number> = {};
    for (const d of today ?? []) todayCounts[d.assigned_to] = (todayCounts[d.assigned_to] ?? 0) + 1;
    const v = validatePedido({ text, authorId: userId, project, people: people ?? [], todayCounts });
    if (!v.ok) { await say(v.error); return json({ success: false, error: v.error }); }
    const type = demandTypeFor(project.discipline);
    if (!type) { const e = "A disciplina deste projeto não permite criar demandas."; await say(e); return json({ success: false, error: e }); }
    const token = mentionToken("p", project.id, project.name);
    const authorName = author?.name || "um colega";
    const { data: demands, error: dErr } = await db.from("demands").insert(v.personIds.map(pid => ({
      project_id: project.id, description: `[Pedido via chat] ${v.description}`, created_by: userId, assigned_to: pid,
      coordenador_id: project.responsible, kanban_assignee_id: pid, demand_type: type, source: "chat", source_message_id: authorMsg.id,
    }))).select("id,assigned_to");
    if (dErr) throw new Error(dErr.message);
    const { error: nErr } = await db.from("chat_messages").insert(demands.map((d: { id: string; assigned_to: string }) => ({
      user_id: d.assigned_to, sender: "agente", kind: "pedido", demand_id: d.id,
      body: `📌 Pedido de ${authorName} sobre ${token}:\n${v.description}`, actions: [{ id: "concluir_pedido", label: "Concluído" }, { id: "ja_feito", label: "Já estava feito" }, { id: "responder_pedido", label: "Responder" }],
    })));
    if (nErr) throw new Error(nErr.message);
    const confirmations = demands.map((d: { id: string; assigned_to: string }) => ({
      user_id: userId, sender: "agente", kind: "confirmacao", demand_id: d.id,
      body: `Pronto! Criei o pedido para ${people?.find((p: { id: string }) => p.id === d.assigned_to)?.name ?? "um colega"} no projeto ${token}. Ele já aparece em Demandas e eu te aviso quando for concluído.`,
      actions: [{ id: "responder_pedido", label: "Responder" }],
    }));
    const { error: confirmationError } = await db.from("chat_messages").insert(confirmations);
    if (confirmationError) throw new Error(confirmationError.message);
    return json({ success: true, demands: demands.length });
  } catch (error) {
    console.error("chat-pedido", error instanceof Error ? error.message : error);
    return json({ error: "Não foi possível registrar o pedido agora. Tente novamente." }, 500);
  }
});
