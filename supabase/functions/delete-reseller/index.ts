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
    const authHeader = req.headers.get("Authorization")!;

    // Client to verify the caller
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { reseller_id } = await req.json();
    if (!reseller_id) {
      return new Response(JSON.stringify({ error: "reseller_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin client with service role
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Get reseller data
    const { data: reseller, error: fetchErr } = await adminClient
      .from("resellers")
      .select("id, user_id, company_id")
      .eq("id", reseller_id)
      .single();

    if (fetchErr || !reseller) {
      return new Response(JSON.stringify({ error: "Revendedor não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is admin/owner of the reseller's company
    const { data: isAdmin } = await adminClient.rpc("is_company_admin_or_owner", {
      _user_id: caller.id,
      _company_id: reseller.company_id,
    });

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = reseller.user_id;

    // 1) Delete the reseller row
    await adminClient.from("resellers").delete().eq("id", reseller_id);

    if (userId) {
      // 2) Get user's companies before deleting memberships
      const { data: memberships } = await adminClient
        .from("company_memberships")
        .select("company_id")
        .eq("user_id", userId);

      // 3) Delete company_memberships
      await adminClient.from("company_memberships").delete().eq("user_id", userId);

      // 4) Clean up orphaned companies (no members left)
      for (const m of memberships || []) {
        const { count } = await adminClient
          .from("company_memberships")
          .select("id", { count: "exact", head: true })
          .eq("company_id", m.company_id);
        if (count === 0) {
          // Delete related data first
          await adminClient.from("winback_campaign_progress").delete().eq("company_id", m.company_id);
          await adminClient.from("client_activity_logs").delete().eq("company_id", m.company_id);
          await adminClient.from("client_subscriptions").delete().eq("company_id", m.company_id);
          await adminClient.from("client_mac_keys").delete().eq("company_id", m.company_id);
          await adminClient.from("clients").delete().eq("company_id", m.company_id);
          await adminClient.from("company_settings").delete().eq("company_id", m.company_id);
          await adminClient.from("credit_settings").delete().eq("company_id", m.company_id);
          await adminClient.from("trial_links").delete().eq("company_id", m.company_id);
          await adminClient.from("message_templates").delete().eq("company_id", m.company_id);
          await adminClient.from("servers").delete().eq("company_id", m.company_id);
          await adminClient.from("subscription_plans").delete().eq("company_id", m.company_id);
          await adminClient.from("reseller_credit_transactions").delete().eq("company_id", m.company_id);
          await adminClient.from("reseller_activity_logs").delete().eq("company_id", m.company_id);
          await adminClient.from("companies").delete().eq("id", m.company_id);
        }
      }

      // 5) Delete profile
      await adminClient.from("profiles").delete().eq("id", userId);

      // 6) Delete auth user (allows email reuse)
      await adminClient.auth.admin.deleteUser(userId);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
