import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { reseller_id, action } = await req.json();
    const authHeader = req.headers.get("Authorization")!;

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user: caller } } = await anonClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check caller is owner
    const { data: membership } = await adminClient
      .from("company_memberships")
      .select("role")
      .eq("user_id", caller.id)
      .single();

    if (membership?.role !== "owner") {
      return new Response(JSON.stringify({ error: "Apenas proprietários podem usar o login fantasma" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // EXIT ghost mode — remove temporary membership
    if (action === "exit") {
      if (reseller_id) {
        const { data: reseller } = await adminClient
          .from("resellers")
          .select("user_id")
          .eq("id", reseller_id)
          .single();

        if (reseller?.user_id) {
          const { data: resellerMembership } = await adminClient
            .from("company_memberships")
            .select("company_id")
            .eq("user_id", reseller.user_id)
            .single();

          if (resellerMembership) {
            await adminClient
              .from("company_memberships")
              .delete()
              .eq("user_id", caller.id)
              .eq("company_id", resellerMembership.company_id)
              .eq("role", "operator");
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ENTER ghost mode
    // Get reseller info
    const { data: reseller } = await adminClient
      .from("resellers")
      .select("user_id, name")
      .eq("id", reseller_id)
      .single();

    if (!reseller?.user_id) {
      return new Response(JSON.stringify({ error: "Revendedor não encontrado ou sem conta vinculada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the reseller's own company_id (from their membership)
    const { data: resellerMembership } = await adminClient
      .from("company_memberships")
      .select("company_id")
      .eq("user_id", reseller.user_id)
      .single();

    if (!resellerMembership) {
      return new Response(JSON.stringify({ error: "Empresa do revendedor não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetCompanyId = resellerMembership.company_id;

    // Add caller as temporary operator in target company (if not already)
    const { data: existingMembership } = await adminClient
      .from("company_memberships")
      .select("id")
      .eq("user_id", caller.id)
      .eq("company_id", targetCompanyId)
      .maybeSingle();

    if (!existingMembership) {
      await adminClient
        .from("company_memberships")
        .insert({
          user_id: caller.id,
          company_id: targetCompanyId,
          role: "operator",
        });
    }

    return new Response(
      JSON.stringify({
        company_id: targetCompanyId,
        name: reseller.name,
        reseller_id: reseller_id,
        user_id: reseller.user_id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
