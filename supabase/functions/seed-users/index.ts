import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const testUsers = [
      { email: "italo@leoneengenharia.com.br", password: "123456", name: "Ítalo Leone", role: "admin_geral", discipline: "estrutural", cost_per_hour: 200, monthly_capacity_hours: 176 },
      { email: "alessandra@leoneengenharia.com.br", password: "123456", name: "Alessandra Leone", role: "admin", discipline: "estrutural", cost_per_hour: 180, monthly_capacity_hours: 176 },
      { email: "rebeca@leoneengenharia.com.br", password: "123456", name: "Rebeca Silva", role: "planejamento", discipline: "estrutural", cost_per_hour: 120, monthly_capacity_hours: 176 },
      { email: "marcelo@leoneengenharia.com.br", password: "123456", name: "Marcelo Santos", role: "projetista", discipline: "estrutural", cost_per_hour: 85, monthly_capacity_hours: 176 },
    ];

    const results = [];

    for (const user of testUsers) {
      // Check if user already exists
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existing = existingUsers?.users?.find((u: any) => u.email === user.email);

      let userId: string;

      if (existing) {
        userId = existing.id;
        results.push({ email: user.email, status: "already_exists", id: userId });
      } else {
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true,
          user_metadata: { name: user.name },
        });

        if (authError) {
          results.push({ email: user.email, status: "error", error: authError.message });
          continue;
        }
        userId = authData.user.id;
        results.push({ email: user.email, status: "created", id: userId });
      }

      // Upsert profile
      await supabaseAdmin.from("profiles").upsert({
        id: userId,
        name: user.name,
        email: user.email,
        discipline: user.discipline,
        cost_per_hour: user.cost_per_hour,
        monthly_capacity_hours: user.monthly_capacity_hours,
      });

      // Upsert role
      await supabaseAdmin.from("user_roles").upsert(
        { user_id: userId, role: user.role },
        { onConflict: "user_id,role" }
      );
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
