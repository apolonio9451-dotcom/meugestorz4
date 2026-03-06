import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const companyScopedTables = [
  "winback_campaign_progress",
  "client_activity_logs",
  "client_subscriptions",
  "client_mac_keys",
  "clients",
  "company_settings",
  "credit_settings",
  "trial_links",
  "message_templates",
  "servers",
  "subscription_plans",
  "reseller_credit_transactions",
  "reseller_activity_logs",
  "resellers",
] as const;

const ensureSuccess = (error: { message: string } | null, context: string) => {
  if (error) throw new Error(`${context}: ${error.message}`);
};

async function cleanupOrphanCompany(adminClient: ReturnType<typeof createClient>, companyId: string) {
  const { count, error: countError } = await adminClient
    .from("company_memberships")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);

  ensureSuccess(countError, "Falha ao validar membros da empresa");
  if ((count ?? 0) > 0) return;

  for (const table of companyScopedTables) {
    const { error } = await adminClient.from(table).delete().eq("company_id", companyId);
    ensureSuccess(error, `Falha ao remover dados em ${table}`);
  }

  const { error: deleteCompanyError } = await adminClient.from("companies").delete().eq("id", companyId);
  ensureSuccess(deleteCompanyError, "Falha ao remover empresa órfã");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization")!;

    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: caller },
    } = await callerClient.auth.getUser();

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

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

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

    const { data: isAdmin, error: permissionErr } = await adminClient.rpc("is_company_admin_or_owner", {
      _user_id: caller.id,
      _company_id: reseller.company_id,
    });
    ensureSuccess(permissionErr, "Falha ao validar permissões");

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = reseller.user_id;
    if (userId && userId === caller.id) {
      return new Response(JSON.stringify({ error: "Não é permitido excluir seu próprio usuário" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: deleteResellerError } = await adminClient.from("resellers").delete().eq("id", reseller_id);
    ensureSuccess(deleteResellerError, "Falha ao remover revendedor");

    if (userId) {
      const { data: memberships, error: membershipsErr } = await adminClient
        .from("company_memberships")
        .select("company_id")
        .eq("user_id", userId);
      ensureSuccess(membershipsErr, "Falha ao buscar vínculos do usuário");

      const { error: deleteMembershipsError } = await adminClient
        .from("company_memberships")
        .delete()
        .eq("user_id", userId);
      ensureSuccess(deleteMembershipsError, "Falha ao remover vínculos do usuário");

      for (const membership of memberships || []) {
        await cleanupOrphanCompany(adminClient, membership.company_id);
      }

      const { error: deleteProfileError } = await adminClient.from("profiles").delete().eq("id", userId);
      ensureSuccess(deleteProfileError, "Falha ao remover perfil");

      const { error: deleteAuthUserError } = await adminClient.auth.admin.deleteUser(userId);
      ensureSuccess(deleteAuthUserError, "Falha ao remover usuário de autenticação");
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Erro inesperado" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
