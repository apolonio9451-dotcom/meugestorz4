import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function resolveAuthorizedCompanyId(adminClient: any, userId: string, requestedCompanyId?: string) {
  const { data: memberships } = await adminClient
    .from("company_memberships")
    .select("company_id")
    .eq("user_id", userId);
  
  if (!memberships || memberships.length === 0) return "";
  
  if (requestedCompanyId) {
    const hasAccess = memberships.some((m: any) => m.company_id === requestedCompanyId);
    if (hasAccess) return requestedCompanyId;
  }
  
  return memberships[0].company_id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const body = await req.json();
    const resolvedCompanyId = await resolveAuthorizedCompanyId(adminClient, user.id, body.company_id);
    
    if (!resolvedCompanyId) throw new Error("No company access");

    const { action, instance_name, server_url, token } = body;

    if (action === "create") {
      const { data, error } = await (adminClient as any)
        .from("whatsapp_instances")
        .insert({
          user_id: user.id,
          instance_name,
          server_url,
          token,
          instance_token: token,
          status: "disconnected",
          is_connected: false
        });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "delete") {
      const { error } = await (adminClient as any)
        .from("whatsapp_instances")
        .delete()
        .eq("user_id", user.id)
        .eq("instance_name", instance_name);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true, company_id: resolvedCompanyId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
