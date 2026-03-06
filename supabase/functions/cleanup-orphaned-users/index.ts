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
    const authHeader = req.headers.get("Authorization")!;

    // Verify caller
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is an owner
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: membership } = await adminClient
      .from("company_memberships")
      .select("role, company_id")
      .eq("user_id", caller.id)
      .eq("role", "owner")
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // List all auth users
    const { data: { users }, error: listErr } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    if (listErr) throw listErr;

    // Find orphaned users: have trial metadata but no reseller row and no active membership (excluding the caller)
    const cleaned: string[] = [];

    for (const u of users) {
      if (u.id === caller.id) continue;

      // Check if user has a reseller record
      const { data: reseller } = await adminClient
        .from("resellers")
        .select("id")
        .eq("user_id", u.id)
        .maybeSingle();

      if (reseller) continue; // still has a reseller record, skip

      // Check if user has any active membership
      const { data: mem } = await adminClient
        .from("company_memberships")
        .select("id, is_trial")
        .eq("user_id", u.id)
        .limit(1)
        .maybeSingle();

      // Only clean up trial users whose reseller was deleted (has trial metadata OR is_trial membership)
      const isTrial = u.user_metadata?.is_trial || mem?.is_trial;
      if (!isTrial) continue;

      // This is an orphaned trial user - clean up
      if (mem) {
        // Delete the company created for this user
        const { data: membershipFull } = await adminClient
          .from("company_memberships")
          .select("company_id")
          .eq("user_id", u.id);
        
        for (const m of membershipFull || []) {
          await adminClient.from("company_memberships").delete().eq("company_id", m.company_id).eq("user_id", u.id);
          // Check if company has other members
          const { count } = await adminClient
            .from("company_memberships")
            .select("id", { count: "exact", head: true })
            .eq("company_id", m.company_id);
          if (count === 0) {
            await adminClient.from("companies").delete().eq("id", m.company_id);
          }
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
