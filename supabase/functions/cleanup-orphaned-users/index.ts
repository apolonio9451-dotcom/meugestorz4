import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Auth check: either service role or authenticated owner
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    
    // If not service role, verify user is owner
    if (token !== serviceRoleKey) {
      if (!token) {
        return new Response(JSON.stringify({ error: "Não autenticado" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: { user: caller } } = await adminClient.auth.admin.getUserById(
        // Decode JWT to get user ID
        ""
      ).catch(() => ({ data: { user: null } }));
      
      // Use the anon client to verify
      const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user: caller2 } } = await anonClient.auth.getUser();
      if (!caller2) {
        return new Response(JSON.stringify({ error: "Não autenticado" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: membership } = await adminClient
        .from("company_memberships")
        .select("role")
        .eq("user_id", caller2.id)
        .eq("role", "owner")
        .maybeSingle();
      if (!membership) {
        return new Response(JSON.stringify({ error: "Sem permissão" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json().catch(() => ({}));
    const excludeId = body.exclude_user_id || null;

    const { data: { users }, error: listErr } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    if (listErr) throw listErr;

    const cleaned: string[] = [];

    for (const u of users) {
      if (excludeId && u.id === excludeId) continue;

      const { data: reseller } = await adminClient
        .from("resellers")
        .select("id")
        .eq("user_id", u.id)
        .maybeSingle();
      if (reseller) continue;

      const { data: mem } = await adminClient
        .from("company_memberships")
        .select("id, is_trial, company_id")
        .eq("user_id", u.id)
        .limit(1)
        .maybeSingle();

      const isTrial = u.user_metadata?.is_trial || mem?.is_trial;
      if (!isTrial) continue;

      const { data: allMems } = await adminClient
        .from("company_memberships")
        .select("company_id")
        .eq("user_id", u.id);

      for (const m of allMems || []) {
        await adminClient.from("company_memberships").delete().eq("company_id", m.company_id).eq("user_id", u.id);
        const { count } = await adminClient
          .from("company_memberships")
          .select("id", { count: "exact", head: true })
          .eq("company_id", m.company_id);
        if (count === 0) {
          await adminClient.from("companies").delete().eq("id", m.company_id);
        }
      }

      await adminClient.from("profiles").delete().eq("id", u.id);
      await adminClient.auth.admin.deleteUser(u.id);
      cleaned.push(u.email || u.id);
    }

    return new Response(JSON.stringify({ success: true, cleaned_count: cleaned.length, cleaned_emails: cleaned }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
