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
    const { email } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({ error: "Email required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

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
