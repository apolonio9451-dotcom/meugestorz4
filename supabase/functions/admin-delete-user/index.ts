import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { user_id } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get memberships to find companies
    const { data: memberships } = await adminClient
      .from("company_memberships")
      .select("company_id")
      .eq("user_id", user_id);

    // Delete memberships
    await adminClient.from("company_memberships").delete().eq("user_id", user_id);

    // Cleanup orphan companies
    const tables = [
      "winback_campaign_progress", "client_activity_logs", "client_subscriptions",
      "client_mac_keys", "clients", "company_settings", "credit_settings",
      "trial_links", "message_templates", "servers", "subscription_plans",
      "reseller_credit_transactions", "reseller_activity_logs", "resellers",
    ];

    for (const m of memberships || []) {
      const { count } = await adminClient
        .from("company_memberships")
        .select("id", { count: "exact", head: true })
        .eq("company_id", m.company_id);

      if ((count ?? 0) === 0) {
        for (const table of tables) {
          await adminClient.from(table).delete().eq("company_id", m.company_id);
        }
        await adminClient.from("companies").delete().eq("id", m.company_id);
      }
    }

    // Delete profile
    await adminClient.from("profiles").delete().eq("id", user_id);

    // Delete auth user (also invalidates all sessions)
    const { error: authErr } = await adminClient.auth.admin.deleteUser(user_id);
    if (authErr) throw authErr;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
