import { createClient } from "npm:@supabase/supabase-js@2";

export type AuthOk = { ok: true; userId: string; role: string | null; admin: any };
export type AuthFail = { ok: false; response: Response };

/**
 * Verifica que o chamador está autenticado e com status "active".
 * Retorna o client service role para uso posterior.
 */
export async function requireActiveUser(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<AuthOk | AuthFail> {
  const json = (status: number, error: string) => ({
    ok: false as const,
    response: new Response(JSON.stringify({ error }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }),
  });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return json(401, "Não autenticado");

  const url = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json(401, "Não autenticado");

  const userId = userData.user.id;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const [{ data: profile }, { data: roleRow }] = await Promise.all([
    admin.from("profiles").select("status").eq("id", userId).maybeSingle(),
    admin.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
  ]);

  if (!profile || (profile as any).status !== "active") return json(403, "Acesso negado");

  return { ok: true, userId, role: (roleRow as any)?.role ?? null, admin };
}

export function forbidden(corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: "Acesso negado" }), {
    status: 403,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
