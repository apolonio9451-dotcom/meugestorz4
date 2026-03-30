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
    // --- Auth: validate caller is admin/owner ---
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({ error: "Email required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Check caller has admin/owner role in at least one company
    const { data: callerMemberships } = await supabaseAdmin
      .from("company_memberships")
      .select("company_id, role")
      .eq("user_id", caller.id);

    const isAdminOrOwner = (callerMemberships || []).some(
      (m: any) => m.role === "owner" || m.role === "admin"
    );
    if (!isAdminOrOwner) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Search through pages to find the user
    let found = null;
    let page = 1;
    const perPage = 1000;
    while (!found) {
      const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      });
      if (error) throw error;
      if (!users || users.length === 0) break;
      found = users.find((u) => u.email === email);
      if (users.length < perPage) break;
      page++;
    }

    if (!found) {
      return new Response(JSON.stringify({ error: "User not found", searched_pages: page }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Delete the user
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(found.id);
    if (deleteError) throw deleteError;

    // Clean up any orphaned data
    await supabaseAdmin.from("profiles").delete().eq("id", found.id);
    await supabaseAdmin.from("company_memberships").delete().eq("user_id", found.id);
    await supabaseAdmin.from("resellers").delete().eq("user_id", found.id);

    return new Response(JSON.stringify({ 
      success: true, 
      deleted_id: found.id,
      email: found.email,
      confirmed: !!found.email_confirmed_at
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
