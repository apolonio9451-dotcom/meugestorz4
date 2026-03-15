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
    const { reseller_id } = await req.json();
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

    // Get user email from auth
    const { data: { user: resellerUser } } = await adminClient.auth.admin.getUserById(reseller.user_id);
    if (!resellerUser?.email) {
      return new Response(JSON.stringify({ error: "Email do revendedor não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate magic link
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: resellerUser.email,
    });

    if (linkError || !linkData) {
      return new Response(JSON.stringify({ error: linkError?.message || "Erro ao gerar link" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        url: linkData.properties?.action_link,
        name: reseller.name,
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
