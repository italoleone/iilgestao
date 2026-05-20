import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const users = [
      { email: "victoria@leoneengenharia.com.br", password: "123456", name: "Victoria", role: "projetista", discipline: "estrutural", cost_per_hour: 85, monthly_capacity_hours: 176 },
      { email: "mylena@leoneengenharia.com.br", password: "123456", name: "Mylena", role: "projetista", discipline: "estrutural", cost_per_hour: 85, monthly_capacity_hours: 176 },
    ];

    const results = [];
    const { data: existingUsers } = await admin.auth.admin.listUsers();

    for (const u of users) {
      const existing = existingUsers?.users?.find((x: any) => x.email === u.email);
      let userId: string;
      if (existing) {
        userId = existing.id;
        await admin.auth.admin.updateUserById(userId, { password: u.password, email_confirm: true });
        results.push({ email: u.email, status: "updated", id: userId });
      } else {
        const { data, error } = await admin.auth.admin.createUser({
          email: u.email,
          password: u.password,
          email_confirm: true,
          user_metadata: { name: u.name, discipline: u.discipline },
        });
        if (error) { results.push({ email: u.email, status: "error", error: error.message }); continue; }
        userId = data.user.id;
        results.push({ email: u.email, status: "created", id: userId });
      }

      await admin.from("profiles").upsert({
        id: userId,
        name: u.name,
        email: u.email,
        discipline: u.discipline,
        cost_per_hour: u.cost_per_hour,
        monthly_capacity_hours: u.monthly_capacity_hours,
        status: "active",
      });

      await admin.from("user_roles").upsert(
        { user_id: userId, role: u.role },
        { onConflict: "user_id,role" }
      );
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
