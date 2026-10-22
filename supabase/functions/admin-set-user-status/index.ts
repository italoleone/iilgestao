import { requireActiveUser, forbidden } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = await requireActiveUser(req, corsHeaders);
  if (!auth.ok) return auth.response;
  if (auth.role !== "admin_geral") return forbidden(corsHeaders);

  try {
    let body: any;
    try { body = await req.json(); } catch { return json(400, { error: "Requisição inválida" }); }
    const user_id = body?.user_id;
    const action = body?.action;

    if (typeof user_id !== "string" || !UUID_RE.test(user_id)) return json(400, { error: "Usuário inválido" });
    if (!["deactivate", "reactivate", "reject"].includes(action)) return json(400, { error: "Ação inválida" });
    if (user_id === auth.userId) return json(400, { error: "Você não pode alterar o próprio status" });

    const admin = auth.admin;
    let status: string;
    let ban: string;

    if (action === "deactivate") {
      const { error: tErr } = await admin.rpc("fn_stop_timer_for_user", { _user_id: user_id });
      if (tErr) return json(500, { error: "Erro ao encerrar o timer ativo: " + tErr.message });
      status = "inactive"; ban = "876000h";
    } else if (action === "reject") {
      status = "rejected"; ban = "876000h";
    } else {
      status = "active"; ban = "none";
    }

    const { error: pErr } = await admin.from("profiles").update({ status }).eq("id", user_id);
    if (pErr) return json(500, { error: "Erro ao atualizar o status: " + pErr.message });

    const { error: bErr } = await admin.auth.admin.updateUserById(user_id, { ban_duration: ban });
    if (bErr) return json(500, { error: "Erro ao atualizar o acesso do usuário: " + bErr.message });

    return json(200, { success: true });
  } catch (e) {
    return json(500, { error: "Erro inesperado: " + ((e as Error).message ?? "desconhecido") });
  }
});
